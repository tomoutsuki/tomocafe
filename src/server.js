const { appEnv, assertRequiredEnv, loadedEnvFile } = require('./config/environment');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { connectToMongo } = require('./config/mongo');
const ItemMaster = require('./models/ItemMaster');
const Monster = require('./models/Monster');

assertRequiredEnv(['MONGO_URI']);

console.log(`[bootstrap] Web environment: ${appEnv}${loadedEnvFile ? ` (${loadedEnvFile})` : ''}`);

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
connectToMongo()
    .then((mongoConnection) => {
        console.log(`Web Server: Mongo Connected via ${mongoConnection.connectionSource}`);
    })
    .catch((error) => console.error("Web Server MongoDB Error:", error));

// Routes

const ADMIN_PAGE_SIZE = 100;
const MONSTER_RARITIES = ['common', 'uncommon', 'rare', 'boss'];
const ITEM_RARITIES = ['ノーマル', 'レア', 'スーパーレア', 'ウルトラレア'];

function adminError(res, error, fallback) {
    console.error(fallback, error);
    const duplicate = error && error.code === 11000;
    const validation = error && error.name === 'ValidationError';
    res.status(duplicate || validation ? 400 : 500).json({
        error: duplicate ? 'IDはすでに使用されています。' : (validation ? error.message : fallback)
    });
}

function asString(value, fallback = '') {
    return typeof value === 'string' ? value.trim() : fallback;
}

function asStringList(value) {
    if (Array.isArray(value)) return value.map((item) => asString(item)).filter(Boolean);
    return asString(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function asBoolean(value, fallback = true) {
    return typeof value === 'boolean' ? value : fallback;
}

function asNonNegativeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function mongoSearch(search, fields) {
    const term = asString(search);
    if (!term) return {};
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { $or: fields.map((field) => ({ [field]: { $regex: escaped, $options: 'i' } })) };
}

function adminListOptions(req, allowedSorts, defaultSort) {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(ADMIN_PAGE_SIZE, Math.max(1, Number.parseInt(req.query.limit, 10) || ADMIN_PAGE_SIZE));
    const sortField = allowedSorts[req.query.sort] || defaultSort;
    const direction = req.query.direction === 'asc' ? 1 : -1;
    return { page, limit, sort: { [sortField]: direction } };
}

function defaultMonster(payload = {}) {
    const id = asString(payload.monster_id);
    const name = asString(payload.name_ja) || '新しいモンスター';
    return {
        monster_id: id,
        name_ja: name,
        name_en: asString(payload.name_en),
        is_boss: payload.rarity === 'boss',
        is_enabled: asBoolean(payload.is_enabled),
        rarity: MONSTER_RARITIES.includes(payload.rarity) ? payload.rarity : 'common',
        difficulty: Math.min(5, Math.max(1, asNonNegativeNumber(payload.difficulty, 1))),
        category: asString(payload.category),
        battle_role: asString(payload.battle_role),
        appearance: asString(payload.appearance),
        behavior: asString(payload.behavior),
        image_url: asString(payload.image_url) || null,
        encounter_text: asString(payload.encounter_text) || `${name}が現れた！`,
        defeat_text: asString(payload.defeat_text) || `${name}を倒した。`,
        inspect_text: asString(payload.inspect_text) || `${name}を観察する。`,
        tags: asStringList(payload.tags),
        drops: asStringList(payload.drops),
        battle: {
            max_hp: Math.max(1, asNonNegativeNumber(payload.battle && payload.battle.max_hp, 1)),
            attack: Math.max(1, asNonNegativeNumber(payload.battle && payload.battle.attack, 1)),
            defense: asNonNegativeNumber(payload.battle && payload.battle.defense, 0),
            reward_beans: asNonNegativeNumber(payload.battle && payload.battle.reward_beans, 0),
            attack_text: asString(payload.battle && payload.battle.attack_text) || '攻撃した！'
        },
        mechanics: Array.isArray(payload.mechanics) ? payload.mechanics : []
    };
}

function monsterUpdate(payload) {
    const update = {};
    const stringFields = ['monster_id', 'name_ja', 'name_en', 'category', 'battle_role', 'appearance', 'behavior', 'image_url', 'damage_image_url', 'encounter_text', 'defeat_text', 'inspect_text'];
    stringFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) update[field] = asString(payload[field]) || (field === 'image_url' ? null : '');
    });
    if (Object.prototype.hasOwnProperty.call(payload, 'rarity') && MONSTER_RARITIES.includes(payload.rarity)) {
        update.rarity = payload.rarity;
        update.is_boss = payload.rarity === 'boss';
    }
    ['is_enabled', 'is_boss', 'has_default_image', 'has_damage_diff'].forEach((field) => {
        if (typeof payload[field] === 'boolean') update[field] = payload[field];
    });
    ['tags', 'drops'].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) update[field] = asStringList(payload[field]);
    });
    if (Object.prototype.hasOwnProperty.call(payload, 'difficulty')) update.difficulty = Math.min(5, Math.max(1, asNonNegativeNumber(payload.difficulty, 1)));
    if (payload.battle && typeof payload.battle === 'object') {
        ['max_hp', 'attack', 'defense', 'reward_beans', 'attack_text'].forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(payload.battle, field)) {
                const key = `battle.${field}`;
                update[key] = field === 'attack_text' ? asString(payload.battle[field]) : asNonNegativeNumber(payload.battle[field], field === 'max_hp' || field === 'attack' ? 1 : 0);
            }
        });
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'mechanics') && Array.isArray(payload.mechanics)) {
        update.mechanics = payload.mechanics.map((mechanic) => ({
            pattern: asString(mechanic && mechanic.pattern),
            trigger: asString(mechanic && mechanic.trigger, 'future_phase'),
            message: asString(mechanic && mechanic.message),
            hint: asString(mechanic && mechanic.hint)
        }));
    }
    return update;
}

