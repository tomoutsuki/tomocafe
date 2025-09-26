const fs = require('fs');
const Member = require('../models/User');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = async (message) => {

	try {
		// ユーザー情報の取得
		let user = await Member.findOne({ user_id: message.author.id });

	if (!user) {

		// 新規ユーザー作成
		user = new Member({
			user_id: message.author.id,
			beans: config.STARTING_CURRENCY,
			items: config.STARTING_ITEMS
		});

		await user.save();

		// DM or サーバーで歓迎メッセージ
		await message.reply({ content: `☕ ようこそ **友カフェ** へ！ あなたには「ウェルカムコーヒー」と${config.STARTING_CURRENCY}豆がプレゼントされました！` });
	  	}
	} catch (err) {
	  	console.error("ユーザー登録時のエラー:", err);
	}
}