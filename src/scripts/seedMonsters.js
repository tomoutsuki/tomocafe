const path = require('path');
const { appEnv, assertRequiredEnv } = require('../config/environment');
const { connectToMongo, mongoose } = require('../config/mongo');
const Monster = require('../models/Monster');
const source = require(path.join('..', 'data', 'monsters.json'));
const { buildDefaultMonsterImageUrl, normalizedR2Url } = require('../services/monsterImageUrls');

function validateSeed(monsters) {
    const normal = monsters.filter((monster) => !monster.is_boss);
    const bosses = monsters.filter((monster) => monster.is_boss);

    if (normal.length !== 14 || bosses.length !== 6) {
        throw new Error(`Expected 14 normal monsters and 6 bosses, received ${normal.length} and ${bosses.length}.`);
    }

    for (const monster of monsters) {
        const expectedMechanics = monster.is_boss ? 3 : 1;
        if (monster.mechanics.length !== expectedMechanics) {
            throw new Error(`${monster.monster_id} must define ${expectedMechanics} mechanics.`);
        }
    }
}

async function seedMonsters() {
    assertRequiredEnv(['MONGO_URI', 'R2_URL']);
    validateSeed(source.monsters);

    const connection = await connectToMongo();
    const r2Url = normalizedR2Url();
    const operations = source.monsters.map((monster) => ({
        updateOne: {
            filter: { monster_id: monster.monster_id },
            update: {
                $set: {
                    ...monster,
                    image_url: buildDefaultMonsterImageUrl(monster.monster_id, r2Url)
                },
                $setOnInsert: {
                    has_default_image: false,
                    has_damage_diff: false,
                    damage_image_url: null
                },
                // R2 移行前の補助 URL を残さず、画像 URL は R2 のものに統一する。
                $unset: { fallback_image_url: '' }
            },
            upsert: true
        }
    }));

    const result = await Monster.bulkWrite(operations, { ordered: true });
    console.log(
        `[monster seed] ${appEnv} via ${connection.connectionSource}: ${source.monsters.length} monsters `
        + `(${result.upsertedCount} inserted, ${result.modifiedCount} updated).`
    );
}

seedMonsters()
    .catch((error) => {
        console.error('[monster seed] failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