function itemPayload(payload = {}) {
    const update = {};
    ['item_id', 'title', 'description', 'category', 'acquisition_method', 'image_url'].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(payload, field)) update[field] = asString(payload[field]);
    });
    if (ITEM_RARITIES.includes(payload.rarity)) update.rarity = payload.rarity;
    if (typeof payload.is_enabled === 'boolean') update.is_enabled = payload.is_enabled;
    if (Object.prototype.hasOwnProperty.call(payload, 'market_price')) update.market_price = asNonNegativeNumber(payload.market_price);
    if (Object.prototype.hasOwnProperty.call(payload, 'battle_effect')) update.battle_effect = payload.battle_effect || null;
    return update;
}

app.get('/admin/data', (req, res) => {
    res.render('game-data');
});

app.get('/api/admin/monsters', async (req, res) => {
    try {
        const filter = mongoSearch(req.query.search, ['name_ja', 'monster_id', 'drops', 'tags', 'category', 'appearance']);
        if (MONSTER_RARITIES.includes(req.query.rarity)) filter.rarity = req.query.rarity;
        // 古いドキュメントには is_enabled が存在しないため、未設定は有効として扱う。
        if (req.query.enabled === 'true') filter.is_enabled = { $ne: false };
        if (req.query.enabled === 'false') filter.is_enabled = false;
        if (asString(req.query.category)) filter.category = asString(req.query.category);
        const minHp = Number(req.query.minHp);
        const maxHp = Number(req.query.maxHp);
        if (Number.isFinite(minHp) || Number.isFinite(maxHp)) {
            filter['battle.max_hp'] = {};
            if (Number.isFinite(minHp)) filter['battle.max_hp'].$gte = Math.max(0, minHp);
            if (Number.isFinite(maxHp)) filter['battle.max_hp'].$lte = Math.max(0, maxHp);
        }
        const options = adminListOptions(req, { name: 'name_ja', id: 'monster_id', hp: 'battle.max_hp', rarity: 'rarity', updatedAt: 'updatedAt' }, 'updatedAt');
        const [data, total] = await Promise.all([
            Monster.find(filter).sort(options.sort).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
            Monster.countDocuments(filter)
        ]);
        res.json({ data, pagination: { page: options.page, limit: options.limit, total } });
    } catch (error) { adminError(res, error, 'モンスターの取得に失敗しました。'); }
});

