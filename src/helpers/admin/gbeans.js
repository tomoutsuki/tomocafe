const fs = require('fs');
const User = require('../../models/User');
const ItemMaster = require('../../models/ItemMaster');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = async (message, userMention, quantity) => {

    // メンションからUser IDを抽出
    const user_id = userMention.replace(/<@!?(\d+)>/, '$1');
    if (!user_id || isNaN(quantity) || quantity <= 0) {
        await message.reply({ content: `無効なコマンド形式です。正しい形式: !Gbeans @ユーザーメンション 数量` });
        return;
    }
    
    try {
        let user = await User.findOne({ user_id: user_id });
        if (!user) {
            // まだ登録されていない場合の処理
            await message.reply({ content: `あなたはまだ登録されていないようです！ **『!register』** コマンドを使ってみてください！` });
            return;

        }
        user.beans += parseInt(quantity);
        await user.save();

        console.log(`ユーザー ${user.user_id} に ${quantity}豆を付与しました`);
        await message.reply({ content: `${userMention}さんに${quantity}豆を付与しました！` });

    } catch (err) {
        console.error("GBEANSエラー:", err);
    }
}