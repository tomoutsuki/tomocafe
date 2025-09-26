const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
	user_id: Number,
	join_date: { type: Date, default: Date.now },
	last_daily_claim: { type: Date, default: () => new Date(Date.now() - 24*60*60*1000) }, // 初回は登録24時間前に設定
	beans: { type: Number, default: 0 },
	items: [
		{
			// アイテムマスターを参照
			item_id: { type: String, ref: 'ItemMaster' },
			quantity: { type: Number, default: 1 } // 所持数
		}
	]
});

const User = mongoose.model('User', UserSchema, 'user');
module.exports = User;