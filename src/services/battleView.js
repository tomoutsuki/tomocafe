const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

function remainingMinutes(expiresAt, now = new Date()) {
    return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 60000));
}

function battleStatusText(battle) {
    if (battle.status === 'cancelled') return '戦闘を終了しました。';
    if (battle.status === 'timed_out') return '戦闘は時間切れになりました。';
    if (battle.status === 'won') return '勝利しました！';
    if (battle.status === 'lost') return '敗北しました。';
    return '「こうげき」を押して、カフェモンスターを追い払おう！';
}

function createBattleComponents(battle, { hasUsableItems = false } = {}) {
    const isActive = battle.status === 'active';
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`battle:attack:${battle.battle_id}`)
                .setLabel('こうげき')
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!isActive),
            new ButtonBuilder()
                .setCustomId(`battle:item:${battle.battle_id}`)
                .setLabel('アイテム')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!isActive || !hasUsableItems),
            new ButtonBuilder()
                .setCustomId(`battle:inspect:${battle.battle_id}`)
                .setLabel('しらべる')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(!isActive || battle.inspected)
        )
    ];
}

function createBattlePayload(battle, now = new Date(), options = {}) {
    const timeText = battle.status === 'active'
        ? `残り時間：約${remainingMinutes(battle.expires_at, now)}分`
        : 'この戦闘は終了しています。';

    return {
        content: [
            `☕ **${battle.monster_name}** が現れた！`,
            `モンスターHP：${battle.monster_hp} / ${battle.monster_max_hp}`,
            `プレイヤーHP：${battle.player_hp} / ${battle.player_max_hp}`,
            `報酬予定：${battle.reward_beans}豆`,
            timeText,
            battle.inspection_message,
            battle.last_action_message,
            battleStatusText(battle)
        ].filter(Boolean).join('\n'),
        components: createBattleComponents(battle, options)
    };
}

function createItemMenuPayload(battle, options) {
    const isActive = battle.status === 'active';
    const healingLabel = options.healingItem
        ? `回復する（${options.healingItem.title} ×${options.healingItem.quantity}）`
        : '回復する';
    const recommendedLabel = options.recommendedItem
        ? `おすすめを使う（${options.recommendedItem.title} ×${options.recommendedItem.quantity}）`
        : 'おすすめを使う';
    return {
        content: [
            `☕ **${battle.monster_name}** との戦闘：アイテムを選んでね。`,
            'アイテム使用後、相手が生きていれば反撃されます。'
        ].join('\n'),
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`battle:heal:${battle.battle_id}`)
                    .setLabel(healingLabel.slice(0, 80))
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!isActive || !options.healingItem),
                new ButtonBuilder()
                    .setCustomId(`battle:recommend:${battle.battle_id}`)
                    .setLabel(recommendedLabel.slice(0, 80))
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!isActive || !options.recommendedItem),
                new ButtonBuilder()
                    .setCustomId(`battle:back:${battle.battle_id}`)
                    .setLabel('戻る')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!isActive)
            )
        ]
    };
}

module.exports = {
    createBattlePayload,
    createItemMenuPayload,
    remainingMinutes
};
