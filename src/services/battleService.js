const crypto = require('crypto');
const Battle = require('../models/Battle');

const DEFAULT_TIMEOUT_MINUTES = 30;
const LOCK_STALE_AFTER_MS = 15 * 1000;

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

async function createDevelopmentBattle({ player, playerId, monster, guildId, channelId, now = new Date() }) {
    const activeBattle = await findActiveBattleForPlayer(playerId || player.user_id, now);
    if (activeBattle) {
        return { battle: activeBattle, created: false };
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

module.exports = {
    createBattleDraft,
    getBattleTimeoutMs,
    getPlayerStats,
    isExpired,
    expireStaleBattles,
    findActiveBattleForPlayer,
    createDevelopmentBattle,
    saveBattleMessageId,
    cancelBattle
};
