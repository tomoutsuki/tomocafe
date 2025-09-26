const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('pingを使うと、店員ちゃんがpongを返します！'),
    async execute(interaction, client) {
        const message = await interaction.deferReply({
            fetchReply: true
        });
        const newMessage = `PONG! なんちゃって、このサーバーの遅延は${client.ws.ping}です。`;
        await interaction.editReply({
            content: newMessage
        });
    }
}