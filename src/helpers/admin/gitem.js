const fs = require('fs');
const User = require('../../models/User');
const ItemMaster = require('../../models/ItemMaster');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = async (message, userMention, item_id) => {

	try {
        // メンションからUser IDを抽出
        const user_id = userMention.replace(/<@!?(\d+)>/, '$1');

        // コマンド構文のチェック
        if (!user_id || !item_id) {
            await message.reply({ content: `無効なコマンド形式です。正しい形式: !gitem @ユーザーメンション アイテムID` });
            return;
        }

		// アイテムマスターの取得
		const item = await ItemMaster.findOne({ item_id: item_id });
        if (!item) { console.log("Item Not Found"); return; }

        // ユーザーの取得
        let user = await User.findOne({ user_id: user_id });
        if (!user) {
			// ユーザーが見つからない場合の処理
			await message.reply({ content: `あなたはまだ登録されていません。先に登録が必要なコマンドを実行してください。` });
			return;
		}

        // ユーザーがアイテムを既に持っているか確認
        let itemObject = user.items.find(item => item.item_id == item_id);

        if (typeof itemObject === 'undefined') {
            // アイテムを持っていない場合、新規追加
            itemObject = {
                item_id: item_id,
                quantity: 1
            };
            user.items.push(itemObject);
        } else {
            // 既に持っている場合、数量を更新
            itemObject.quantity++;
        }

        // データベースの情報を更新
                await user.save();

        let nickname = message.member ? (message.member.nickname || message.member.displayName || message.author.username) : message.author.username;
        /*ログ*/ console.log(`${nickname} successfully got ${item.title}.`);

        await user.save();
        console.log(`ユーザー ${message.author.id} にアイテム ${item.title} (${item.item_id}) を付与しました`);
        await message.reply({ content: `あなたはアイテムを手に入れた！: ${item.title} (${item.item_id})` });

	} catch (err) {
		console.error("ユーザー登録時のエラー:", err);
	}
}