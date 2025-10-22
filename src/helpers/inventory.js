const InventoryMaker = require('../game/inventorymaker');

const User = require('../models/User');
const ItemMaster = require('../models/ItemMaster');

module.exports = async (message) => {

    try {
        let user = await User.findOne({ user_id: message.author.id });
        if (!user) {
            // まだ登録されていない場合の処理
            await message.reply({ content: `あなたはまだ登録されていないようです！ **『!register』** コマンドを使ってみてください！` });
            return;

        }

        await InventoryMaker(message);

    } catch (err) {
        console.error("INVENTORYエラー:", err);
    }
}