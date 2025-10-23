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

// 設定ファイル
const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

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
const Daily     = require('./helpers/daily.js');
const Balance   = require('./helpers/balance.js');
const Inventory = require('./helpers/inventory.js');

client.commands = new Collection();
client.commandArray = [];

// 関数の自動読み込み
const functionFolders = fs.readdirSync('./src/functions');
for (const folder of functionFolders) {
    const functionFiles = fs
        .readdirSync(`./src/functions/${folder}`)
        .filter((file) => file.endsWith(".js"));
        for (const file of functionFiles)
            require(`./functions/${folder}/${file}`)(client);
            
}

// MongoDBへ接続
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Mongo Connected");
    })
    .catch((error) => console.error(error));


// メッセージ受信時の処理
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!') && !message.content.startsWith('！')) return;

    const [command, ...args] = message.content.substring(1).split(' ');

    // Command format:
    // !<command> <args[0]> <args[1]> ...

    // 登録が必要ないコマンド
    switch (command.toUpperCase()) {
        case "MENU":
        case "メニュー":
            await Menu(message);
            break;

        case "WADAI":
        case "話題":
            await Wadai(message);
            break;

        case "SHINYA":
        case "深夜":
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

    // 登録が必要なコマンドの場合、登録済みか確認（バックアップとして）
    // 通常はサーバー参加時に自動登録されるが、万が一の場合に備える
    if (!(await isRegistered(message.author.id))) {
        await autoRegister(message.author.id, message);
    }

    // 登録が必要なコマンド
    switch (command.toUpperCase()) {
        case "DAILY":
        case "デイリー":
        case "日給":
            await Daily(message);
            break;

        case "INVENTORY":
        case "インベントリ":
            await Inventory(message);
            break;

        case "BALANCE":
        case "バランス":
        case "残高":
            await Balance(message);
            break;

        default:
            break;
    }

    // 管理者コマンドの場合、自動登録を確認
    if (!(await isAdministrator(message))) {
        message.reply({ content: "このコマンドは管理者専用です。" });
        return;
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
            await Gitem(message, args[0], args[1]);
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

// 管理者か確認する関数
async function isAdministrator(message) {
    return message.member.roles.cache.some(role => role.name === config.ADMIN_ROLE_NAME);
}

// 自動登録関数
async function autoRegister(user_id, message) {
    try {
        // 新規ユーザー作成
        const user = new User({
            user_id: user_id,
            beans: config.STARTING_CURRENCY,
            items: config.STARTING_ITEMS
        });

        await user.save();

        // 歓迎メッセージ
        await message.reply({ content: `☕ ようこそ **友カフェ** へ！ あなたには「ウェルカムコーヒー」と${config.STARTING_CURRENCY}豆がプレゼントされました！` });
    } catch (err) {
        console.error("ユーザー自動登録時のエラー:", err);
    }
}