const fs = require('fs');
const User = require('../models/User');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = async (message) => {

	try {
		// ユーザー情報の取得
		let user = await User.findOne({ user_id: message.author.id });

		if (!user) {
			// まだ登録されていない場合の処理
			await message.reply({ content: `あなたはまだ登録していないようです！ **『!register』** コマンドを使ってみてください！` });
			return;

		}

		// デイリー報酬の付与
		const now = new Date();
		if (user.last_daily_claim) {
			const diff = now - user.last_daily_claim;
			const hours = diff / (1000 * 60 * 60);

			if (hours < 24) {
				const remaining = (24 - hours).toFixed(1);
				await message.reply({ content: `⏳ まだ受け取れません！あと **${remaining}時間** 待ってね！` });
				return;
			}
		}

		// ランダムなコーヒー豆
		const beans = Math.floor(Math.random() * (config.DAILY_CURRENCY_MAX - config.DAILY_CURRENCY_MIN + 1)) + config.DAILY_CURRENCY_MIN;

		// ユーザー情報の更新
		user.beans += beans;
		user.last_daily_claim = now;
		await user.save();

		await message.reply({ content: `あなたは ˚﹢.${config.CURRENCY_EMOJI}×${beans} .˚﹢ のデイリーボーナスを受け取りました！✨` });


	} catch (err) {
		console.error("ユーザー登録時のエラー:", err);
	}
}