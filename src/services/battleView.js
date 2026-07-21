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
    return 'フェーズ0の接続確認中です。攻撃はフェーズ1で有効になります。';
}

function createBattleComponents(battle) {
    const isActive = battle.status === 'active';
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`battle:cancel:${battle.battle_id}`)
                .setLabel('戦闘を終了')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(!isActive)
        )
    ];
}

function createBattlePayload(battle, now = new Date()) {
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
            battleStatusText(battle)
        ].join('\n'),
        components: createBattleComponents(battle)
    };
}

module.exports = {
    createBattlePayload,
    remainingMinutes
};
