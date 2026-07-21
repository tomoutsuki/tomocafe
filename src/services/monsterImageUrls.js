function normalizedR2Url(value = process.env.R2_URL) {
    return typeof value === 'string' && value.trim()
        ? value.trim().replace(/\/+$/, '')
        : null;
}

function buildDefaultMonsterImageUrl(monsterId, r2Url = process.env.R2_URL) {
    const baseUrl = normalizedR2Url(r2Url);
    return baseUrl ? `${baseUrl}/default/${monsterId}.png` : null;
}

function buildDamageMonsterImageUrl(monsterId, r2Url = process.env.R2_URL) {
    const baseUrl = normalizedR2Url(r2Url);
    return baseUrl ? `${baseUrl}/damage/${monsterId}.png` : null;
}

module.exports = {
    normalizedR2Url,
    buildDefaultMonsterImageUrl,
    buildDamageMonsterImageUrl
};
