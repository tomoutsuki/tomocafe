const fs = require('fs');
const Shop = require('../../game/shopManager');

module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const { commands } = client;
            const { commandName } = interaction;
            const command = commands.get(commandName);

            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(error);
                await interaction.reply({
                    content: 'something went wrong while executing this command',
                    ephemeral: true
                });
            }
        }
        if (interaction.isStringSelectMenu()) {
            State.handleRegistration(interaction);
            /*switch (interaction.customId) {
                //First-Time Language Register

                case "firstLanguageSet":
                    console.log(member.id, "selected", selectedValue);
                    //await interaction.message.delete();
                    Event.welcomeMessage(member, selectedValue);
                    break;

                //First-Time Faction Register
                case "firstFactionSet":
                    selectedValue = interaction.values[0];
                    console.log(member.id, "selected", selectedValue);
                    await interaction.message.delete();

                    await Player.findOneAndUpdate({
                        user_id: interaction.user.id
                    },
                    {
                        faction: selectedValue
                    });

                    break;

                //Normal Faction Set (Not First Time)
                case "normalFactionSet": 

                    selectedValue = interaction.values[0];
                    console.log(member.id, "selected", selectedValue);
                    await interaction.message.delete();

                    break;
            }*/
        }
        if (interaction.isButton()) {

            let [customId, ...args] = interaction.customId.split('@');
            console.log(args);

            // Format: "buy@<amount>@<item_id>@<price>"
            if (customId == "buy") {
                await Shop.buyItem(interaction, args);
            }
        }
    }
}