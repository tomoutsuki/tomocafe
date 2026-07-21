const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
	user_id: Number,
	join_date: { type: Date, default: Date.now },
	last_daily_claim: { type: Date, default: () => new Date(Date.now() - 24*60*60*1000) }, // 初回は登録24時間前に設定
	beans: { type: Number, default: 0 },
	// 戦闘用の基礎ステータス。現在HPは戦闘ごとに Battle 側へ保存する。
	stats: {
		max_hp: { type: Number, default: 30, min: 1 },
		attack: { type: Number, default: 10, min: 1 },
		defense: { type: Number, default: 2, min: 0 }
	},
	// 報酬の二重付与を防ぐための戦闘ID。
	battle_reward_ids: { type: [String], default: [] },
	battle_cooldown_until: { type: Date, default: null },
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
