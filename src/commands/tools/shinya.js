const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

// Get Wadai data from JSON
const rawWadai = fs.readFileSync('./src/data/wadai.json');
const Wadai = JSON.parse(rawWadai);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shinya')
        .setDescription('【深夜】コマンドを使うと、店員ちゃんがカオスな深夜テンションの話題を提供します！'),
    async execute(interaction, client) {
        
        let wadaiChoice = Math.floor(Math.random() * Wadai.shinya.length);
        let wadaiResult = Wadai.shinya[wadaiChoice];

        const message = await interaction.deferReply({
            fetchReply: true
        });
        const newMessage = wadaiResult;
        await interaction.editReply({
            content: newMessage
        });
    }
}