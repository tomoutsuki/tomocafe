const InventoryMaker = require('../game/inventorymaker');

const User = require('../models/User');
const ItemMaster = require('../models/ItemMaster');

module.exports = async (message) => {

    try {
        await InventoryMaker(message);

    } catch (err) {
        console.error("INVENTORYエラー:", err);
    }
}