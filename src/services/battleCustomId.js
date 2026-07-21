function parseBattleCustomId(customId) {
    const match = /^battle:(cancel):([0-9a-f-]{36})$/i.exec(customId);
    return match ? { action: match[1], battleId: match[2] } : null;
}

module.exports = { parseBattleCustomId };
