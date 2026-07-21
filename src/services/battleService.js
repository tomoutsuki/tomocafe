const crypto = require('crypto');
const Battle = require('../models/Battle');
const User = require('../models/User');
const ItemMaster = require('../models/ItemMaster');

const DEFAULT_TIMEOUT_MINUTES = 30;
const LOCK_STALE_AFTER_MS = 15 * 1000;
const BATTLE_COOLDOWN_MS = 5 * 60 * 1000;

// 既存の配布アイテムは、マスター移行前でもフェーズ2の回復に使える。
const BUILTIN_BATTLE_EFFECTS = {
    welcome_coffee: { kind: 'heal', value: 8, target_tags: [] },
    warm_milk: { kind: 'weakness', value: 5, target_tags: ['コーヒー'] },
    sugar_cube: { kind: 'weakness', value: 4, target_tags: ['アルパカ', 'かわいい'] },
    sticky_syrup: { kind: 'weakness', value: 4, target_tags: ['コウモリ', '浮遊'] }
};
const BUILTIN_BATTLE_ITEM_LABELS = {
    warm_milk: '温かいミルク',
    sugar_cube: '角砂糖',
    sticky_syrup: 'とろとろシロップ'
};
const SPECIAL_PATTERN_MAP = {
    heavy_attack_warning: 'heavy_attack_warning',
    weakness_exposure: 'weakness_exposure',
    interruptible: 'interruptible',
    summon: 'interruptible',
    item_weakness: 'weakness_exposure'
};

function getBattleTimeoutMs() {
    const minutes = Number(process.env.BATTLE_TIMEOUT_MINUTES || DEFAULT_TIMEOUT_MINUTES);
    return Number.isFinite(minutes) && minutes > 0
        ? Math.round(minutes * 60 * 1000)
        : DEFAULT_TIMEOUT_MINUTES * 60 * 1000;
}

function getPlayerStats(user) {
    return {
        max_hp: Math.max(1, Number(user.stats?.max_hp) || 30),
        attack: Math.max(1, Number(user.stats?.attack) || 10),
        defense: Math.max(0, Number(user.stats?.defense) || 2)
    };
}

function createBattleDraft({ player, playerId, monster, guildId, channelId, now = new Date() }) {
    const playerStats = getPlayerStats(player);
    const maxHp = monster.battle.max_hp;

    return {
        battle_id: crypto.randomUUID(),
        player_id: String(playerId || player.user_id),
        guild_id: guildId || null,
        channel_id: channelId || null,
        monster_id: monster.monster_id,
        monster_name: monster.name_ja,
        monster_description: monster.appearance || monster.behavior || '',
        monster_inspect_text: monster.inspect_text || '',
        monster_tags: [...new Set([...(monster.tags || []), monster.category].filter(Boolean))],
        monster_mechanic_hints: (monster.mechanics || []).map((mechanic) => mechanic.hint).filter(Boolean),
        monster_mechanics: (monster.mechanics || []).map((mechanic) => ({
            pattern: mechanic.pattern,
            trigger: mechanic.trigger,
            message: mechanic.message,
            hint: mechanic.hint
        })),
        monster_is_boss: Boolean(monster.is_boss),
        monster_difficulty: monster.difficulty || 1,
        monster_max_hp: maxHp,
        monster_hp: maxHp,
        monster_attack: monster.battle.attack,
        monster_defense: monster.battle.defense,
        reward_beans: monster.battle.reward_beans,
        player_max_hp: playerStats.max_hp,
        player_hp: playerStats.max_hp,
        player_attack: playerStats.attack,
        player_defense: playerStats.defense,
        expires_at: new Date(now.getTime() + getBattleTimeoutMs())
    };
}

function isExpired(battle, now = new Date()) {
    return battle.status === 'active' && new Date(battle.expires_at).getTime() <= now.getTime();
}

async function expireStaleBattles(now = new Date()) {
    const result = await Battle.updateMany(
        { status: 'active', expires_at: { $lte: now } },
        {
            $set: {
                status: 'timed_out',
                finished_at: now,
                action_lock: false,
                action_locked_at: null
            }
        }
    );

    return result.modifiedCount;
}

async function findActiveBattleForPlayer(playerId, now = new Date()) {
    await expireStaleBattles(now);
    return Battle.findOne({
        player_id: String(playerId),
        status: 'active',
        expires_at: { $gt: now }
    }).sort({ createdAt: -1 });
}

