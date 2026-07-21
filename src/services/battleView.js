const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const monsterImages = require('../data/monsterImages');

const EMOJI = {
    green_begin: '<:green_begin:1529244043819880489>',
    green_middle: '<:green_middle:1529244031572377771>',
    green_end: '<:green_end:1529244045535088721>',
    green_middleend: '<:green_middle_end:1529244034411794712>',
    red_begin: '<:red_begin:1529244035917811902>',
    gray_begin: '<:gray_begin:1529244038224679052>',
    gray_middle: '<:gray_middle:1529244042075045908>',
    gray_end: '<:gray_end:1529244040615428277>'
};

function remainingMinutes(expiresAt, now = new Date()) {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 60000));
}

function createHpBar(current, maximum) {
    const safeMaximum = Math.max(1, Number(maximum) || 1);
    const ratio = Math.max(0, Math.min(1, (Number(current) || 0) / safeMaximum));
    if (ratio === 0) return `${EMOJI.gray_begin}${EMOJI.gray_middle}${EMOJI.gray_middle}${EMOJI.gray_end}`;
    if (ratio < 0.125) return `${EMOJI.red_begin}${EMOJI.gray_middle}${EMOJI.gray_middle}${EMOJI.gray_end}`;

    const filled = Math.max(1, Math.ceil(ratio * 4));
    if (filled === 4) return `${EMOJI.green_begin}${EMOJI.green_middle}${EMOJI.green_middle}${EMOJI.green_end}`;
    if (filled === 3) return `${EMOJI.green_begin}${EMOJI.green_middle}${EMOJI.green_middleend}${EMOJI.gray_end}`;
    if (filled === 2) return `${EMOJI.green_begin}${EMOJI.green_middleend}${EMOJI.gray_middle}${EMOJI.gray_end}`;
    return `${EMOJI.green_middleend}${EMOJI.gray_middle}${EMOJI.gray_middle}${EMOJI.gray_end}`;
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

function createPlayerEmbed(battle) {
    return new EmbedBuilder()
        .setColor('#906ca7')
        .setAuthor({
            name: battle.player_display_name || 'カフェのお客さま',
            ...(battle.player_avatar_url ? { iconURL: battle.player_avatar_url } : {})
        })
        .setTitle(' ')
        .setDescription(`HP ${createHpBar(battle.player_hp, battle.player_max_hp)} **${battle.player_hp} / ${battle.player_max_hp}**`);
}

function createMonsterEmbed(battle) {
    // R2 の公開パスが未反映・未確認なら、従来の画像を使う。通常画像の確認は
    // 起動時に行われ、確認でき次第 has_default_image が true になって R2 へ切り替わる。
    const imageUrl = battle.show_damage_image && battle.has_damage_diff && battle.monster_damage_image_url
        ? battle.monster_damage_image_url
        : battle.has_default_image
            ? battle.monster_image_url
            : monsterImages[battle.monster_id] || battle.monster_image_url;
    const embed = new EmbedBuilder()
        .setColor(battle.show_damage_image ? '#d96b6b' : '#6f4e37')
        .setTitle(`☕ ${battle.monster_name}`)
        .setDescription(`HP ${createHpBar(battle.monster_hp, battle.monster_max_hp)} **${battle.monster_hp} / ${battle.monster_max_hp}**`);
    if (imageUrl) embed.setThumbnail(imageUrl);
    return embed;
}

function createBattleLogEmbed(battle, { mainLog } = {}) {
    const currentLog = mainLog || battle.last_action_message || battleStatusText(battle);
    const isActive = battle.status === 'active';
    const embed = new EmbedBuilder()
        .setColor('#906ca7')
        .setTitle('⚔️ 戦闘')
        .setDescription(`**${currentLog}**${isActive ? '\n\nどうする？' : ''}`)
        .setFooter({ text: isActive ? `残り時間：約${remainingMinutes(battle.expires_at)}分` : battleStatusText(battle) });
    return embed;
}

function createBattleEmbeds(battle, options = {}) {
    return [
        createPlayerEmbed(battle),
        createMonsterEmbed(battle),
        createBattleLogEmbed(battle, options)
    ];
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
    return [new ActionRowBuilder().addComponents(
        grayButton(`battle:attack:${battle.battle_id}`, 'こうげき', '⚔️', !isActive),
        grayButton(`battle:item:${battle.battle_id}`, 'アイテム', '🎒', !isActive || !hasUsableItems),
        grayButton(`battle:inspect:${battle.battle_id}`, 'しらべる', '🔍', !isActive || battle.inspected)
    )];
}

function createBattlePayload(battle, now = new Date(), options = {}) {
    if (battle.status === 'won') return createVictoryPayload(battle);
    return { content: '', embeds: createBattleEmbeds(battle), components: createBattleComponents(battle, options) };
}

function createVictoryPayload(battle) {
    const imageUrl = battle.has_default_image
        ? battle.monster_image_url
        : monsterImages[battle.monster_id] || battle.monster_image_url;
    const embed = new EmbedBuilder()
        .setColor('#d8a24a')
        .setTitle('🎉 戦闘勝利！')
        .setDescription(`**${battle.last_action_message || `${battle.monster_name}を倒した！`}**`);
    if (imageUrl) embed.setThumbnail(imageUrl);
    return { content: '', embeds: [embed], components: [] };
}

function createItemMenuPayload(battle, options) {
    const isActive = battle.status === 'active';
    const healingLabel = options.healingItem ? `回復する ×${options.healingItem.quantity}` : '回復する';
    const recommendedLabel = options.recommendedItem ? `おすすめを使う ×${options.recommendedItem.quantity}` : 'おすすめを使う';
    return {
        content: '',
        embeds: createBattleEmbeds(battle, { mainLog: 'アイテムを選んでね。使用後、相手が生きていれば反撃されます。' }),
        components: [new ActionRowBuilder().addComponents(
            grayButton(`battle:heal:${battle.battle_id}`, healingLabel, '☕', !isActive || !options.healingItem),
            grayButton(`battle:recommend:${battle.battle_id}`, recommendedLabel, '✨', !isActive || !options.recommendedItem),
            grayButton(`battle:back:${battle.battle_id}`, '戻る', '↩️', !isActive)
        )]
    };
}

function createSpecialReactionPayload(battle) {
    const special = battle.special_reaction;
    const isActive = battle.status === 'active' && special?.active;
    const button = (action, label, emoji) => grayButton(`battle:special_${action}:${battle.battle_id}`, label, emoji, !isActive);
    let buttons;
    if (special.pattern === 'heavy_attack_warning') {
        buttons = [button('dodge', 'よける', '💨'), button('guard', 'ガード', '🛡️'), button('press', '攻め続ける', '⚔️')];
    } else if (special.pattern === 'weakness_exposure') {
        buttons = [button('exploit', '弱点を狙う', '🎯'), button('safe', '安全に攻撃', '⚔️')];
    } else {
        buttons = [button('interrupt', '妨害する', '✋'), button('continue', '攻撃を続ける', '⚔️')];
    }
    return {
        content: '',
        embeds: createBattleEmbeds(battle, { mainLog: `⚠️ ${special.message}\n今だけ選択肢が変わっています。` }),
        components: [new ActionRowBuilder().addComponents(buttons)]
    };
}

module.exports = {
    EMOJI,
    createBattlePayload,
    createVictoryPayload,
    createItemMenuPayload,
    createSpecialReactionPayload,
    createBattleEmbeds,
    createHpBar,
    compactLog,
    recentLogLines,
    remainingMinutes
};
