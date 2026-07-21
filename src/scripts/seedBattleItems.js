const path = require('path');
const { appEnv, assertRequiredEnv } = require('../config/environment');
const { connectToMongo, mongoose } = require('../config/mongo');
const ItemMaster = require('../models/ItemMaster');
const source = require(path.join('..', 'data', 'battleItems.json'));

async function seedBattleItems() {
    assertRequiredEnv(['MONGO_URI']);
    const connection = await connectToMongo();
    const operations = source.items.map((item) => ({
        updateOne: {
            filter: { item_id: item.item_id },
            update: { $set: item },
            upsert: true
        }
    }));
    const result = await ItemMaster.bulkWrite(operations, { ordered: true });
    console.log(
        `[battle item seed] ${appEnv} via ${connection.connectionSource}: ${source.items.length} items `
        + `(${result.upsertedCount} inserted, ${result.modifiedCount} updated).`
    );
}

seedBattleItems()
    .catch((error) => {
        console.error('[battle item seed] failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
