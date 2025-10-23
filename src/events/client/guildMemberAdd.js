const fs = require('fs');
const User = require('../../models/User');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // ボットの場合はスキップ
            if (member.user.bot) return;

            // 既に登録されているか確認
            const existingUser = await User.findOne({ user_id: member.user.id });
            
            // 新規ユーザーを自動登録
            if (!existingUser) {
                const newUser = new User({
                    user_id: member.user.id,
                    beans: config.STARTING_CURRENCY,
                    items: config.STARTING_ITEMS
                });

                await newUser.save();
                console.log(`新規ユーザー ${member.user.tag} (${member.user.id}) が自動登録されました`);

                // ウェルカムメッセージをDMで送信（オプション）
                try {
                    await member.send({ 
                        content: `☕ ようこそ **友カフェ** へ！\nあなたには「ウェルカムコーヒー」と${config.STARTING_CURRENCY}豆がプレゼントされました！\nサーバーで様々なコマンドを楽しんでね！✨` 
                    });
                } catch (dmError) {
                    // DMが送れない場合はコンソールにログを出すだけ
                    console.log(`ユーザー ${member.user.tag} にDMを送信できませんでした`);
                }
            } else {
                console.log(`ユーザー ${member.user.tag} は既に登録済みです`);
            }
        } catch (err) {
            console.error("guildMemberAdd イベント処理時のエラー:", err);
        }
    }
};
