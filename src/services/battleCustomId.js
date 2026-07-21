function parseBattleCustomId(customId) {
    const match = /^battle:(attack|cancel|item|inspect|heal|recommend|back|special_dodge|special_guard|special_press|special_exploit|special_safe|special_interrupt|special_continue):([0-9a-f-]{36})$/i.exec(customId);
    return match ? { action: match[1], battleId: match[2] } : null;
}

module.exports = { parseBattleCustomId };
