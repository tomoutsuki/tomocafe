const { appEnv, assertRequiredEnv } = require('../config/environment');
const { connectToMongo, mongoose } = require('../config/mongo');
const { refreshMissingDamageDiffs } = require('../services/monsterImageService');

async function refresh() {
    assertRequiredEnv(['MONGO_URI', 'R2_URL']);
    const connection = await connectToMongo();
    const result = await refreshMissingDamageDiffs();
    console.log(`[monster damage refresh] ${appEnv} via ${connection.connectionSource}: ${result.found}/${result.checked} found.`);
}

refresh()
    .catch((error) => {
        console.error('[monster damage refresh] failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
