const mongoose = require('mongoose');

const MechanicSchema = new mongoose.Schema({
    pattern: {
        type: String,
        enum: ['heavy_attack_warning', 'weakness_exposure', 'interruptible', 'summon', 'item_weakness'],
        required: true
    },
    trigger: { type: String, default: 'future_phase' },
    message: { type: String, required: true },
    hint: { type: String, required: true }
}, { _id: false });

const MonsterSchema = new mongoose.Schema({
    monster_id: { type: String, required: true, unique: true, index: true },
    name_ja: { type: String, required: true },
    name_en: String,
    is_boss: { type: Boolean, default: false, index: true },
    rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'boss'], required: true },
    // 管理画面から公開を一時停止するためのフラグ。既存データは true として扱う。
    is_enabled: { type: Boolean, default: true, index: true },
    difficulty: { type: Number, min: 1, max: 5, required: true },
    category: String,
    battle_role: String,
    appearance: String,
    behavior: String,
    image_url: { type: String, default: null },
    // R2 の通常画像を実際に取得できた時だけ true にする。公開設定の反映前は
    // 旧画像 URL をフォールバックとして表示し、空のサムネイルを避ける。
    has_default_image: { type: Boolean, default: false },
    damage_image_url: { type: String, default: null },
    has_damage_diff: { type: Boolean, default: false },
    encounter_text: { type: String, required: true },
    defeat_text: { type: String, required: true },
    inspect_text: { type: String, required: true },
    tags: { type: [String], default: [] },
    drops: { type: [String], default: [] },
    battle: {
        max_hp: { type: Number, min: 1, required: true },
        attack: { type: Number, min: 1, required: true },
        defense: { type: Number, min: 0, required: true },
        reward_beans: { type: Number, min: 0, required: true },
        attack_text: { type: String, required: true }
    },
    mechanics: { type: [MechanicSchema], default: [] }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Monster', MonsterSchema, 'monsters');
