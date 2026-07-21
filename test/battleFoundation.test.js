const test = require('node:test');
const assert = require('node:assert/strict');
const monsters = require('../src/data/monsters.json');
const {
    createBattleDraft,
    getPlayerStats,
    isExpired,
    calculateDamage,
    resolveAttack,
    getCooldownRemainingMs,
    chooseHealingItem,
    chooseRecommendedItem,
    resolveItemAction,
    buildInspectionMessage
} = require('../src/services/battleService');
const { parseBattleCustomId } = require('../src/services/battleCustomId');
const { createBattlePayload, createItemMenuPayload } = require('../src/services/battleView');

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
    assert.ok(draft.monster_tags.includes('コーヒー'));
    assert.ok(draft.expires_at > now);
});

test('legacy users receive safe default battle stats', () => {
    assert.deepEqual(getPlayerStats({}), { max_hp: 30, attack: 10, defense: 2 });
});

test('battle action IDs retain Discord snowflake precision', () => {
    assert.deepEqual(
        parseBattleCustomId('battle:attack:123e4567-e89b-12d3-a456-426614174000'),
        { action: 'attack', battleId: '123e4567-e89b-12d3-a456-426614174000' }
    );
    assert.equal(parseBattleCustomId('buy@1@coffee@10'), null);
});

test('phase 1 attack resolves player attack, counterattack, and victory', () => {
    const activeBattle = {
        monster_name: 'エスプレッソ・スライム',
        monster_hp: 28,
        monster_attack: 5,
        monster_defense: 1,
        player_hp: 30,
        player_attack: 10,
        player_defense: 2,
        turn: 0
    };
    const firstTurn = resolveAttack(activeBattle, new Date('2026-07-21T12:00:00.000Z'));
    assert.equal(calculateDamage(10, 1), 9);
    assert.equal(firstTurn.monster_hp, 19);
    assert.equal(firstTurn.player_hp, 27);
    assert.equal(firstTurn.status, 'active');
    assert.equal(firstTurn.turn, 1);

    const victory = resolveAttack({ ...activeBattle, monster_hp: 9, turn: 3 }, new Date('2026-07-21T12:01:00.000Z'));
    assert.equal(victory.monster_hp, 0);
    assert.equal(victory.player_hp, 30);
    assert.equal(victory.status, 'won');
    assert.match(victory.last_action_message, /倒した/);

    const defeat = resolveAttack({
        ...activeBattle,
        monster_attack: 32,
        player_hp: 4
    }, new Date('2026-07-21T12:02:00.000Z'));
    assert.equal(defeat.player_hp, 0);
    assert.equal(defeat.status, 'lost');
});

test('battle cooldown only blocks a future challenge', () => {
    const now = new Date('2026-07-21T12:00:00.000Z');
    assert.equal(getCooldownRemainingMs({}, now), 0);
    assert.equal(getCooldownRemainingMs({ battle_cooldown_until: '2026-07-21T12:04:00.000Z' }, now), 240000);
    assert.equal(getCooldownRemainingMs({ battle_cooldown_until: '2026-07-21T11:59:00.000Z' }, now), 0);
});

test('phase 2 active battle renders exactly attack, item, and inspect buttons', () => {
    const payload = createBattlePayload({
        battle_id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
        monster_name: 'エスプレッソ・スライム',
        monster_hp: 28,
        monster_max_hp: 28,
        player_hp: 30,
        player_max_hp: 30,
        reward_beans: 3,
        expires_at: '2026-07-21T12:30:00.000Z',
        last_action_message: null,
        inspected: false
    }, new Date('2026-07-21T12:00:00.000Z'), { hasUsableItems: true });

    const buttons = payload.components[0].toJSON().components;
    assert.match(payload.content, /こうげき/);
    assert.deepEqual(buttons.map((button) => button.custom_id), [
        'battle:attack:123e4567-e89b-12d3-a456-426614174000',
        'battle:item:123e4567-e89b-12d3-a456-426614174000',
        'battle:inspect:123e4567-e89b-12d3-a456-426614174000'
    ]);
    assert.ok(buttons.every((button) => button.disabled === false));
});

test('phase 2 selects useful items and resolves their one-tap effects', () => {
    const items = [
        { item_id: 'small', title: '小さなコーヒー', effect: { kind: 'heal', value: 4, target_tags: [] } },
        { item_id: 'large', title: '大きなコーヒー', effect: { kind: 'heal', value: 10, target_tags: [] } },
        { item_id: 'milk', title: '温かいミルク', effect: { kind: 'weakness', value: 5, target_tags: ['コーヒー'] } }
    ];
    assert.equal(chooseHealingItem(items, 24, 30).item_id, 'large');
    assert.equal(chooseRecommendedItem(items, ['コーヒー', '基本敵']).item_id, 'milk');

    const usedItem = resolveItemAction({
        monster_name: 'エスプレッソ・スライム',
        monster_hp: 28,
        monster_attack: 5,
        player_hp: 20,
        player_max_hp: 30,
        player_defense: 2,
        turn: 0
    }, items[0], new Date('2026-07-21T12:00:00.000Z'));
    assert.equal(usedItem.player_hp, 21); // 4回復後、3ダメージの反撃
    assert.equal(usedItem.status, 'active');

    const menu = createItemMenuPayload({
        battle_id: '123e4567-e89b-12d3-a456-426614174000',
        status: 'active',
        monster_name: 'エスプレッソ・スライム'
    }, { healingItem: items[0], recommendedItem: items[2] });
    assert.deepEqual(menu.components[0].toJSON().components.map((button) => button.custom_id), [
        'battle:heal:123e4567-e89b-12d3-a456-426614174000',
        'battle:recommend:123e4567-e89b-12d3-a456-426614174000',
        'battle:back:123e4567-e89b-12d3-a456-426614174000'
    ]);
});

test('inspect is limited to one use and makes the next attack stronger', () => {
    const battle = {
        monster_name: 'エスプレッソ・スライム',
        monster_description: 'デミタスカップからあふれるスライム。',
        monster_inspect_text: 'カップから飛び出した直後は無防備になる。',
        monster_mechanic_hints: ['今なら弱点を狙えそうだ。'],
        monster_tags: ['コーヒー'],
        next_attack_bonus: 3,
        monster_hp: 28,
        monster_attack: 5,
        monster_defense: 1,
        player_hp: 30,
        player_attack: 10,
        player_defense: 2,
        turn: 0
    };
    assert.match(buildInspectionMessage(battle), /温かいミルク/);
    assert.match(buildInspectionMessage(battle), /次のこうげきのダメージが3増える/);
    const result = resolveAttack(battle, new Date('2026-07-21T12:00:00.000Z'));
    assert.equal(result.monster_hp, 16); // (10 + 3) - 1
    assert.equal(result.next_attack_bonus, 0);
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
