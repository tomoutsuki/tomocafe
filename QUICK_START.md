# 🚀 Quick Start Guide - Web Admin Panel

## ✅ Setup Complete!

Your Item Master CRUD system is now ready to use.

## 📁 What Was Created

### Backend Files
- `src/server.js` - Express web server with CRUD routes
- `src/views/index.ejs` - Main items list page
- `src/views/form.ejs` - Create/Edit form page

### Frontend Files
- `src/public/css/style.css` - Beautiful styling
- `src/public/js/form.js` - Form validation and preview

### Configuration
- `package.json` - Updated with new scripts and dependencies
- `WEB_ADMIN.md` - Documentation

## 🎯 How to Use

### 1. Make sure your `.env` file has these variables:
```env
MONGO_URI=your_mongodb_connection_string
BOT_TOKEN=your_discord_bot_token
WEB_PORT=3000
```

### 2. Start the application:
```bash
npm start
```

This will start:
- ✅ Discord Bot (your existing bot)
- ✅ Web Admin Panel (http://localhost:3000)

### 3. Access the admin panel:
Open your browser and go to:
```
http://localhost:3000
```

## 🎨 Features

### Item Management
- ➕ **Create** new items with all details
- 📝 **Edit** existing items
- 🗑️ **Delete** items (with confirmation)
- 👀 **View** all items in a beautiful grid

### Item Properties
- **Item ID**: Unique identifier (e.g., `coffee_latte`)
- **Title**: Display name (e.g., `カフェラテ`)
- **Description**: Item description
- **Rarity**: ノーマル, レア, スーパーレア, ウルトラレア
- **Image URL**: Optional image link
- **Market Price**: Price in beans

### API Endpoints
- `GET /api/items` - Get all items (JSON)
- `GET /api/items/:id` - Get specific item (JSON)

## 🛠️ Individual Commands

Run only the bot:
```bash
npm run bot
```

Run only the web server:
```bash
npm run web
```

## 🎉 That's it!

Your web admin panel is ready to manage your Tomocafe items!

Enjoy! ☕
