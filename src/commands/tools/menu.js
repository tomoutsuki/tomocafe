const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('menu')
        .setDescription('【メニュー】今日のおすすめドリンクとデザートをランダムで紹介します！'),
    async execute(interaction, client) {
        try {
            // Get cuisine data from JSON
            const rawCuisine = fs.readFileSync('./src/data/cuisine.json');
            const Cuisine = JSON.parse(rawCuisine);

            let drinkChoice = Math.floor(Math.random() * Cuisine.menu.drinks.length);
            let dessertChoice = Math.floor(Math.random() * Cuisine.menu.desserts.length);

            let drinkResult = Cuisine.menu.drinks[drinkChoice];
            let dessertResult = Cuisine.menu.desserts[dessertChoice];

            // First message
            await interaction.reply({ content: `今日のおすすめですか？えーと……` });

            // Wait 2 seconds
            await sleep(2000);

            // Follow-up message
            await interaction.followUp({ 
                content: `今日のおすすめのドリンクは『${drinkResult}』で、ラッキーデザートは『${dessertResult}』です！` 
            });

        } catch (err) {
            console.error("メニュー実行時のエラー:", err);
            await interaction.reply({ 
                content: 'エラーが発生しました。もう一度お試しください。',
                ephemeral: true 
            });
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
