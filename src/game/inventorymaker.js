const {
    EmbedBuilder
} = require('discord.js');

const Member = require('../models/User');
const ItemMaster = require('../models/ItemMaster');
const fs = require('fs');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);


module.exports = async (message) => {

    if (typeof message.member === 'undefined') {
        console.log("Member is undefined");
        return;
    }

    let nickname = message.member ? (message.member.nickname || message.member.displayName || message.user.username) : message.user.username;
    let avatarURL = message.member.displayAvatarURL();

    

    const inventoryEmbed = new EmbedBuilder()
        .setAuthor({
            name: " ",
            iconURL: avatarURL,
        })
        .setTitle(nickname)
        .setDescription("インベントリ\n· · ────── ꒰ঌ·✦·໒꒱ ────── · ·")
        .addFields(
            {
            name: "アイテム",
            value: "☕ プレーンカプチーノ\n☕ プレーンコーヒーパウダー",
            inline: true
            },
            {
            name: "所有個数",
            value: "×3\n×2",
            inline: true
            },
        )
        .setThumbnail(avatarURL)
        .setColor("#906ca7")
        .setFooter({
            text: "Tomocafe BOT v.0.0.1",
        })
        .setTimestamp();
    
        await message.channel.send({
            content: "ㅤ",
            embeds: [ inventoryEmbed ],
            //components: [ itemShopRow ]
        });
        await sleep(500);
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}