const {
    attackBattle,
    cancelBattle,
    grantBattleReward,
    applyBattleCooldown
} = require('./battleService');
const { createBattlePayload } = require('./battleView');
const Battle = require('../models/Battle');
const { parseBattleCustomId } = require('./battleCustomId');

async function handleBattleButton(interaction) {
    const parsed = parseBattleCustomId(interaction.customId);
    if (!parsed) return false;

    const battle = await Battle.findOne({ battle_id: parsed.battleId });
    if (!battle) {
        await interaction.reply({ content: 'この戦闘データは見つかりません。', ephemeral: true });
        return true;
    }

    if (battle.player_id !== interaction.user.id) {
        await interaction.reply({ content: 'この戦闘を操作できるのは開始した本人だけです。', ephemeral: true });
        return true;
    }

    const result = parsed.action === 'attack'
        ? await attackBattle(parsed.battleId)
        : await cancelBattle(parsed.battleId);
    if (!result.changed) {
        if (result.battle?.status === 'timed_out') {
            await interaction.update(createBattlePayload(result.battle));
            return true;
        }
        if (result.battle?.status === 'won') {
            const rewardedBattle = await grantBattleReward(result.battle);
            await interaction.update(createBattlePayload(rewardedBattle));
            return true;
        }
        if (result.battle?.status === 'lost') {
            await applyBattleCooldown(result.battle);
            await interaction.update(createBattlePayload(result.battle));
            return true;
        }
        await interaction.reply({
            content: 'この操作はすでに処理されています。',
            ephemeral: true
        });
        return true;
    }

    let completedBattle = result.battle;
    if (completedBattle.status === 'won') {
        completedBattle = await grantBattleReward(completedBattle);
    } else if (completedBattle.status === 'lost') {
        await applyBattleCooldown(completedBattle);
    }
    await interaction.update(createBattlePayload(completedBattle));
    return true;
}

module.exports = {
    parseBattleCustomId,
    handleBattleButton
};
