const fs = require('fs');
const ItemMaster = require('../../models/ItemMaster');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = async (message, item) => {

    console.log(item);
	try {
		// アイテムマスターの取得
		let query = await ItemMaster.findOne({ item_id: item.item_id });
        if (query) return; // 既に存在する場合は何もしない


        //   レアリティ―表記が正しくない場合はエラーを返す
        const validRarities = ['ノーマル', 'レア', 'スーパーレア', 'ウルトラレア'];
        if (!validRarities.includes(item.rarity)) {
            await message.reply({ content: `無効なレアリティです: ${item.rarity}` });
            return;
        }

        // アイテムマスターに新しいアイテムを追加
        item = new ItemMaster({
            item_id: item.item_id,
            title: item.title,
            description: item.description,
            rarity: item.rarity,
            image_url: item.image_url || config.DEFAULT_ITEM_IMAGE_URL,
            market_price: item.market_price || 0
        });

        await item.save();
        console.log(`新しいアイテムが登録されました: ${item.title} (${item.item_id})`);
        await message.reply({ content: `新しいアイテムが登録されました: ${item.title} (${item.item_id})` });



	} catch (err) {
		console.error("ユーザー登録時のエラー:", err);
	}
}