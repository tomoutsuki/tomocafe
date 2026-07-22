const {
    prepareAttackBattle,
    completePreparedAttack,
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

const ATTACK_ANNOUNCE_DELAY_MS = 1500;
const DAMAGE_DISPLAY_DELAY_MS = 2000;

function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function plainBattle(battle, changes = {}) {
    const source = typeof battle.toObject === 'function' ? battle.toObject() : battle;
    const { log_entries: ignoredLogEntries, ...stateChanges } = changes;
    return { ...source, ...stateChanges };
}

async function completeAnimatedBattle(prepared) {
    let completedBattle = await completePreparedAttack(prepared.battle, {
        ...prepared.changes,
        // 差分画像は命中演出の間だけ表示する。
        show_damage_image: false
    });
    if (completedBattle.status === 'won') {
        completedBattle = await grantBattleReward(completedBattle);
    } else if (completedBattle.status === 'lost') {
        await applyBattleCooldown(completedBattle);
    }
    return completedBattle;
}

async function handleAnimatedAttack(interaction, battleId) {
    // 5秒以上の演出中でも Discord の操作受付期限を超えないよう、先に応答を保留する。
    await interaction.deferUpdate();
    const prepared = await prepareAttackBattle(battleId);
    if (!prepared.changed) {
        if (prepared.battle?.status === 'active' && prepared.battle.action_lock) {
            await interaction.followUp({ content: 'いま行動を処理しています。少し待ってね。', ephemeral: true });
            return true;
        }
        if (prepared.battle) {
            let battle = prepared.battle;
            if (battle.status === 'won') battle = await grantBattleReward(battle);
            if (battle.status === 'lost') await applyBattleCooldown(battle);
            await interaction.editReply(await battlePayload(battle));
        } else {
            await interaction.followUp({ content: 'この操作はすでに処理されています。', ephemeral: true });
        }
        return true;
    }

    const before = plainBattle(prepared.battle);
    const playerName = before.player_display_name || interaction.user.displayName || interaction.user.username;
    const monsterName = before.monster_name;
    const monsterDamage = Math.max(0, before.monster_hp - prepared.changes.monster_hp);
    const playerDamage = Math.max(0, before.player_hp - prepared.changes.player_hp);
    const attackMessage = `⚔️ ${playerName}の攻撃！`;
    const hitMessage = `💥 ${monsterName}に **${monsterDamage}ダメージ**を与えた！`;
    const enemyAttackMessage = `💢 ${monsterName}の攻撃！`;
    const hurtMessage = `💥 ${playerName}は **${playerDamage}ダメージ**を受けた！`;
    let completed = false;

    try {
        await interaction.editReply(createBattlePayload(
            { ...before, status: 'animating', show_damage_image: false },
            new Date(),
            { disableActions: true, mainLog: attackMessage }
        ));
        await delay(ATTACK_ANNOUNCE_DELAY_MS);

        const afterPlayerAttack = {
            ...before,
            status: 'animating',
            monster_hp: prepared.changes.monster_hp,
            // R2 に存在確認済みの差分だけが resolveMonsterImageUrl で選択される。
            show_damage_image: true
        };
        await interaction.editReply(createBattlePayload(
            afterPlayerAttack,
            new Date(),
            { disableActions: true, mainLog: hitMessage }
        ));
        await delay(DAMAGE_DISPLAY_DELAY_MS);

        if (prepared.changes.monster_hp === 0) {
            const completedBattle = await completeAnimatedBattle(prepared);
            completed = true;
            await interaction.editReply(await battlePayload(completedBattle));
            return true;
        }

        await interaction.editReply(createBattlePayload(
            { ...afterPlayerAttack, show_damage_image: false },
            new Date(),
            { disableActions: true, mainLog: enemyAttackMessage }
        ));
        await delay(ATTACK_ANNOUNCE_DELAY_MS);

        await interaction.editReply(createBattlePayload(
            { ...afterPlayerAttack, player_hp: prepared.changes.player_hp, show_damage_image: false },
            new Date(),
            { disableActions: true, mainLog: hurtMessage }
        ));
        await delay(DAMAGE_DISPLAY_DELAY_MS);

        const completedBattle = await completeAnimatedBattle(prepared);
        completed = true;
        await interaction.editReply(await battlePayload(completedBattle, { mainLog: hurtMessage }));
        return true;
    } catch (error) {
        // 表示更新に失敗してもロックを残さず、次の操作不能状態を防ぐ。
        if (!completed) await completeAnimatedBattle(prepared);
        throw error;
    }
}

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

    if (parsed.action === 'attack') {
        return handleAnimatedAttack(interaction, parsed.battleId);
    }

    let result;
    if (parsed.action === 'inspect') {
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

async function battlePayload(battle, viewOptions = {}) {
    if (isSpecialReactionActive(battle)) {
        return createSpecialReactionPayload(battle);
    }
    const options = await getBattleItemOptions(battle);
    return createBattlePayload(battle, new Date(), { ...options, ...viewOptions });
}

module.exports = {
    parseBattleCustomId,
    handleBattleButton
};
