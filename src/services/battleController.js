const {
    attackBattle,
    cancelBattle,
    grantBattleReward,
    applyBattleCooldown,
    getBattleItemOptions,
    inspectBattle,
    useBattleItem,
    isSpecialReactionActive,
    resolveSpecialReactionAction
} = require('./battleService');
const {
    createBattlePayload,
    createItemMenuPayload,
    createSpecialReactionPayload
} = require('./battleView');
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

    if (parsed.action.startsWith('special_')) {
        const choice = parsed.action.slice('special_'.length);
        const result = await resolveSpecialReactionAction(parsed.battleId, choice);
        return handleBattleResult(interaction, result);
    }

    if (isSpecialReactionActive(battle)) {
        await interaction.update(createSpecialReactionPayload(battle));
        return true;
    }

    if (parsed.action === 'item') {
        const options = await getBattleItemOptions(battle);
        await interaction.update(createItemMenuPayload(battle, options));
        return true;
    }

    if (parsed.action === 'back') {
        const options = await getBattleItemOptions(battle);
        await interaction.update(createBattlePayload(battle, new Date(), options));
        return true;
    }

    let result;
    if (parsed.action === 'attack') {
        result = await attackBattle(parsed.battleId);
    } else if (parsed.action === 'inspect') {
        result = await inspectBattle(parsed.battleId);
    } else if (parsed.action === 'heal' || parsed.action === 'recommend') {
        result = await useBattleItem(parsed.battleId, parsed.action);
    } else {
        // フェーズ1の既存メッセージ上の終了ボタンにも対応する。
        result = await cancelBattle(parsed.battleId);
    }

    return handleBattleResult(interaction, result);
}

async function handleBattleResult(interaction, result) {
    if (!result.changed) {
        if (isSpecialReactionActive(result.battle)) {
            await interaction.update(createSpecialReactionPayload(result.battle));
            return true;
        }
        if (result.battle?.status === 'timed_out') {
            await interaction.update(await battlePayload(result.battle));
            return true;
        }
        if (result.battle?.status === 'won') {
            const rewardedBattle = await grantBattleReward(result.battle);
            await interaction.update(await battlePayload(rewardedBattle));
            return true;
        }
        if (result.battle?.status === 'lost') {
            await applyBattleCooldown(result.battle);
            await interaction.update(await battlePayload(result.battle));
            return true;
        }
        if (result.alreadyInspected) {
            await interaction.reply({ content: 'このモンスターは、すでにしらべました。', ephemeral: true });
            return true;
        }
        if (result.itemUnavailable) {
            await interaction.reply({ content: '使えるアイテムがなくなりました。', ephemeral: true });
            return true;
        }
        if (result.invalidChoice) {
            await interaction.reply({ content: 'その選択は今は使えません。', ephemeral: true });
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
    await interaction.update(await battlePayload(completedBattle));
    return true;
}

async function battlePayload(battle) {
    if (isSpecialReactionActive(battle)) {
        return createSpecialReactionPayload(battle);
    }
    const options = await getBattleItemOptions(battle);
    return createBattlePayload(battle, new Date(), options);
}

module.exports = {
    parseBattleCustomId,
    handleBattleButton
};
