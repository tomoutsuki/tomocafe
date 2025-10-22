const ShopMaker = require('../../game/shopmaker');
const ItemMaster = require('../../models/ItemMaster');

module.exports = async (message, item_id) => {
    // Check if the user wants to create shops for all items
    if (item_id && item_id.toLowerCase() === 'all') {
        // Fetch all items from the ItemMaster database
        const allItems = await ItemMaster.find({});
        
        if (allItems.length === 0) {
            await message.reply('アイテムマスターにアイテムが見つかりませんでした。');
            return;
        }
        
        await message.reply(`${allItems.length}個のアイテムのショップを作成します...`);
        
        // Create shops for all items
        for (const item of allItems) {
            await ShopMaker(message, item.item_id);
        }
        
        await message.reply(`すべてのショップの作成が完了しました！（${allItems.length}個のアイテム）`);
    } else {
        // Create shop for a single item
        await ShopMaker(message, item_id);
    }
}