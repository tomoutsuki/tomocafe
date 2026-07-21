const mongoose = require('mongoose');

const BattleSchema = new mongoose.Schema({
    battle_id: { type: String, required: true, unique: true, index: true },
    // Discord snowflakes must remain strings; JavaScript Number loses precision.
    player_id: { type: String, required: true },
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
    last_action_message: { type: String, default: null },
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
