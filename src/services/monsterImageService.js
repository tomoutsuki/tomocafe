const Monster = require('../models/Monster');
const { buildDamageMonsterImageUrl, normalizedR2Url } = require('./monsterImageUrls');

async function responseExists(response) {
    try {
        return response.ok;
    } finally {
        await response.body?.cancel?.();
    }
}

async function refreshMissingDamageDiffs({ r2Url = process.env.R2_URL, fetchImpl = global.fetch } = {}) {
    if (!normalizedR2Url(r2Url) || typeof fetchImpl !== 'function') return { checked: 0, found: 0 };

    const monsters = await Monster.find({ has_damage_diff: { $ne: true } }, { monster_id: 1 }).lean();
    let found = 0;

    for (const monster of monsters) {
        const damageUrl = buildDamageMonsterImageUrl(monster.monster_id, r2Url);
        try {
            const response = await fetchImpl(damageUrl, { method: 'GET' });
            if (!await responseExists(response)) continue;

            await Monster.updateOne(
                { _id: monster._id, has_damage_diff: { $ne: true } },
                { $set: { has_damage_diff: true, damage_image_url: damageUrl } }
            );
            found++;
        } catch (error) {
            console.warn(`Damage image check failed for ${monster.monster_id}: ${error.message}`);
        }
    }

    return { checked: monsters.length, found };
}

module.exports = { refreshMissingDamageDiffs };
