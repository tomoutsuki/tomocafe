const crypto = require('crypto');
const Battle = require('../models/Battle');
const User = require('../models/User');

const DEFAULT_TIMEOUT_MINUTES = 30;
const LOCK_STALE_AFTER_MS = 15 * 1000;
const BATTLE_COOLDOWN_MS = 5 * 60 * 1000;

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
    const playerDamage = calculateDamage(battle.player_attack, battle.monster_defense);
    const monsterHp = Math.max(0, battle.monster_hp - playerDamage);
    const nextTurn = battle.turn + 1;

    if (monsterHp === 0) {
        return {
            monster_hp: 0,
            player_hp: battle.player_hp,
            turn: nextTurn,
            status: 'won',
            finished_at: now,
            last_action_message: `あなたのこうげき！ ${battle.monster_name} に ${playerDamage} ダメージ！ 倒した！`
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
        last_action_message: lost
            ? `あなたのこうげき！ ${battle.monster_name} に ${playerDamage} ダメージ！\n${battle.monster_name} の反撃！ ${monsterDamage} ダメージを受け、力尽きた…。`
            : `あなたのこうげき！ ${battle.monster_name} に ${playerDamage} ダメージ！\n${battle.monster_name} の反撃！ ${monsterDamage} ダメージを受けた。`
    };
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

    const changes = resolveAttack(lockedBattle, now);
    const battle = await finishBattle(lockedBattle, changes);
    return { changed: true, battle };
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
    isExpired,
    expireStaleBattles,
    findActiveBattleForPlayer,
    createSoloBattle,
    saveBattleMessageId,
    cancelBattle,
    attackBattle,
    grantBattleReward,
    applyBattleCooldown,
    BATTLE_COOLDOWN_MS
};
