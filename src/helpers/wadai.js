const fs = require('fs');

// Get Wadai data from JSON
const rawWadai = fs.readFileSync('./src/data/wadai.json');
const Wadai = JSON.parse(rawWadai);

module.exports = async (message) => {
    let wadaiChoice = Math.floor(Math.random() * Wadai.wadai.length);
    let wadaiResult = Wadai.wadai[wadaiChoice];

    await message.reply({
        content: wadaiResult
    });
};
