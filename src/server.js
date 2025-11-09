require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const ItemMaster = require('./models/ItemMaster');

const app = express();
// Heroku assigns a dynamic port via process.env.PORT; fall back to WEB_PORT or 3000 locally.
const PORT = process.env.PORT || process.env.WEB_PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Web Server: Mongo Connected");
    })
    .catch((error) => console.error("Web Server MongoDB Error:", error));

// Routes

// Home page - List all items
app.get('/', async (req, res) => {
    try {
        const items = await ItemMaster.find().sort({ item_id: 1 });
        res.render('index', { items });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).send('Error fetching items');
    }
});

// Create page - Show form to create new item
app.get('/items/new', (req, res) => {
    res.render('form', { item: null, action: 'create' });
});

// Create - POST new item
app.post('/items', async (req, res) => {
    try {
        const { item_id, title, description, rarity, image_url, market_price } = req.body;
        
        const newItem = new ItemMaster({
            item_id,
            title,
            description,
            rarity,
            image_url: image_url || undefined,
            market_price: market_price ? parseInt(market_price) : 0
        });
        
        await newItem.save();
        res.redirect('/');
    } catch (error) {
        console.error('Error creating item:', error);
        res.status(500).send('Error creating item: ' + error.message);
    }
});

// Edit page - Show form to edit existing item
app.get('/items/:id/edit', async (req, res) => {
    try {
        const item = await ItemMaster.findById(req.params.id);
        if (!item) {
            return res.status(404).send('Item not found');
        }
        res.render('form', { item, action: 'edit' });
    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).send('Error fetching item');
    }
});

// Update - PUT/POST update item
app.post('/items/:id', async (req, res) => {
    try {
        const { item_id, title, description, rarity, image_url, market_price } = req.body;
        
        await ItemMaster.findByIdAndUpdate(req.params.id, {
            item_id,
            title,
            description,
            rarity,
            image_url: image_url || undefined,
            market_price: market_price ? parseInt(market_price) : 0
        });
        
        res.redirect('/');
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).send('Error updating item: ' + error.message);
    }
});

// Delete - DELETE item
app.post('/items/:id/delete', async (req, res) => {
    try {
        await ItemMaster.findByIdAndDelete(req.params.id);
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).send('Error deleting item');
    }
});

// API endpoints for JSON responses
app.get('/api/items', async (req, res) => {
    try {
        const items = await ItemMaster.find().sort({ item_id: 1 });
        res.json(items);
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: 'Error fetching items' });
    }
});

app.get('/api/items/:id', async (req, res) => {
    try {
        const item = await ItemMaster.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({ error: 'Error fetching item' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🌐 Web Admin Panel running at http://localhost:${PORT}`);
});
