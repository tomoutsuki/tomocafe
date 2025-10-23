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

    // Fetch user data from database
    const user = await Member.findOne({ user_id: message.author.id });

    // Build item names and quantities strings
    let itemList = '· · ────── ꒰ঌ·✦·໒꒱ ────── · ·\n\n';
    
    if (user.items && user.items.length > 0) {
        // Fetch all item details from ItemMaster
        for (const item of user.items) {
            const itemInfo = await ItemMaster.findOne({ item_id: item.item_id });
            
            if (itemInfo) {
                itemList += `📦 ${itemInfo.title}  ×${item.quantity}\n`;
            }
        }
        
        itemList += `\n· · ────── ꒰ঌ·✦·໒꒱ ────── · ·`;
        
    } else {
        // No items in inventory
        itemList = 'アイテムがありません';
    }

    const inventoryEmbed = new EmbedBuilder()
        .setAuthor({
            name: nickname,
            iconURL: avatarURL,
        })
        .setTitle(" ")
        .setDescription(`· · ────── ꒰ঌ·✦·໒꒱ ────── · ·`)
        .addFields(
            {
            name: "‎　　　.インベントリ.\n",
            value: itemList,
            inline: true
            }
        )
        //.setThumbnail(avatarURL)
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