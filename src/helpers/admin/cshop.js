const ShopMaker = require('../../game/shopmaker');

module.exports = async (message, item_id) => {
    await ShopMaker(message, item_id);
}