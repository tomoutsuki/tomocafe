# Web Admin Panel Configuration

## Environment Variables

Add the following to your `.env` file:

```env
# MongoDB Connection
MONGO_URI=your_mongodb_connection_string

# Discord Bot Token
BOT_TOKEN=your_discord_bot_token

# Web Admin Panel Port (optional, defaults to 3000)
WEB_PORT=3000
```

## Running the Application

### Start Both Bot and Web Server
```bash
npm start
```

This will run both the Discord bot and the web admin panel concurrently.

### Run Individually

**Discord Bot Only:**
```bash
npm run bot
```

**Web Admin Panel Only:**
```bash
npm run web
```

## Accessing the Web Admin Panel

Once running, access the admin panel at:
```
http://localhost:3000
```

(or whatever port you set in WEB_PORT)

## Features

### Item Master CRUD Operations

- **Create**: Add new items with ID, title, description, rarity, image URL, and market price
- **Read**: View all items in a beautiful grid layout with image previews
- **Update**: Edit existing items
- **Delete**: Remove items with confirmation prompt

### API Endpoints

- `GET /api/items` - Get all items as JSON
- `GET /api/items/:id` - Get a specific item as JSON

### Rarity Levels

- ノーマル (Normal) - Green
- レア (Rare) - Blue
- スーパーレア (Super Rare) - Yellow
- ウルトラレア (Ultra Rare) - Red Gradient

## Screenshots

The admin panel features:
- 🎨 Beautiful gradient design
- 📱 Responsive layout
- 🖼️ Image preview support
- ✅ Form validation
- 🗑️ Confirmation dialogs
- ⚡ Real-time updates
