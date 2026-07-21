const test = require('node:test');
const assert = require('node:assert/strict');
const monsters = require('../src/data/monsters.json');
const {
    createBattleDraft,
    getPlayerStats,
    isExpired
} = require('../src/services/battleService');
const { parseBattleCustomId } = require('../src/services/battleCustomId');
const { isDevelopmentBattleUser } = require('../src/services/battleAccess');

test('monster seed has 14 normal monsters, 6 bosses, and reusable mechanic counts', () => {
    const normal = monsters.monsters.filter((monster) => !monster.is_boss);
    const bosses = monsters.monsters.filter((monster) => monster.is_boss);

    assert.equal(normal.length, 14);
    assert.equal(bosses.length, 6);
    assert.ok(normal.every((monster) => monster.mechanics.length === 1));
    assert.ok(bosses.every((monster) => monster.mechanics.length === 3));
    assert.ok(monsters.monsters.every((monster) => monster.battle.max_hp > 0 && monster.battle.reward_beans >= 0));
});

test('battle draft snapshots player and monster stats for restart-safe storage', () => {
    const now = new Date('2026-07-21T12:00:00.000Z');
    const monster = monsters.monsters.find((entry) => entry.monster_id === 'expresso_slime');
    const draft = createBattleDraft({
        player: { user_id: '123456789012345678', stats: { max_hp: 34, attack: 11, defense: 3 } },
        playerId: '123456789012345678',
        monster,
        guildId: 'guild-id',
        channelId: 'channel-id',
        now
    });

    assert.equal(draft.player_id, '123456789012345678');
    assert.equal(draft.player_hp, 34);
    assert.equal(draft.monster_hp, monster.battle.max_hp);
    assert.equal(draft.reward_beans, monster.battle.reward_beans);
    assert.ok(draft.expires_at > now);
});

test('legacy users receive safe default battle stats', () => {
    assert.deepEqual(getPlayerStats({}), { max_hp: 30, attack: 10, defense: 2 });
});

test('battle ownership IDs and action IDs retain Discord snowflake precision', () => {
    assert.equal(isDevelopmentBattleUser('123456789012345678', 'development', new Set(['123456789012345678'])), true);
    assert.equal(isDevelopmentBattleUser('123456789012345679', 'development', new Set(['123456789012345678'])), false);
    assert.equal(isDevelopmentBattleUser('123456789012345678', 'production', new Set(['123456789012345678'])), false);
    assert.deepEqual(
        parseBattleCustomId('battle:cancel:123e4567-e89b-12d3-a456-426614174000'),
        { action: 'cancel', battleId: '123e4567-e89b-12d3-a456-426614174000' }
    );
    assert.equal(parseBattleCustomId('buy@1@coffee@10'), null);
});

test('expired battles are recognized without relying on bot process memory', () => {
    assert.equal(isExpired({ status: 'active', expires_at: '2026-07-21T11:59:59.000Z' }, new Date('2026-07-21T12:00:00.000Z')), true);
    assert.equal(isExpired({ status: 'cancelled', expires_at: '2026-07-21T11:59:59.000Z' }, new Date('2026-07-21T12:00:00.000Z')), false);
});

test('battle model keeps a database-level one-active-battle constraint', () => {
    const Battle = require('../src/models/Battle');
    assert.ok(Battle.schema.indexes().some(([keys, options]) => (
        keys.player_id === 1
        && options.unique === true
        && options.partialFilterExpression?.status === 'active'
    )));
});
