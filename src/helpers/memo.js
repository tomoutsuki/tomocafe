const { EmbedBuilder } = require('discord.js');
const Memo = require('../models/Memo');

const NUMBER_EMOJIS = ['1⃣', '2⃣', '3⃣', '4⃣', '5⃣', '6⃣', '7⃣', '8⃣', '9⃣'];
const PREVIOUS_PAGE_EMOJI = '👈';
const NEXT_PAGE_EMOJI = '👉';
const CLOSE_EMOJI = '❌';
const MAX_VISIBLE_MEMOS = NUMBER_EMOJIS.length;
const COLLECTOR_TIMEOUT_MS = 5 * 60 * 1000;
const MEMO_SPLIT_PATTERN = /[\s\u3000、，,]+/u;

function normalizeMemoTitle(rawTitle) {
    if (typeof rawTitle !== 'string') return '';
    return rawTitle.replace(/\s+/gu, ' ').trim();
}

function splitMemoTitles(rawInput) {
    if (typeof rawInput !== 'string') {
        return [];
    }

    return rawInput
        .split(MEMO_SPLIT_PATTERN)
        .map((title) => normalizeMemoTitle(title))
        .filter(Boolean);
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

function buildMemoDescription(memos, pageIndex, totalPages) {
    const lines = memos.map((memo, index) => {
        const prefix = memo.checked ? '✅' : NUMBER_EMOJIS[index];
        return `${prefix}　${memo.title}`;
    });

    if (totalPages > 1) {
        lines.push('');
        lines.push(`👈 👉 でページ移動できます (${pageIndex + 1}/${totalPages})`);
    }

    return lines.join('\n');
}

function buildMemoEmbed(message, memos, mode, pageIndex, totalPages) {
    const embed = new EmbedBuilder()
        .setTitle(`${getDisplayName(message)}のメモ`)
        .setDescription(buildMemoDescription(memos, pageIndex, totalPages))
        .setColor(mode === 'delete' ? 0xd97706 : 0x8b6f47)
        .setFooter({ text: '❌閉じる' })
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

function buildExpiredEmbed(targetMessage) {
    const currentEmbed = targetMessage.embeds?.[0];
    if (!currentEmbed) {
        return new EmbedBuilder().setFooter({ text: 'このメモの操作受付は終了しました。' });
    }

    return EmbedBuilder.from(currentEmbed).setFooter({
        text: 'このメモの操作受付は終了しました。'
    });
}

function buildEmojiMap(memos) {
    return new Map(
        memos.map((memo, index) => [NUMBER_EMOJIS[index], memo._id.toString()])
    );
}

function buildSuppressionKey(emojiName, userId) {
    return `${emojiName}:${userId}`;
}

async function fetchOwnerMemos(ownerId) {
    return Memo.find({ owner_id: ownerId }).sort({ createdAt: 1, _id: 1 });
}

function getPageCount(totalMemos) {
    return Math.max(1, Math.ceil(totalMemos / MAX_VISIBLE_MEMOS));
}

function getVisibleMemos(memos, pageIndex) {
    const start = pageIndex * MAX_VISIBLE_MEMOS;
    return memos.slice(start, start + MAX_VISIBLE_MEMOS);
}

async function ensureReaction(targetMessage, emojiName) {
    if (!targetMessage.reactions.cache.has(emojiName)) {
        await targetMessage.react(emojiName);
    }
}

async function removeReaction(targetMessage, emojiName) {
    const reaction = targetMessage.reactions.cache.get(emojiName);
    if (reaction) {
        await reaction.remove().catch(() => null);
    }
}

async function syncMemoReactions(targetMessage, previousVisibleCount, nextVisibleCount, hasPagination) {
    if (nextVisibleCount > previousVisibleCount) {
        for (let index = previousVisibleCount; index < nextVisibleCount; index += 1) {
            await ensureReaction(targetMessage, NUMBER_EMOJIS[index]);
        }
    }

    if (nextVisibleCount < previousVisibleCount) {
        for (let index = previousVisibleCount - 1; index >= nextVisibleCount; index -= 1) {
            await removeReaction(targetMessage, NUMBER_EMOJIS[index]);
        }
    }

    if (hasPagination) {
        await ensureReaction(targetMessage, PREVIOUS_PAGE_EMOJI);
        await ensureReaction(targetMessage, NEXT_PAGE_EMOJI);
    } else {
        await removeReaction(targetMessage, PREVIOUS_PAGE_EMOJI);
        await removeReaction(targetMessage, NEXT_PAGE_EMOJI);
    }

    await ensureReaction(targetMessage, CLOSE_EMOJI);
}

async function clearUserInputReactions(targetMessage, userId, suppressedRemovals) {
    const inputEmojis = [...NUMBER_EMOJIS, PREVIOUS_PAGE_EMOJI, NEXT_PAGE_EMOJI];

    for (const emojiName of inputEmojis) {
        const reaction = targetMessage.reactions.cache.get(emojiName);
        if (!reaction) {
            continue;
        }

        suppressedRemovals.add(buildSuppressionKey(emojiName, userId));
        await reaction.users.remove(userId).catch(() => {
            suppressedRemovals.delete(buildSuppressionKey(emojiName, userId));
        });
    }
}

async function closeMemoMessage(targetMessage) {
    await targetMessage.delete().catch(() => null);
}

async function finishCollectorMessage(targetMessage, reason) {
    if (reason !== 'time') return;

    await targetMessage.edit({ embeds: [buildExpiredEmbed(targetMessage)] }).catch(() => null);
    await targetMessage.reactions.removeAll().catch(() => null);
}

async function renderMemoState(memoMessage, message, mode, pageIndex, previousVisibleCount) {
    const refreshedMemos = await fetchOwnerMemos(message.author.id);
    if (refreshedMemos.length === 0) {
        return {
            shouldClose: true,
            emojiToMemoId: new Map(),
            visibleCount: 0,
            pageIndex: 0,
            totalPages: 0
        };
    }

    const totalPages = getPageCount(refreshedMemos.length);
    const safePageIndex = Math.min(pageIndex, totalPages - 1);
    const visibleMemos = getVisibleMemos(refreshedMemos, safePageIndex);
    const nextVisibleCount = visibleMemos.length;

    await memoMessage.edit({
        embeds: [buildMemoEmbed(message, visibleMemos, mode, safePageIndex, totalPages)]
    });

    await syncMemoReactions(
        memoMessage,
        previousVisibleCount,
        nextVisibleCount,
        totalPages > 1
    );

    return {
        shouldClose: false,
        emojiToMemoId: buildEmojiMap(visibleMemos),
        visibleCount: nextVisibleCount,
        pageIndex: safePageIndex,
        totalPages
    };
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

        let pageIndex = 0;
        let totalPages = getPageCount(memos.length);
        let visibleMemos = getVisibleMemos(memos, pageIndex);
        let visibleCount = visibleMemos.length;
        let emojiToMemoId = buildEmojiMap(visibleMemos);
        const suppressedRemovals = new Set();

        const memoMessage = await message.reply({
            embeds: [buildMemoEmbed(message, visibleMemos, mode, pageIndex, totalPages)]
        });

        await syncMemoReactions(memoMessage, 0, visibleCount, totalPages > 1);

        const collector = memoMessage.createReactionCollector({
            filter: (reaction, user) => {
                if (user.bot || user.id !== message.author.id) {
                    return false;
                }

                return (
                    reaction.emoji.name === CLOSE_EMOJI ||
                    reaction.emoji.name === PREVIOUS_PAGE_EMOJI ||
                    reaction.emoji.name === NEXT_PAGE_EMOJI ||
                    emojiToMemoId.has(reaction.emoji.name)
                );
            },
            time: COLLECTOR_TIMEOUT_MS,
            dispose: true
        });

        collector.on('collect', async (reaction, user) => {
            const emoji = reaction.emoji.name;

            if (emoji === CLOSE_EMOJI) {
                collector.stop('closed');
                await closeMemoMessage(memoMessage);
                return;
            }

            if (emoji === PREVIOUS_PAGE_EMOJI || emoji === NEXT_PAGE_EMOJI) {
                const nextPageIndex = emoji === PREVIOUS_PAGE_EMOJI
                    ? Math.max(0, pageIndex - 1)
                    : Math.min(totalPages - 1, pageIndex + 1);

                const rendered = await renderMemoState(
                    memoMessage,
                    message,
                    mode,
                    nextPageIndex,
                    visibleCount
                );

                if (!rendered.shouldClose) {
                    pageIndex = rendered.pageIndex;
                    totalPages = rendered.totalPages;
                    visibleCount = rendered.visibleCount;
                    emojiToMemoId = rendered.emojiToMemoId;
                }

                await clearUserInputReactions(memoMessage, user.id, suppressedRemovals);
                return;
            }

            const memoId = emojiToMemoId.get(emoji);
            if (!memoId) {
                return;
            }

            if (mode === 'delete') {
                suppressedRemovals.add(buildSuppressionKey(emoji, user.id));
                await Memo.findOneAndDelete({ _id: memoId, owner_id: message.author.id });
                await reaction.users.remove(user.id).catch(() => {
                    suppressedRemovals.delete(buildSuppressionKey(emoji, user.id));
                });
            } else {
                await Memo.updateOne(
                    { _id: memoId, owner_id: message.author.id },
                    { $set: { checked: true } }
                );
            }

            const rendered = await renderMemoState(
                memoMessage,
                message,
                mode,
                pageIndex,
                visibleCount
            );

            if (rendered.shouldClose) {
                collector.stop('empty');
                await closeMemoMessage(memoMessage);
                return;
            }

            pageIndex = rendered.pageIndex;
            totalPages = rendered.totalPages;
            visibleCount = rendered.visibleCount;
            emojiToMemoId = rendered.emojiToMemoId;
        });

        collector.on('remove', async (reaction, user) => {
            const suppressedKey = buildSuppressionKey(reaction.emoji.name, user.id);
            if (suppressedRemovals.delete(suppressedKey)) {
                return;
            }

            if (mode === 'delete') {
                return;
            }

            const emoji = reaction.emoji.name;
            const memoId = emojiToMemoId.get(emoji);
            if (!memoId || user.bot || user.id !== message.author.id) {
                return;
            }

            await Memo.updateOne(
                { _id: memoId, owner_id: message.author.id },
                { $set: { checked: false } }
            );

            const rendered = await renderMemoState(
                memoMessage,
                message,
                mode,
                pageIndex,
                visibleCount
            );

            if (rendered.shouldClose) {
                collector.stop('empty');
                await closeMemoMessage(memoMessage);
                return;
            }

            pageIndex = rendered.pageIndex;
            totalPages = rendered.totalPages;
            visibleCount = rendered.visibleCount;
            emojiToMemoId = rendered.emojiToMemoId;
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'closed' || reason === 'empty') {
                return;
            }

            await finishCollectorMessage(memoMessage, reason);
        });
    } catch (error) {
        console.error('メモ表示エラー:', error);
        await message.reply({
            content: 'メモを開けませんでした。少し時間をおいてもう一度試してください☕'
        }).catch(() => null);
    }
}

async function addMemo(message, rawInput) {
    try {
        const titles = splitMemoTitles(rawInput);

        if (titles.length === 0) {
            await message.reply({
                content: '追加したいメモの内容を書いてください☕ 例：！メモ追加　課題を終わらせる'
            });
            return;
        }

        await Memo.insertMany(
            titles.map((title) => ({
                owner_id: message.author.id,
                title
            }))
        );

        if (titles.length === 1) {
            await message.reply({
                content: `メモを追加しました☕ 「${titles[0]}」`
            });
            return;
        }

        await message.reply({
            content: `メモを${titles.length}件追加しました☕`
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