function getCooldownRemainingMs(user, now = new Date()) {
    const cooldownUntil = user?.battle_cooldown_until;
    if (!cooldownUntil) return 0;
    return Math.max(0, new Date(cooldownUntil).getTime() - now.getTime());
}

function calculateDamage(attack, defense) {
    return Math.max(1, Math.floor(Number(attack) || 0) - Math.floor(Number(defense) || 0));
}

function resolveAttack(battle, now = new Date()) {
    const insightBonus = Math.max(0, Number(battle.next_attack_bonus) || 0);
    const playerDamage = calculateDamage(battle.player_attack + insightBonus, battle.monster_defense);
    const monsterHp = Math.max(0, battle.monster_hp - playerDamage);
    const nextTurn = battle.turn + 1;

    if (monsterHp === 0) {
        return {
            monster_hp: 0,
            player_hp: battle.player_hp,
            turn: nextTurn,
            status: 'won',
            finished_at: now,
            next_attack_bonus: 0,
            last_action_message: `あなたのこうげき！ ${battle.monster_name} に ${playerDamage} ダメージ！${insightBonus ? ' 調査のひらめきが効いた！' : ''} 倒した！`
        };
    }

    const monsterDamage = calculateDamage(battle.monster_attack, battle.player_defense);
    const playerHp = Math.max(0, battle.player_hp - monsterDamage);
    const lost = playerHp === 0;

    return {
        monster_hp: monsterHp,
        player_hp: playerHp,
        turn: nextTurn,
        status: lost ? 'lost' : 'active',
        finished_at: lost ? now : null,
        next_attack_bonus: 0,
        last_action_message: lost
            ? `あなたのこうげき！ ${battle.monster_name} に ${playerDamage} ダメージ！${insightBonus ? ' 調査のひらめきが効いた！' : ''}\n${battle.monster_name} の反撃！ ${monsterDamage} ダメージを受け、力尽きた…。`
            : `あなたのこうげき！ ${battle.monster_name} に ${playerDamage} ダメージ！${insightBonus ? ' 調査のひらめきが効いた！' : ''}\n${battle.monster_name} の反撃！ ${monsterDamage} ダメージを受けた。`
    };
}

function normalizedSpecialPattern(pattern) {
    return SPECIAL_PATTERN_MAP[pattern] || null;
}

function triggerTurn(trigger) {
    const match = /^turn_(\d+)/.exec(trigger || '');
    return match ? Number(match[1]) : null;
}

function shouldTriggerSpecialReaction(battle, mechanic, random = Math.random) {
    if (battle.monster_is_boss || battle.monster_difficulty >= 2) return true;
    // 基本敵は低確率で1回だけ。毎戦の定型化を避ける。
    return random() < 0.35;
}

function prepareSpecialReaction(battle, changes, random = Math.random) {
    if (changes.status !== 'active' || battle.special_reaction?.active) return changes;

    const used = new Set(battle.used_mechanic_indices || []);
    const mechanicIndex = (battle.monster_mechanics || []).findIndex((mechanic, index) => (
        !used.has(index)
        && triggerTurn(mechanic.trigger) === changes.turn
        && normalizedSpecialPattern(mechanic.pattern)
    ));
    if (mechanicIndex < 0) return changes;

    const mechanic = battle.monster_mechanics[mechanicIndex];
    if (!shouldTriggerSpecialReaction(battle, mechanic, random)) return changes;

    return {
        ...changes,
        used_mechanic_indices: [...used, mechanicIndex],
        special_reaction: {
            active: true,
            pattern: normalizedSpecialPattern(mechanic.pattern),
            message: mechanic.message,
            mechanic_index: mechanicIndex
        },
        last_action_message: `${changes.last_action_message}\n⚠️ ${mechanic.message}`
    };
}

function isSpecialReactionActive(battle) {
    return Boolean(battle?.status === 'active' && battle.special_reaction?.active);
}

