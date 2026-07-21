const User = require('../models/User');
const Monster = require('../models/Monster');
const {
    createSoloBattle,
    saveBattleMessageId,
    getBattleItemOptions
} = require('../services/battleService');
const { createBattlePayload } = require('../services/battleView');

const DEFAULT_MONSTER_ID = 'expresso_slime';

module.exports = async (message) => {
    const user = await User.findOne({ user_id: message.author.id });
    if (!user) {
        await message.reply({ content: '先に登録してください。' });
        return;
    }

    const monster = await Monster.findOne({ monster_id: DEFAULT_MONSTER_ID, is_boss: false });
    if (!monster) {
        await message.reply({
            content: 'モンスターデータがありません。対象環境向けのモンスターシードを一度実行してください。'
        });
        return;
    }

    const { battle, created, cooldownRemainingMs } = await createSoloBattle({
        player: user,
        playerId: message.author.id,
        playerDisplayName: message.member?.displayName || message.author.displayName || message.author.username,
        playerAvatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
        monster,
        guildId: message.guildId,
        channelId: message.channelId,
        // 管理者向けの !戦闘 はバランス検証用なので連続テストを許可する。
        ignoreCooldown: true
    });

    if (!created) {
        if (cooldownRemainingMs) {
            await message.reply({
                content: `☕ 少し休憩しよう。あと **${Math.ceil(cooldownRemainingMs / 60000)}分** で次の戦闘に挑戦できます。`
            });
            return;
        }
        const itemOptions = await getBattleItemOptions(battle);
        const payload = createBattlePayload(battle, new Date(), itemOptions);
        await message.reply({
            content: 'すでに進行中の戦闘があります。',
            embeds: payload.embeds
        });
        return;
    }

    const itemOptions = await getBattleItemOptions(battle);
    const reply = await message.reply(createBattlePayload(battle, new Date(), itemOptions));
    await saveBattleMessageId(battle.battle_id, reply.id);
};
