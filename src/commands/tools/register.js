const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const Member = require('../../models/User');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('【登録】友カフェに登録して、コーヒー豆をゲットしよう！'),
    async execute(interaction, client) {
        try {
            // ユーザー情報の取得
            let user = await Member.findOne({ user_id: interaction.user.id });

            if (!user) {
                // 新規ユーザー作成
                user = new Member({
                    user_id: interaction.user.id,
                    beans: config.STARTING_CURRENCY,
                    items: config.STARTING_ITEMS
                });

                await user.save();

                // 歓迎メッセージ
                await interaction.reply({ 
                    content: `☕ ようこそ **友カフェ** へ！ あなたには「ウェルカムコーヒー」と${config.STARTING_CURRENCY}豆がプレゼントされました！` 
                });
            } else {
                // すでに登録済みの場合
                await interaction.reply({ 
                    content: 'あなたはすでに友カフェに登録されています！☕',
                    ephemeral: true 
                });
            }
        } catch (err) {
            console.error("ユーザー登録時のエラー:", err);
            await interaction.reply({ 
                content: 'エラーが発生しました。もう一度お試しください。',
                ephemeral: true 
            });
        }
    }
}
