const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const ItemMaster = require('../models/ItemMaster');
const fs = require('fs');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);


module.exports = async (message, item_id) => {
    
    itemInfo = await ItemMaster.findOne({ item_id : item_id});
    itemShopEmbed = new EmbedBuilder()
        .setColor(0xaa502f)
        .setTitle(itemInfo.title)
        .setDescription(itemInfo.description)
        .setThumbnail(itemInfo.image_url)
        .addFields(
            { name: ' ', value: `${config.CURRENCY_EMOJI}×${itemInfo.market_price}` }
        );

        buyOneButton = new ButtonBuilder()
            .setCustomId(`buy@${itemInfo.item_id}@${itemInfo.market_price}@1`)
            .setLabel('買う')
            .setStyle(ButtonStyle.Secondary);

        itemShopRow = new ActionRowBuilder()
            .addComponents(buyOneButton);
    
    await message.channel.send({
        content: "ㅤ",
        embeds: [ itemShopEmbed ],
        components: [ itemShopRow ]
    });
    await sleep(500);
}

async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
