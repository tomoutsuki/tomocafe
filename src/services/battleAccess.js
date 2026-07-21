function configuredDeveloperIds(value = process.env.DEV_BATTLE_USER_IDS || '') {
    return new Set(value.split(',').map((id) => id.trim()).filter(Boolean));
}

function isDevelopmentBattleUser(userId, appEnv = process.env.APP_ENV, allowedIds = configuredDeveloperIds()) {
    return appEnv === 'development' && allowedIds.has(String(userId));
}

module.exports = {
    configuredDeveloperIds,
    isDevelopmentBattleUser
};
