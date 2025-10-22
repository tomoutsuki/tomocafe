require('dotenv').config();
const fs = require('fs');

const mongoose = require('mongoose');

const {Client, Collection, Events, GatewayIntentBits} = require('discord.js');
const client = new Client({ intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
]});

// ユーザーデータベースモデル
const User = require('./models/User');

// 管理者コマンド
const Citem     = require('./helpers/admin/citem');
const Cshop     = require('./helpers/admin/cshop');
const Gbeans    = require('./helpers/admin/gbeans');
const Gitem     = require('./helpers/admin/gitem');

// 登録が必要ないコマンド
const Menu      = require('./helpers/menu.js');
const Wadai     = require('./helpers/wadai.js');
const Shinya    = require('./helpers/shinya.js');

// 登録が必要なコマンド
const Register  = require('./helpers/register.js');
const Daily     = require('./helpers/daily.js');
const Balance   = require('./helpers/balance.js');
const Inventory = require('./helpers/inventory.js');

client.commands = new Collection();
client.commandArray = [];

const functionFolders = fs.readdirSync('./src/functions');
for (const folder of functionFolders) {
    const functionFiles = fs
        .readdirSync(`./src/functions/${folder}`)
        .filter((file) => file.endsWith(".js"));
        for (const file of functionFiles)
            require(`./functions/${folder}/${file}`)(client);
            
}

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Mongo Connected");
    })
    .catch((error) => console.error(error));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const [command, ...args] = message.content.substring(1).split(' ');

    // Command format:
    // !<command> <args[0]> <args[1]> ...

    // 登録が必要ないコマンド
    switch (command.toUpperCase()) {
        case "MENU":
            await Menu(message);
            break;

        case "WADAI":
            await Wadai(message);
            break;

        case "SHINYA":
            await Shinya(message);
            break;

        case "PING":
            await message.reply({
                content: 'PONGだよ!'
            });
            break;
        default:
            break;
    }

    if (!(await isRegistered(message.author.id))) {
        await message.reply({ content: `あなたはまだ登録されていないようです！ **『!register』** コマンドを使ってみてください！` });
        return;
    }

    // 登録が必要なコマンド
    switch (command.toUpperCase()) {
        case "REGISTER":
            await Register(message);
            break;

        case "DAILY":
            await Daily(message);
            break;

        case "INVENTORY":
            await Inventory(message);
            break;

        case "BALANCE":
            await Balance(message);
            break;

        case "PING":
            await message.reply({
                content: 'PONGだよ!'
            });
            break;
        default:
            break;
    }

    // 管理者コマンド
    switch (command.toUpperCase()) {
        case "CITEM":
            // args [item_id, title, description, rarity, image_url, market_price]
            let item = {
                item_id: args[0],
                title: args[1],
                description: args[2],
                rarity: args[3],
                image_url: args[4],
                market_price: args[5]
            };
            await Citem(message, item);
            break;

        case "CSHOP":
            // args [item_id]
            await Cshop(message, args[0]);
            break;

        case "GBEANS":
            // args [user_id, amount]
            await Gbeans(message, args[0], args[1]);
            break;

        case "GITEM":
            // args [user_id, item_id]
            await Gitem(message, args[0]);
            break;

        default:
            break;
    }
});

client.handleEvents();
client.handleCommands();

client.login(process.env.BOT_TOKEN);

// ユーザー登録済みか確認する関数
async function isRegistered(user_id) {
    let user = await User.findOne({ user_id: user_id });
    return (typeof user !== 'undefined' && user !== null);
}