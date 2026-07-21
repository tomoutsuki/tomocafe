const { appEnv, assertRequiredEnv, loadedEnvFile } = require('./config/environment');
const fs = require('fs');
const { connectToMongo, mongoose } = require('./config/mongo');

const shouldRegisterCommands = process.env.REGISTER_COMMANDS !== 'false';
const commandScope = (process.env.COMMAND_SCOPE || 'guild').toLowerCase();
const requiredEnv = ['BOT_TOKEN', 'MONGO_URI'];

if (shouldRegisterCommands) {
    requiredEnv.push('CLIENT_ID');
    if (commandScope !== 'global') {
        requiredEnv.push('GUILD_ID');
    }
}

assertRequiredEnv(requiredEnv);

console.log(`[bootstrap] Bot environment: ${appEnv}${loadedEnvFile ? ` (${loadedEnvFile})` : ''}`);

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const User = require('./models/User');

const rawConfig = fs.readFileSync('./src/data/config.json');
const config = JSON.parse(rawConfig);

const Citem = require('./helpers/admin/citem');
const Cshop = require('./helpers/admin/cshop');
const Gbeans = require('./helpers/admin/gbeans');
const Gitem = require('./helpers/admin/gitem');
const Guide = require('./helpers/admin/guide');

const Menu = require('./helpers/menu.js');
const Wadai = require('./helpers/wadai.js');
const Shinya = require('./helpers/shinya.js');

const Daily = require('./helpers/daily.js');
const Balance = require('./helpers/balance.js');
const Inventory = require('./helpers/inventory.js');
const Memo = require('./helpers/memo.js');
const Battle = require('./helpers/battle.js');
const { expireStaleBattles } = require('./services/battleService');
const { refreshMissingDefaultImages, refreshMissingDamageDiffs } = require('./services/monsterImageService');

client.commands = new Collection();
client.commandArray = [];

const functionFolders = fs.readdirSync('./src/functions');
for (const folder of functionFolders) {
    const functionFiles = fs
        .readdirSync(`./src/functions/${folder}`)
        .filter((file) => file.endsWith('.js'));

    for (const file of functionFiles) {
        require(`./functions/${folder}/${file}`)(client);
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!') && !message.content.startsWith('！')) return;

    const commandBody = message.content.slice(1).trim();
    if (!commandBody) return;

    const [command, ...args] = commandBody.split(/\s+/u);
    const commandArgText = commandBody.slice(command.length).trim();

    switch (command.toUpperCase()) {
        // ここから汎用コマンド
        case 'MENU':
        case 'メニュー':
            await Menu(message);
            return;

        case 'WADAI':
        case '話題':
            await Wadai(message);
            return;

        case 'SHINYA':
        case '深夜':
            await Shinya(message);
            return;

        case 'PING':
            await message.reply({
                content: 'PONGだよ！'
            });
            return;

        default:
            break;
    }

    // ここからユーザーコマンド
    if (!(await isRegistered(message.author.id))) {
        await autoRegister(message.author.id, message);
    }

    switch (command.toUpperCase()) {
        case 'DAILY':
        case 'デイリー':
        case '日給':
            await Daily(message);
            return;

        case 'INVENTORY':
        case 'インベントリ':
            await Inventory(message);
            return;

        case 'BALANCE':
        case 'バランス':
        case '残高':
            await Balance(message);
            return;

        case 'メモ追加':
            await Memo.addMemo(message, commandArgText);
            return;

        case 'メモ':
            await Memo.showMemos(message);
            return;

        case 'メモ削除':
            await Memo.showDeleteMemos(message);
            return;

        default:
            break;
    }


    // ここから管理者コマンド
    if (!(await isAdministrator(message))) {
        await message.reply({ content: 'このコマンドは管理者専用です。' });
        return;
    }

    switch (command.toUpperCase()) {
        case 'CITEM': {
            const item = {
                item_id: args[0],
                title: args[1],
                description: args[2],
                rarity: args[3],
                image_url: args[4],
                market_price: args[5]
            };
            await Citem(message, item);
            return;
        }

        case 'CSHOP':
            await Cshop(message, args[0]);
            return;

        case 'GBEANS':
            await Gbeans(message, args[0], args[1]);
            return;

        case 'GITEM':
            await Gitem(message, args[0], args[1]);
            return;

        case 'GUIDE':
            await Guide(message);
            return;

        case 'BATTLE':
        case '戦闘':
            await Battle(message);
            return;

        default:
            break;
    }
});

client.handleEvents();

async function isRegistered(user_id) {
    const user = await User.findOne({ user_id });
    return typeof user !== 'undefined' && user !== null;
}

async function isAdministrator(message) {
    return message.member.roles.cache.some((role) =>
        config.ADMIN_ROLE_NAMES.includes(role.name)
    );
}

async function autoRegister(user_id, message) {
    try {
        const user = new User({
            user_id,
            beans: config.STARTING_CURRENCY,
            items: config.STARTING_ITEMS
        });

        await user.save();

        await message.reply({
            content: `☕ ようこそ **友カフェ** へ！ あなたには「ウェルカムコーヒー」と${config.STARTING_CURRENCY}豆がプレゼントされました！`
        });
    } catch (err) {
        console.error('ユーザー自動登録エラー:', err);
    }
}

async function startBot() {
    try {
        console.log(`Starting bot process [${appEnv}]...`);

        const mongoConnection = await connectToMongo();
        console.log(`Mongo Connected via ${mongoConnection.connectionSource}`);

        await expireStaleBattles();
        refreshMissingDefaultImages()
            .then(({ checked, found }) => console.log(`Monster default image check: ${found}/${checked} found.`))
            .catch((error) => console.error('Monster default image check failed:', error));
        refreshMissingDamageDiffs()
            .then(({ checked, found }) => console.log(`Monster damage image check: ${found}/${checked} found.`))
            .catch((error) => console.error('Monster damage image check failed:', error));
        const battleSweep = setInterval(() => {
            expireStaleBattles().catch((error) => console.error('Battle timeout sweep failed:', error));
        }, 5 * 60 * 1000);
        battleSweep.unref();

        mongoose.connection.on('error', (error) => {
            console.error('MongoDB connection error:', error);
        });

        await client.login(process.env.BOT_TOKEN);
        console.log('Discord login completed');

        await client.handleCommands();
    } catch (error) {
        console.error('Fatal startup error:', error);
        process.exit(1);
    }
}

startBot();
