const fs = require('fs');

module.exports = async (message) => {
	// Get cuisine data from JSON
	const rawCuisine = fs.readFileSync('./src/data/cuisine.json');
	const Cuisine = JSON.parse(rawCuisine);

	let drinkChoice = Math.floor(Math.random() * Cuisine.menu.drinks.length);
	let dessertChoice = Math.floor(Math.random() * Cuisine.menu.desserts.length);

	let drinkResult = Cuisine.menu.drinks[drinkChoice];
	let dessertResult = Cuisine.menu.desserts[dessertChoice];

	let menuSentence = [
		`今日のおすすめですか？えーと……`,
		`今日のおすすめのドリンクは『${drinkResult}』で、ラッキーデザートは『${dessertResult}』です！`,
	];

	await message.channel.send(menuSentence[0]);
	await sleep(2000);
	await message.channel.send(menuSentence[1]);

}

function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
}