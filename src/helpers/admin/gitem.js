const fs = require('fs');
const User = require('../../models/User');
const ItemMaster = require('../../models/ItemMaster');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = async (message, item_id) => {

    console.log(item_id);

	try {
		// アイテムマスターの取得
		let item = await ItemMaster.findOne({ item_id: item_id });
        if (!item) return; // 既に存在しない場合は何もしない

        let user = await User.findOne({ user_id: message.author.id });
        if (!user) {
			// ユーザーが見つからない場合の処理
			await message.reply({ content: `あなたはまだ登録されていません。先に登録が必要なコマンドを実行してください。` });
			return;
		}
        // アイテムをユーザーに付与
        user.items.push({
            item_id: item.item_id,
            title: item.title,
            description: item.description,
            rarity: item.rarity,
            obtained_at: new Date()
        });

        await user.save();
        console.log(`ユーザー ${message.author.id} にアイテム ${item.title} (${item.item_id}) を付与しました`);
        await message.reply({ content: `あなたはアイテムを手に入れた！: ${item.title} (${item.item_id})` });

	} catch (err) {
		console.error("ユーザー登録時のエラー:", err);
	}
}