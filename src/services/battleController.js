const { cancelBattle } = require('./battleService');
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

    const result = await cancelBattle(parsed.battleId);
    if (!result.changed) {
        if (result.battle?.status === 'timed_out') {
            await interaction.update(createBattlePayload(result.battle));
            return true;
        }
        await interaction.reply({
            content: 'この操作はすでに処理されています。',
            ephemeral: true
        });
        return true;
    }

    await interaction.update(createBattlePayload(result.battle));
    return true;
}

module.exports = {
    parseBattleCustomId,
    handleBattleButton
};
