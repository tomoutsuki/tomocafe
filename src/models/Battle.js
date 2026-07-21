const mongoose = require('mongoose');

const BattleMechanicSchema = new mongoose.Schema({
    pattern: { type: String, required: true },
    trigger: { type: String, required: true },
    message: { type: String, required: true },
    hint: { type: String, required: true }
}, { _id: false });

const SpecialReactionSchema = new mongoose.Schema({
    active: { type: Boolean, default: false },
    pattern: { type: String, default: null },
    message: { type: String, default: null },
    mechanic_index: { type: Number, default: null }
}, { _id: false });

const BattleSchema = new mongoose.Schema({
    battle_id: { type: String, required: true, unique: true, index: true },
    // Discord snowflakes must remain strings; JavaScript Number loses precision.
    player_id: { type: String, required: true },
    player_display_name: { type: String, default: 'カフェのお客さま' },
    player_avatar_url: { type: String, default: null },
    guild_id: { type: String, default: null },
    channel_id: { type: String, default: null },
    message_id: { type: String, default: null },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'timed_out', 'won', 'lost'],
        default: 'active',
        index: true
    },
    monster_id: { type: String, required: true },
    monster_name: { type: String, required: true },
    monster_image_url: { type: String, default: null },
    has_default_image: { type: Boolean, default: false },
    monster_damage_image_url: { type: String, default: null },
    has_damage_diff: { type: Boolean, default: false },
    show_damage_image: { type: Boolean, default: false },
    monster_description: { type: String, default: '' },
    monster_inspect_text: { type: String, default: '' },
    monster_tags: { type: [String], default: [] },
    monster_mechanic_hints: { type: [String], default: [] },
    monster_mechanics: { type: [BattleMechanicSchema], default: [] },
    monster_is_boss: { type: Boolean, default: false },
    monster_difficulty: { type: Number, default: 1, min: 1 },
    monster_max_hp: { type: Number, required: true, min: 1 },
    monster_hp: { type: Number, required: true, min: 0 },
    monster_attack: { type: Number, required: true, min: 1 },
    monster_defense: { type: Number, required: true, min: 0 },
    reward_beans: { type: Number, required: true, min: 0 },
    player_max_hp: { type: Number, required: true, min: 1 },
    player_hp: { type: Number, required: true, min: 0 },
    player_attack: { type: Number, required: true, min: 1 },
    player_defense: { type: Number, required: true, min: 0 },
    turn: { type: Number, default: 0, min: 0 },
    inspected: { type: Boolean, default: false },
    next_attack_bonus: { type: Number, default: 0, min: 0 },
    inspection_message: { type: String, default: null },
    special_reaction: { type: SpecialReactionSchema, default: () => ({ active: false }) },
    used_mechanic_indices: { type: [Number], default: [] },
    last_action_message: { type: String, default: null },
    recent_logs: [{
        message: { type: String, required: true },
        created_at: { type: Date, required: true }
    }],
    expires_at: { type: Date, required: true, index: true },
    finished_at: { type: Date, default: null },
    action_lock: { type: Boolean, default: false },
    action_locked_at: { type: Date, default: null },
    reward_claimed: { type: Boolean, default: false }
}, {
    timestamps: true,
    versionKey: false
});

BattleSchema.index({ player_id: 1, status: 1, expires_at: 1 });
// 同一プレイヤーが連打しても、進行中の戦闘は必ず1件だけにする。
BattleSchema.index(
    { player_id: 1 },
    { unique: true, partialFilterExpression: { status: 'active' } }
);

module.exports = mongoose.model('Battle', BattleSchema, 'battles');