function resolveSpecialReaction(battle, choice, now = new Date()) {
    const pattern = battle.special_reaction?.pattern;
    const specialDamage = calculateDamage(battle.monster_attack * 2, battle.player_defense);
    const normalDamage = calculateDamage(battle.monster_attack, battle.player_defense);
    const insightBonus = Math.max(0, Number(battle.next_attack_bonus) || 0);
    const normalPlayerDamage = calculateDamage(battle.player_attack + insightBonus, battle.monster_defense);
    const weakPointDamage = calculateDamage(battle.player_attack + insightBonus + 5, battle.monster_defense);
    let monsterHp = battle.monster_hp;
    let playerHp = battle.player_hp;
    let nextAttackBonus = battle.next_attack_bonus || 0;
    let message;

    if (pattern === 'heavy_attack_warning') {
        if (choice === 'dodge') {
            message = 'よけるを選んだ！ 強い一撃を華麗によけた。';
        } else if (choice === 'guard') {
            const damage = Math.ceil(specialDamage / 2);
            playerHp = Math.max(0, playerHp - damage);
            message = `ガードを選んだ！ ${damage} ダメージに抑えた。`;
        } else if (choice === 'press') {
            monsterHp = Math.max(0, monsterHp - normalPlayerDamage);
            nextAttackBonus = 0;
            if (monsterHp > 0) playerHp = Math.max(0, playerHp - specialDamage);
            message = monsterHp === 0
                ? `攻め続けるを選んだ！ ${normalPlayerDamage} ダメージで倒した！`
                : `攻め続けるを選んだ！ ${normalPlayerDamage} ダメージを与えたが、${specialDamage} ダメージを受けた。`;
        } else {
            return null;
        }
    } else if (pattern === 'weakness_exposure') {
        if (choice === 'exploit') {
            monsterHp = Math.max(0, monsterHp - weakPointDamage);
            nextAttackBonus = 0;
            if (monsterHp > 0) playerHp = Math.max(0, playerHp - normalDamage);
            message = monsterHp === 0
                ? `弱点を狙った！ ${weakPointDamage} ダメージで倒した！`
                : `弱点を狙った！ ${weakPointDamage} ダメージを与えたが、${normalDamage} ダメージを受けた。`;
        } else if (choice === 'safe') {
            monsterHp = Math.max(0, monsterHp - normalPlayerDamage);
            nextAttackBonus = 0;
            message = monsterHp === 0
                ? `安全に攻撃した！ ${normalPlayerDamage} ダメージで倒した！`
                : `安全に攻撃した！ ${normalPlayerDamage} ダメージを与え、反撃を避けた。`;
        } else {
            return null;
        }
    } else if (pattern === 'interruptible') {
        if (choice === 'interrupt') {
            nextAttackBonus += 3;
            message = '妨害するを選んだ！ 相手の準備を止め、次のこうげきが3強くなる。';
        } else if (choice === 'continue') {
            monsterHp = Math.max(0, monsterHp - normalPlayerDamage);
            nextAttackBonus = 0;
            if (monsterHp > 0) playerHp = Math.max(0, playerHp - specialDamage);
            message = monsterHp === 0
                ? `攻撃を続けるを選んだ！ ${normalPlayerDamage} ダメージで倒した！`
                : `攻撃を続けるを選んだ！ ${normalPlayerDamage} ダメージを与えたが、${specialDamage} ダメージを受けた。`;
        } else {
            return null;
        }
    } else {
        return null;
    }

    const won = monsterHp === 0;
    const lost = playerHp === 0;
    return {
        monster_hp: monsterHp,
        player_hp: playerHp,
        status: won ? 'won' : lost ? 'lost' : 'active',
        finished_at: won || lost ? now : null,
        next_attack_bonus: nextAttackBonus,
        special_reaction: { active: false, pattern: null, message: null, mechanic_index: null },
        last_action_message: message
    };
}

function battleItemEffect(item) {
    return item?.battle_effect || BUILTIN_BATTLE_EFFECTS[item?.item_id] || null;
}

function chooseHealingItem(items, playerHp, playerMaxHp) {
    const missingHp = Math.max(0, playerMaxHp - playerHp);
    const healingItems = items.filter((item) => item.effect?.kind === 'heal');
    if (healingItems.length === 0 || missingHp === 0) return null;

    return healingItems
        .sort((a, b) => a.effect.value - b.effect.value)
        .find((item) => item.effect.value >= missingHp)
        || healingItems[healingItems.length - 1];
}

function chooseRecommendedItem(items, monsterTags) {
    const tagSet = new Set(monsterTags || []);
    return items
        .filter((item) => item.effect?.kind === 'weakness')
        .filter((item) => (item.effect.target_tags || []).some((tag) => tagSet.has(tag)))
        .sort((a, b) => b.effect.value - a.effect.value)[0] || null;
}

