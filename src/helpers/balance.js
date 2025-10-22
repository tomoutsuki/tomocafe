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

		// ユーザーの持ってるコーヒー豆数を返信
		await message.reply({ content: `あなたのコーヒー豆残高は ˚﹢.${config.CURRENCY_EMOJI}×${user.beans} .˚﹢ です！✨` });


	} catch (err) {
		console.error("ユーザー登録時のエラー:", err);
	}
}