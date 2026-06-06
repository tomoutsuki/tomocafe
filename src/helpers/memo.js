const { EmbedBuilder } = require('discord.js');
const Memo = require('../models/Memo');

const NUMBER_EMOJIS = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣'];
const CLOSE_EMOJI = '❌';
const MAX_VISIBLE_MEMOS = NUMBER_EMOJIS.length;
const COLLECTOR_TIMEOUT_MS = 5 * 60 * 1000;

function normalizeMemoTitle(rawTitle) {
    if (typeof rawTitle !== 'string') return '';
    return rawTitle.replace(/\s+/gu, ' ').trim();
}

function getDisplayName(message) {
    return (
        message.member?.nickname ||
        message.member?.displayName ||
        message.author.globalName ||
        message.author.username
    );
}

function getAvatarUrl(message) {
    return (
        message.member?.displayAvatarURL?.() ||
        message.author.displayAvatarURL?.() ||
        null
    );
}

function buildMemoDescription(memos, totalCount) {
    const lines = memos.map((memo, index) => {
        const prefix = memo.checked ? '✅' : NUMBER_EMOJIS[index];
        return `${prefix}　${memo.title}`;
    });

    if (totalCount > MAX_VISIBLE_MEMOS) {
        lines.push('');
        lines.push(`ほか${totalCount - MAX_VISIBLE_MEMOS}件あります。今は先頭${MAX_VISIBLE_MEMOS}件まで操作できます☕`);
    }

    return lines.join('\n');
}

function buildMemoEmbed(message, memos, totalCount, mode) {
    const embed = new EmbedBuilder()
        .setTitle(`${getDisplayName(message)}のメモ`)
        .setDescription(buildMemoDescription(memos, totalCount))
        .setColor(mode === 'delete' ? 0xd97706 : 0x8b6f47)
        .setFooter({ text: '反応で操作できます。5分で受付終了します。' })
        .setTimestamp();

    const avatarURL = getAvatarUrl(message);
    if (avatarURL) {
        embed.setThumbnail(avatarURL);
    }

    if (mode === 'delete') {
        embed.setAuthor({ name: '⚠どのタスクを削除しますか？' });
    }

    return embed;
}

async function addMemoReactions(targetMessage, visibleCount) {
    for (let index = 0; index < visibleCount; index += 1) {
        await targetMessage.react(NUMBER_EMOJIS[index]);
    }

    await targetMessage.react(CLOSE_EMOJI);
}

async function closeMemoMessage(targetMessage) {
    await targetMessage.delete().catch(() => null);
}

async function finishCollectorMessage(targetMessage, message, mode, reason) {
    if (reason !== 'time') return;

    const currentEmbed = targetMessage.embeds?.[0];
    const finalEmbed = currentEmbed
        ? EmbedBuilder.from(currentEmbed).setFooter({ text: 'このメモの操作受付は終了しました。' })
        : buildMemoEmbed(message, [], 0, mode).setFooter({ text: 'このメモの操作受付は終了しました。' });

    await targetMessage.edit({ embeds: [finalEmbed] }).catch(() => null);
    await targetMessage.reactions.removeAll().catch(() => null);
}

async function fetchOwnerMemos(ownerId) {
    return Memo.find({ owner_id: ownerId }).sort({ createdAt: 1, _id: 1 });
}

async function showMemoBoard(message, mode = 'view') {
    try {
        const memos = await fetchOwnerMemos(message.author.id);

        if (memos.length === 0) {
            await message.reply({
                content: 'まだメモはありません。『！メモ追加　やること』で追加できます☕'
            });
            return;
        }

        const visibleMemos = memos.slice(0, MAX_VISIBLE_MEMOS);
        const memoMessage = await message.reply({
            embeds: [buildMemoEmbed(message, visibleMemos, memos.length, mode)]
        });

        await addMemoReactions(memoMessage, visibleMemos.length);

        const emojiToMemoId = new Map(
            visibleMemos.map((memo, index) => [NUMBER_EMOJIS[index], memo._id.toString()])
        );

        const collector = memoMessage.createReactionCollector({
            filter: (reaction, user) => {
                if (user.bot || user.id !== message.author.id) {
                    return false;
                }

                return reaction.emoji.name === CLOSE_EMOJI || emojiToMemoId.has(reaction.emoji.name);
            },
            time: COLLECTOR_TIMEOUT_MS
        });

        collector.on('collect', async (reaction) => {
            const emoji = reaction.emoji.name;

            if (emoji === CLOSE_EMOJI) {
                collector.stop('closed');
                await closeMemoMessage(memoMessage);
                return;
            }

            const memoId = emojiToMemoId.get(emoji);
            if (!memoId) {
                return;
            }

            if (mode === 'delete') {
                await Memo.findOneAndDelete({ _id: memoId, owner_id: message.author.id });
            } else {
                const memo = await Memo.findOne({ _id: memoId, owner_id: message.author.id });
                if (!memo) {
                    return;
                }

                memo.checked = !memo.checked;
                await memo.save();
            }

            const refreshedMemos = await fetchOwnerMemos(message.author.id);
            if (refreshedMemos.length === 0) {
                collector.stop('empty');
                await closeMemoMessage(memoMessage);
                return;
            }

            emojiToMemoId.clear();
            const nextVisibleMemos = refreshedMemos.slice(0, MAX_VISIBLE_MEMOS);
            nextVisibleMemos.forEach((memo, index) => {
                emojiToMemoId.set(NUMBER_EMOJIS[index], memo._id.toString());
            });

            await memoMessage.edit({
                embeds: [buildMemoEmbed(message, nextVisibleMemos, refreshedMemos.length, mode)]
            });
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'closed' || reason === 'empty') {
                return;
            }

            await finishCollectorMessage(memoMessage, message, mode, reason);
        });
    } catch (error) {
        console.error('メモ表示エラー:', error);
        await message.reply({
            content: 'メモを開けませんでした。少し時間をおいてもう一度試してください☕'
        }).catch(() => null);
    }
}

async function addMemo(message, rawTitle) {
    try {
        const title = normalizeMemoTitle(rawTitle);

        if (!title) {
            await message.reply({
                content: '追加したいメモの内容を書いてください☕ 例：！メモ追加　課題を終わらせる'
            });
            return;
        }

        const memo = new Memo({
            owner_id: message.author.id,
            title
        });

        await memo.save();

        await message.reply({
            content: `メモを追加しました☕ 「${title}」`
        });
    } catch (error) {
        console.error('メモ追加エラー:', error);
        await message.reply({
            content: 'メモを追加できませんでした。少し時間をおいてもう一度試してください☕'
        }).catch(() => null);
    }
}

module.exports = {
    addMemo,
    showMemos: async (message) => showMemoBoard(message, 'view'),
    showDeleteMemos: async (message) => showMemoBoard(message, 'delete')
};
