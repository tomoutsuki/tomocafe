const mongoose = require('mongoose');

const ItemMasterSchema = new mongoose.Schema({

	item_id: { type: String, unique: true },
	title: String,
	description: String,
	rarity: { type: String, enum: ['ノーマル', 'レア', 'スーパーレア', 'ウルトラレア'], default: 'ノーマル' },
	image_url: String, // アイテム画像のURL
	market_price: { type: Number, default: 0 } // ショップ価格
});

const ItemMaster = mongoose.model('ItemMaster', ItemMasterSchema, 'item_master');
module.exports = ItemMaster;