async function getBattleItemsForUser(user) {
    const inventory = (user?.items || []).filter((entry) => entry.quantity > 0);
    if (inventory.length === 0) return [];

    const itemIds = inventory.map((entry) => entry.item_id);
    const masters = await ItemMaster.find({ item_id: { $in: itemIds } }).lean();
    const mastersById = new Map(masters.map((item) => [item.item_id, item]));

    return inventory.map((entry) => {
        const master = mastersById.get(entry.item_id) || { item_id: entry.item_id, title: entry.item_id };
        return {
            item_id: entry.item_id,
            quantity: entry.quantity,
            title: master.title || entry.item_id,
            effect: battleItemEffect(master)
        };
    }).filter((item) => item.effect);
}

async function getBattleItemOptions(battle) {
    const user = await User.findOne({ user_id: battle.player_id });
    if (!user) return { healingItem: null, recommendedItem: null, hasUsableItems: false };

    const items = await getBattleItemsForUser(user);
    const healingItem = chooseHealingItem(items, battle.player_hp, battle.player_max_hp);
    const recommendedItem = chooseRecommendedItem(items, battle.monster_tags);
    return {
        healingItem,
        recommendedItem,
        hasUsableItems: Boolean(healingItem || recommendedItem)
    };
}

function resolveItemAction(battle, item, now = new Date()) {
    const effect = item.effect;
    const nextTurn = battle.turn + 1;
    let monsterHp = battle.monster_hp;
    let playerHp = battle.player_hp;
    let actionMessage;

    if (effect.kind === 'heal') {
        const healedAmount = Math.min(effect.value, battle.player_max_hp - playerHp);
        playerHp += healedAmount;
        actionMessage = `${item.title} を使った！ HPが ${healedAmount} 回復した。`;
    } else {
        monsterHp = Math.max(0, monsterHp - effect.value);
        actionMessage = `${item.title} を使った！ ${battle.monster_name} に ${effect.value} ダメージ！`;
        if (monsterHp === 0) {
            return {
                monster_hp: 0,
                player_hp: playerHp,
                turn: nextTurn,
                status: 'won',
                finished_at: now,
                last_action_message: `${actionMessage} 倒した！`
            };
        }
    }

    const monsterDamage = calculateDamage(battle.monster_attack, battle.player_defense);
    playerHp = Math.max(0, playerHp - monsterDamage);
    const lost = playerHp === 0;
    return {
        monster_hp: monsterHp,
        player_hp: playerHp,
        turn: nextTurn,
        status: lost ? 'lost' : 'active',
        finished_at: lost ? now : null,
        last_action_message: lost
            ? `${actionMessage}\n${battle.monster_name} の反撃！ ${monsterDamage} ダメージを受け、力尽きた…。`
            : `${actionMessage}\n${battle.monster_name} の反撃！ ${monsterDamage} ダメージを受けた。`
    };
}

function buildInspectionMessage(battle) {
    const hints = battle.monster_mechanic_hints?.length > 0
        ? battle.monster_mechanic_hints.join(' ')
        : 'まだ大きな動きは見えない。';
    const tagSet = new Set(battle.monster_tags || []);
    const effectiveItems = Object.entries(BUILTIN_BATTLE_EFFECTS)
        .filter(([, effect]) => effect.kind === 'weakness' && effect.target_tags.some((tag) => tagSet.has(tag)))
        .map(([itemId]) => BUILTIN_BATTLE_ITEM_LABELS[itemId] || itemId);
    return [
        `しらべた！ ${battle.monster_description || `${battle.monster_name}の様子は不思議だ。`}`,
        `弱点：${battle.monster_inspect_text || '手持ちのアイテムを試してみよう。'}`,
        `有効なアイテム：${effectiveItems.length > 0 ? effectiveItems.join('、') : '手持ちのアイテムを試してみよう。'}`,
        `特殊行動のヒント：${hints}`,
        '調査のひらめきで、次のこうげきのダメージが3増える！'
    ].join('\n');
}

async function createSoloBattle({ player, playerId, monster, guildId, channelId, now = new Date() }) {
    const activeBattle = await findActiveBattleForPlayer(playerId || player.user_id, now);
    if (activeBattle) {
        return { battle: activeBattle, created: false };
    }

    const cooldownRemainingMs = getCooldownRemainingMs(player, now);
    if (cooldownRemainingMs > 0) {
        return { battle: null, created: false, cooldownRemainingMs };
    }

    let battle;
    try {
        battle = await Battle.create(createBattleDraft({
            player,
            playerId,
            monster,
            guildId,
            channelId,
            now
        }));
    } catch (error) {
        if (error?.code === 11000) {
            const concurrentBattle = await findActiveBattleForPlayer(playerId || player.user_id, now);
            if (concurrentBattle) {
                return { battle: concurrentBattle, created: false };
            }
        }
        throw error;
    }

    return { battle, created: true };
}

