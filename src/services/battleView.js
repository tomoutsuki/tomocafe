const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const HP_BAR_WIDTH = 10;

function remainingMinutes(expiresAt, now = new Date()) {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 60000));
}

function createHpBar(current, maximum, width = HP_BAR_WIDTH) {
    const safeMaximum = Math.max(1, Number(maximum) || 1);
    const ratio = Math.max(0, Math.min(1, (Number(current) || 0) / safeMaximum));
    const filled = Math.round(ratio * width);
    return `${'▰'.repeat(filled)}${'▱'.repeat(width - filled)}`;
}

function compactLog(message, maxLength = 110) {
    const singleLine = String(message || '').replace(/\s+/g, ' ').trim();
    return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
}

function recentLogLines(battle) {
    const logs = battle.recent_logs || [];
    const lastStoredLog = logs[logs.length - 1]?.message;
    const pastLogs = lastStoredLog === battle.last_action_message
        ? logs.slice(-3, -1)
        : logs.slice(-2);
    return pastLogs.map((log) => `・${compactLog(log.message)}`);
}

function battleStatusText(battle) {
    if (battle.status === 'cancelled') return '戦闘を終了しました。';
    if (battle.status === 'timed_out') return '戦闘は時間切れになりました。';
    if (battle.status === 'won') return '勝利しました！';
    if (battle.status === 'lost') return '敗北しました。';
    return '次の行動を選んでね。';
}

function createBattleEmbed(battle, { mainLog } = {}) {
    const currentLog = mainLog || battle.last_action_message || battleStatusText(battle);
    const embed = new EmbedBuilder()
        .setColor('#906ca7')
        .setAuthor({
            name: battle.player_display_name || 'カフェのお客さま',
            ...(battle.player_avatar_url ? { iconURL: battle.player_avatar_url } : {})
        })
        .setTitle(`☕ ${battle.monster_name}`)
        .setDescription(`**${currentLog}**`)
        .addFields(
            {
                name: 'あなた',
                value: `HP ${createHpBar(battle.player_hp, battle.player_max_hp)} **${battle.player_hp} / ${battle.player_max_hp}**`,
                inline: false
            },
            {
                name: 'カフェモンスター',
                value: `HP ${createHpBar(battle.monster_hp, battle.monster_max_hp)} **${battle.monster_hp} / ${battle.monster_max_hp}**`,
                inline: false
            }
        )
        .setFooter({ text: battle.status === 'active' ? `残り時間：約${remainingMinutes(battle.expires_at)}分` : battleStatusText(battle) });

    if (battle.monster_image_url) {
        embed.setThumbnail(battle.monster_image_url);
    }

    const pastLogs = recentLogLines(battle);
    if (pastLogs.length > 0) {
        embed.addFields({ name: '最近のログ', value: pastLogs.join('\n'), inline: false });
    }
    return embed;
}

function grayButton(customId, label, emoji, disabled = false) {
    return new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setEmoji(emoji)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);
}

function createBattleComponents(battle, { hasUsableItems = false } = {}) {
    const isActive = battle.status === 'active';
    return [
        new ActionRowBuilder().addComponents(
            grayButton(`battle:attack:${battle.battle_id}`, 'こうげき', '⚔️', !isActive),
            grayButton(`battle:item:${battle.battle_id}`, 'アイテム', '🎒', !isActive || !hasUsableItems),
            grayButton(`battle:inspect:${battle.battle_id}`, 'しらべる', '🔍', !isActive || battle.inspected)
        )
    ];
}

function createBattlePayload(battle, now = new Date(), options = {}) {
    return {
        content: '',
        embeds: [createBattleEmbed(battle)],
        components: createBattleComponents(battle, options)
    };
}

function createItemMenuPayload(battle, options) {
    const isActive = battle.status === 'active';
    const healingLabel = options.healingItem
        ? `回復する ×${options.healingItem.quantity}`
        : '回復する';
    const recommendedLabel = options.recommendedItem
        ? `おすすめを使う ×${options.recommendedItem.quantity}`
        : 'おすすめを使う';
    return {
        content: '',
        embeds: [createBattleEmbed(battle, { mainLog: 'アイテムを選んでね。使用後、相手が生きていれば反撃されます。' })],
        components: [
            new ActionRowBuilder().addComponents(
                grayButton(`battle:heal:${battle.battle_id}`, healingLabel, '☕', !isActive || !options.healingItem),
                grayButton(`battle:recommend:${battle.battle_id}`, recommendedLabel, '✨', !isActive || !options.recommendedItem),
                grayButton(`battle:back:${battle.battle_id}`, '戻る', '↩️', !isActive)
            )
        ]
    };
}

function createSpecialReactionPayload(battle) {
    const special = battle.special_reaction;
    const isActive = battle.status === 'active' && special?.active;
    const button = (action, label, emoji) => grayButton(
        `battle:special_${action}:${battle.battle_id}`,
        label,
        emoji,
        !isActive
    );

    let buttons;
    if (special.pattern === 'heavy_attack_warning') {
        buttons = [
            button('dodge', 'よける', '💨'),
            button('guard', 'ガード', '🛡️'),
            button('press', '攻め続ける', '⚔️')
        ];
    } else if (special.pattern === 'weakness_exposure') {
        buttons = [
            button('exploit', '弱点を狙う', '🎯'),
            button('safe', '安全に攻撃', '⚔️')
        ];
    } else {
        buttons = [
            button('interrupt', '妨害する', '✋'),
            button('continue', '攻撃を続ける', '⚔️')
        ];
    }

    return {
        content: '',
        embeds: [createBattleEmbed(battle, {
            mainLog: `⚠️ ${special.message}\n今だけ選択肢が変わっています。`
        })],
        components: [new ActionRowBuilder().addComponents(buttons)]
    };
}

module.exports = {
    createBattlePayload,
    createItemMenuPayload,
    createSpecialReactionPayload,
    createHpBar,
    compactLog,
    recentLogLines,
    remainingMinutes
};
