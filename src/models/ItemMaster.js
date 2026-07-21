const mongoose = require('mongoose');

const BattleEffectSchema = new mongoose.Schema({
    kind: { type: String, enum: ['heal', 'weakness'], required: true },
    // heal は回復量、weakness はモンスターへ与えるダメージ。
    value: { type: Number, required: true, min: 1 },
    // weakness 用。モンスターの tags のいずれかに一致したときだけおすすめ候補になる。
    target_tags: { type: [String], default: [] }
}, { _id: false });

const ItemMasterSchema = new mongoose.Schema({

	item_id: { type: String, unique: true },
	title: String,
	description: String,
	rarity: { type: String, enum: ['ノーマル', 'レア', 'スーパーレア', 'ウルトラレア'], default: 'ノーマル' },
	image_url: String, // アイテム画像のURL
	market_price: { type: Number, default: 0 }, // ショップ価格
	battle_effect: { type: BattleEffectSchema, default: null }
});

const ItemMaster = mongoose.model('ItemMaster', ItemMasterSchema, 'item_master');
module.exports = ItemMaster;
