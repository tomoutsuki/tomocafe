const { appEnv, assertRequiredEnv } = require('../config/environment');
const { connectToMongo, mongoose } = require('../config/mongo');
const { refreshMissingDefaultImages, refreshMissingDamageDiffs } = require('../services/monsterImageService');

async function refresh() {
    assertRequiredEnv(['MONGO_URI', 'R2_URL']);
    const connection = await connectToMongo();
    const [defaultResult, damageResult] = await Promise.all([
        refreshMissingDefaultImages(),
        refreshMissingDamageDiffs()
    ]);
    console.log(`[monster image refresh] ${appEnv} via ${connection.connectionSource}: default ${defaultResult.found}/${defaultResult.checked}, damage ${damageResult.found}/${damageResult.checked} found.`);
}

refresh()
    .catch((error) => {
        console.error('[monster damage refresh] failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