app.post('/api/admin/monsters', async (req, res) => {
    try {
        const monster = await Monster.create(defaultMonster(req.body));
        res.status(201).json(monster);
    } catch (error) { adminError(res, error, 'モンスターの作成に失敗しました。'); }
});

app.patch('/api/admin/monsters/:id', async (req, res) => {
    try {
        const monster = await Monster.findByIdAndUpdate(req.params.id, monsterUpdate(req.body), { new: true, runValidators: true });
        if (!monster) return res.status(404).json({ error: 'モンスターが見つかりません。' });
        res.json(monster);
    } catch (error) { adminError(res, error, 'モンスターの更新に失敗しました。'); }
});

app.delete('/api/admin/monsters/:id', async (req, res) => {
    try {
        const monster = await Monster.findByIdAndDelete(req.params.id);
        if (!monster) return res.status(404).json({ error: 'モンスターが見つかりません。' });
        res.status(204).end();
    } catch (error) { adminError(res, error, 'モンスターの削除に失敗しました。'); }
});

app.get('/api/admin/items', async (req, res) => {
    try {
        const filter = mongoSearch(req.query.search, ['title', 'item_id', 'description', 'category', 'acquisition_method', 'battle_effect.target_tags']);
        if (ITEM_RARITIES.includes(req.query.rarity)) filter.rarity = req.query.rarity;
        // 古いドキュメントには is_enabled が存在しないため、未設定は有効として扱う。
        if (req.query.enabled === 'true') filter.is_enabled = { $ne: false };
        if (req.query.enabled === 'false') filter.is_enabled = false;
        if (asString(req.query.category)) filter.category = asString(req.query.category);
        const options = adminListOptions(req, { name: 'title', id: 'item_id', hp: 'market_price', rarity: 'rarity', updatedAt: 'updatedAt' }, 'updatedAt');
        const [data, total] = await Promise.all([
            ItemMaster.find(filter).sort(options.sort).skip((options.page - 1) * options.limit).limit(options.limit).lean(),
            ItemMaster.countDocuments(filter)
        ]);
        res.json({ data, pagination: { page: options.page, limit: options.limit, total } });
    } catch (error) { adminError(res, error, 'アイテムの取得に失敗しました。'); }
});

app.post('/api/admin/items', async (req, res) => {
    try {
        const payload = itemPayload(req.body);
        const item = await ItemMaster.create({ item_id: payload.item_id || `item_${Date.now()}`, title: payload.title || '新しいアイテム', ...payload });
        res.status(201).json(item);
    } catch (error) { adminError(res, error, 'アイテムの作成に失敗しました。'); }
});

app.patch('/api/admin/items/:id', async (req, res) => {
    try {
        const item = await ItemMaster.findByIdAndUpdate(req.params.id, itemPayload(req.body), { new: true, runValidators: true });
        if (!item) return res.status(404).json({ error: 'アイテムが見つかりません。' });
        res.json(item);
    } catch (error) { adminError(res, error, 'アイテムの更新に失敗しました。'); }
});

app.delete('/api/admin/items/:id', async (req, res) => {
    try {
        const item = await ItemMaster.findByIdAndDelete(req.params.id);
        if (!item) return res.status(404).json({ error: 'アイテムが見つかりません。' });
        res.status(204).end();
    } catch (error) { adminError(res, error, 'アイテムの削除に失敗しました。'); }
});

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

app.get('/health', (req, res) => {
    res.json({
        environment: appEnv,
        status: 'ok'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🌐 Web Admin Panel running at http://localhost:${PORT} [${appEnv}]`);
});