async function saveBattleMessageId(battleId, messageId) {
    await Battle.updateOne(
        { battle_id: battleId, status: 'active' },
        { $set: { message_id: String(messageId) } }
    );
}

async function acquireActionLock(battleId, now = new Date()) {
    const staleLockAt = new Date(now.getTime() - LOCK_STALE_AFTER_MS);
    return Battle.findOneAndUpdate(
        {
            battle_id: battleId,
            status: 'active',
            expires_at: { $gt: now },
            'special_reaction.active': { $ne: true },
            $or: [
                { action_lock: false },
                { action_locked_at: { $lte: staleLockAt } }
            ]
        },
        { $set: { action_lock: true, action_locked_at: now } },
        { new: true }
    );
}

async function acquireSpecialReactionLock(battleId, now = new Date()) {
    const staleLockAt = new Date(now.getTime() - LOCK_STALE_AFTER_MS);
    return Battle.findOneAndUpdate(
        {
            battle_id: battleId,
            status: 'active',
            expires_at: { $gt: now },
            'special_reaction.active': true,
            $or: [
                { action_lock: false },
                { action_locked_at: { $lte: staleLockAt } }
            ]
        },
        { $set: { action_lock: true, action_locked_at: now } },
        { new: true }
    );
}

async function cancelBattle(battleId, now = new Date()) {
    const lockedBattle = await acquireActionLock(battleId, now);
    if (!lockedBattle) {
        const currentBattle = await Battle.findOne({ battle_id: battleId });
        if (currentBattle && isExpired(currentBattle, now)) {
            currentBattle.status = 'timed_out';
            currentBattle.finished_at = now;
            currentBattle.action_lock = false;
            currentBattle.action_locked_at = null;
            await currentBattle.save();
        }
        return { changed: false, battle: currentBattle };
    }

    const finishedBattle = await Battle.findOneAndUpdate(
        { _id: lockedBattle._id, action_lock: true },
        {
            $set: {
                status: 'cancelled',
                finished_at: now,
                action_lock: false,
                action_locked_at: null
            }
        },
        { new: true }
    );

    return { changed: true, battle: finishedBattle };
}

async function finishBattle(battle, changes) {
    return Battle.findOneAndUpdate(
        { _id: battle._id, action_lock: true },
        {
            $set: {
                ...changes,
                action_lock: false,
                action_locked_at: null
            }
        },
        { new: true }
    );
}

async function attackBattle(battleId, now = new Date()) {
    const lockedBattle = await acquireActionLock(battleId, now);
    if (!lockedBattle) {
        const currentBattle = await Battle.findOne({ battle_id: battleId });
        if (currentBattle && isExpired(currentBattle, now)) {
            currentBattle.status = 'timed_out';
            currentBattle.finished_at = now;
            currentBattle.action_lock = false;
            currentBattle.action_locked_at = null;
            await currentBattle.save();
        }
        return { changed: false, battle: currentBattle };
    }

    const changes = prepareSpecialReaction(lockedBattle, resolveAttack(lockedBattle, now));
    const battle = await finishBattle(lockedBattle, changes);
    return { changed: true, battle };
}

async function inspectBattle(battleId, now = new Date()) {
    const lockedBattle = await acquireActionLock(battleId, now);
    if (!lockedBattle) {
        return { changed: false, battle: await Battle.findOne({ battle_id: battleId }) };
    }
    if (lockedBattle.inspected) {
        await Battle.updateOne(
            { _id: lockedBattle._id, action_lock: true },
            { $set: { action_lock: false, action_locked_at: null } }
        );
        return { changed: false, alreadyInspected: true, battle: lockedBattle };
    }

    const inspectionMessage = buildInspectionMessage(lockedBattle);
    const battle = await finishBattle(lockedBattle, {
        inspected: true,
        next_attack_bonus: 3,
        inspection_message: inspectionMessage,
        last_action_message: '相手の様子をしっかり観察した。'
    });
    return { changed: true, battle };
}

async function releaseBattleLock(battle) {
    await Battle.updateOne(
        { _id: battle._id, action_lock: true },
        { $set: { action_lock: false, action_locked_at: null } }
    );
}

