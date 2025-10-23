const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs');

// データベースモデルを参照
const User = require('../models/User');
const ItemMaster = require('../models/ItemMaster');

// 設定ファイルの読み込み
const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

//ショップイベント
const Shop = {

    // アイテム購入
    buyItem: async (interaction, args) => {

        // args: [ item_id, item_price, amount ]
        let item_id = args[0];
        let item_price = parseInt(args[1]);
        let amount = parseInt(args[2]);

        // マスターアイテムの取得
        const item = await ItemMaster.findOne({ item_id: item_id });
        if (!item) { console.log("Item Not Found"); return; }

        // ユーザーの取得
        const user = await User.findOne({ user_id: interaction.user.id });
        if (!user) { console.log("User Not Found"); return; }

        let nickname = interaction.member ? (interaction.member.nickname || interaction.member.displayName || interaction.user.username) : interaction.user.username;

        // 合計金額の計算
        let totalValue = item_price * amount;
        console.log(`Buy request by: ${nickname}. Item ID: ${item.item_id}, Total Value: ${totalValue}. User Beans: ${user.beans}.`);

        // 購入可能かのチェック
        if (user.beans < totalValue) { console.log(`Buy request rejected: Not enough beans. (User Beans: ${user.beans}, Required: ${totalValue})`); return; }

        // ユーザーの保有豆量の更新
        user.beans -= totalValue;

        // ユーザーがアイテムを既に持っているか確認
        let itemObject = user.items.find(item => item.item_id == item_id);

        if (typeof itemObject === 'undefined') {
            // アイテムを持っていない場合、新規追加
            itemObject = {
                item_id: item_id,
                quantity: amount
            };
            user.items.push(itemObject);
        } else {
            // 既に持っている場合、数量を更新
            itemObject.quantity += amount;
        }

        // データベースの情報を更新
        await user.save();


        /*ログ*/ console.log(`${nickname} successfully bought ${amount} ${item.title} for ${totalValue} beans. (User Beans Left: ${user.beans})`);

        let buyEmbed = new EmbedBuilder()
            .setColor(0xaa502f)
            .setTitle(`${nickname}さんが${item.title} × ${amount}を購入しました！`)
            .setThumbnail(interaction.user.displayAvatarURL())
            .setFields(
                { name: " ", value: `📦${item.title} x ${itemObject.quantity}`, inline: true},
                { name: " ", value: `${config.CURRENCY_EMOJI}×${user.beans}`, inline: true}
            );

        await interaction.reply({
            content: "ㅤ",
            embeds: [ buyEmbed ]
        });
        
    },
}

/* function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
} */

module.exports = Shop;