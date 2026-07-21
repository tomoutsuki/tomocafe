const User = require('../models/User');
const Monster = require('../models/Monster');
const {
    createDevelopmentBattle,
    saveBattleMessageId
} = require('../services/battleService');
const { createBattlePayload } = require('../services/battleView');
const {
    configuredDeveloperIds,
    isDevelopmentBattleUser
} = require('../services/battleAccess');

const DEVELOPMENT_MONSTER_ID = 'expresso_slime';

module.exports = async (message) => {
    if (!isDevelopmentBattleUser(message.author.id)) {
        await message.reply({ content: 'この開発用コマンドは開発環境で許可されたユーザーのみ使用できます。' });
        return;
    }

    const user = await User.findOne({ user_id: message.author.id });
    if (!user) {
        await message.reply({ content: '先に登録してください。' });
        return;
    }

    const monster = await Monster.findOne({ monster_id: DEVELOPMENT_MONSTER_ID, is_boss: false });
    if (!monster) {
        await message.reply({
            content: 'モンスターデータがありません。`npm run monsters:seed:dev` を一度実行してください。'
        });
        return;
    }

    const { battle, created } = await createDevelopmentBattle({
        player: user,
        playerId: message.author.id,
        monster,
        guildId: message.guildId,
        channelId: message.channelId
    });

    if (!created) {
        await message.reply({
            content: `すでに進行中の戦闘があります。\n${createBattlePayload(battle).content}`
        });
        return;
    }

    const reply = await message.reply(createBattlePayload(battle));
    await saveBattleMessageId(battle.battle_id, reply.id);
};

module.exports.isDevelopmentBattleUser = isDevelopmentBattleUser;
module.exports.configuredDeveloperIds = configuredDeveloperIds;