async function useBattleItem(battleId, useType, now = new Date()) {
    const lockedBattle = await acquireActionLock(battleId, now);
    if (!lockedBattle) {
        return { changed: false, battle: await Battle.findOne({ battle_id: battleId }) };
    }

    const options = await getBattleItemOptions(lockedBattle);
    const item = useType === 'heal' ? options.healingItem : options.recommendedItem;
    if (!item) {
        await releaseBattleLock(lockedBattle);
        return { changed: false, itemUnavailable: true, battle: lockedBattle };
    }

    const consumedUser = await User.findOneAndUpdate(
        {
            user_id: lockedBattle.player_id,
            items: { $elemMatch: { item_id: item.item_id, quantity: { $gt: 0 } } }
        },
        { $inc: { 'items.$.quantity': -1 } },
        { new: true }
    );
    if (!consumedUser) {
        await releaseBattleLock(lockedBattle);
        return { changed: false, itemUnavailable: true, battle: lockedBattle };
    }

    const battle = await finishBattle(
        lockedBattle,
        prepareSpecialReaction(lockedBattle, resolveItemAction(lockedBattle, item, now))
    );
    return { changed: true, battle, item };
}

async function resolveSpecialReactionAction(battleId, choice, now = new Date()) {
    const lockedBattle = await acquireSpecialReactionLock(battleId, now);
    if (!lockedBattle) {
        return { changed: false, battle: await Battle.findOne({ battle_id: battleId }) };
    }
    const changes = resolveSpecialReaction(lockedBattle, choice, now);
    if (!changes) {
        await releaseBattleLock(lockedBattle);
        return { changed: false, invalidChoice: true, battle: lockedBattle };
    }
    return { changed: true, battle: await finishBattle(lockedBattle, changes) };
}

async function grantBattleReward(battle, now = new Date()) {
    if (battle.status !== 'won') return battle;
    if (battle.reward_claimed) return battle;

    const cooldownUntil = new Date(now.getTime() + BATTLE_COOLDOWN_MS);
    const updatedUser = await User.findOneAndUpdate(
        {
            user_id: battle.player_id,
            battle_reward_ids: { $ne: battle.battle_id }
        },
        {
            $inc: { beans: battle.reward_beans },
            $addToSet: { battle_reward_ids: battle.battle_id },
            $set: { battle_cooldown_until: cooldownUntil }
        },
        { new: true }
    );

    if (!updatedUser) {
        const rewardAlreadyRecorded = await User.exists({
            user_id: battle.player_id,
            battle_reward_ids: battle.battle_id
        });
        if (!rewardAlreadyRecorded) {
            throw new Error(`Battle reward recipient was not found for battle ${battle.battle_id}`);
        }
    }

    return Battle.findOneAndUpdate(
        { _id: battle._id },
        {
            $set: {
                reward_claimed: true,
                last_action_message: `${battle.last_action_message}\n報酬として ${battle.reward_beans}豆を受け取った！`
            }
        },
        { new: true }
    );
}

async function applyBattleCooldown(battle, now = new Date()) {
    if (!['won', 'lost'].includes(battle.status)) return battle;

    const cooldownUntil = new Date(now.getTime() + BATTLE_COOLDOWN_MS);
    const result = await User.updateOne(
        { user_id: battle.player_id },
        { $set: { battle_cooldown_until: cooldownUntil } }
    );
    if (result.matchedCount === 0) {
        throw new Error(`Battle cooldown recipient was not found for battle ${battle.battle_id}`);
    }
    return battle;
}

module.exports = {
    createBattleDraft,
    getBattleTimeoutMs,
    getPlayerStats,
    getCooldownRemainingMs,
    calculateDamage,
    resolveAttack,
    normalizedSpecialPattern,
    shouldTriggerSpecialReaction,
    prepareSpecialReaction,
    isSpecialReactionActive,
    resolveSpecialReaction,
    battleItemEffect,
    chooseHealingItem,
    chooseRecommendedItem,
    resolveItemAction,
    buildInspectionMessage,
    BUILTIN_BATTLE_EFFECTS,
    isExpired,
    expireStaleBattles,
    findActiveBattleForPlayer,
    createSoloBattle,
    saveBattleMessageId,
    cancelBattle,
    attackBattle,
    inspectBattle,
    useBattleItem,
    resolveSpecialReactionAction,
    getBattleItemOptions,
    grantBattleReward,
    applyBattleCooldown,
    BATTLE_COOLDOWN_MS
};
