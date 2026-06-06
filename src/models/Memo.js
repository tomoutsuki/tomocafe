const mongoose = require('mongoose');

const MemoSchema = new mongoose.Schema({
    owner_id: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    checked: { type: Boolean, default: false }
}, {
    timestamps: true
});

const Memo = mongoose.model('Memo', MemoSchema, 'memo');

module.exports = Memo;
