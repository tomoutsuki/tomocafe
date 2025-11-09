/**
 * combined.js
 * Unified entry point for Heroku Basic Dyno
 * Runs both Discord bot and Express web server in a single process
 */

require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

// ============================================================================
// DISCORD BOT SETUP (from bot.js)
// ============================================================================

const { Client, Collection, GatewayIntentBits } = require('discord.js');
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

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
const Guide     = require('./helpers/admin/guide');

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

// メッセージ受信時の処理
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!') && !message.content.startsWith('！')) return;

    const [command, ...args] = message.content.substring(1).split(' ');

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

    // 登録が必要なコマンドの場合、登録済みか確認
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
            await Cshop(message, args[0]);
            break;

        case "GBEANS":
            await Gbeans(message, args[0], args[1]);
            break;

        case "GITEM":
            await Gitem(message, args[0], args[1]);
            break;

        case "GUIDE":
            await Guide(message);
            break;

        default:
            break;
    }
});

client.handleEvents();
client.handleCommands();

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
        const user = new User({
            user_id: user_id,
            beans: config.STARTING_CURRENCY,
            items: config.STARTING_ITEMS
        });

        await user.save();
        await message.reply({ 
            content: `☕ ようこそ **友カフェ** へ！ あなたには「ウェルカムコーヒー」と${config.STARTING_CURRENCY}豆がプレゼントされました！` 
        });
    } catch (err) {
        console.error("ユーザー自動登録時のエラー:", err);
    }
}

// ============================================================================
// EXPRESS WEB SERVER SETUP (Minimal - Health Check Only)
// ============================================================================

const express = require('express');

const app = express();
// Heroku requires binding to process.env.PORT
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;

// Minimal middleware
app.use(express.json());

// Root endpoint - Simple status
app.get('/', (req, res) => {
    res.status(200).json({
        service: 'Tomo Cafe Discord Bot',
        status: 'running',
        bot: client.isReady() ? 'connected' : 'disconnected'
    });
});

// Health check endpoint for Heroku and monitoring
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        bot: client.isReady() ? 'connected' : 'disconnected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Catch-all for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================================================
// UNIFIED STARTUP SEQUENCE
// ============================================================================

async function startApplication() {
    try {
        console.log('🚀 Starting Tomo Cafe Combined Application...');
        
        // Connect to MongoDB (shared by both bot and web server)
        console.log('📦 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB Connected');
        
        // Start Express Server (minimal health check only)
        console.log(`🌐 Starting minimal web server on port ${PORT}...`);
        app.listen(PORT, () => {
            console.log(`✅ Health check endpoint ready on port ${PORT}`);
        });
        
        // Start Discord Bot
        console.log('🤖 Starting Discord Bot...');
        await client.login(process.env.BOT_TOKEN);
        console.log('✅ Discord Bot Connected');
        
        console.log('🎉 All services started successfully!');
        
    } catch (error) {
        console.error('❌ Fatal error during startup:', error);
        process.exit(1);
    }
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
    // Keep process running but log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Give time to log before exiting
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('⚠️  SIGTERM received, shutting down gracefully...');
    
    // Close Discord bot connection
    if (client.isReady()) {
        await client.destroy();
        console.log('✅ Discord Bot disconnected');
    }
    
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('⚠️  SIGINT received, shutting down gracefully...');
    
    if (client.isReady()) {
        await client.destroy();
        console.log('✅ Discord Bot disconnected');
    }
    
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');
    
    process.exit(0);
});

// ============================================================================
// START THE APPLICATION
// ============================================================================

startApplication();
