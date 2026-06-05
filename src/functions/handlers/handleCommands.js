const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');

module.exports = (client) => {
    client.handleCommands = async() => {
        const commandFolders = fs.readdirSync('./src/commands');
        const { commands, commandArray } = client;
        
        for (const folder of commandFolders) {
            const commandFiles = fs
                .readdirSync(`./src/commands/${folder}`)
                .filter((file) => file.endsWith(".js"));
            for (const file of commandFiles) {
                const command = require(`../../commands/${folder}/${file}`);
                commands.set(command.data.name, command);
                commandArray.push(command.data.toJSON());
                console.log(`Command ${command.data.name} has been passed.`);
                
            }
        }

        const shouldRegisterCommands = process.env.REGISTER_COMMANDS !== 'false';
        if (!shouldRegisterCommands) {
            console.log('Skipping slash command registration because REGISTER_COMMANDS=false.');
            return;
        }

        const clientId = process.env.CLIENT_ID;
        const guildId = process.env.GUILD_ID;
        const commandScope = (process.env.COMMAND_SCOPE || 'guild').toLowerCase();
        const rest = new REST({ version: "9" }).setToken(process.env.BOT_TOKEN);

        try {
            console.log("Started refreshing application (/) commands.");

            if (commandScope === 'global') {
                await rest.put(Routes.applicationCommands(clientId), {
                    body: commandArray,
                });
            } else {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
                    body: commandArray,
                });
            }

            console.log('Successfully reloaded application (/) commands.');

        } catch (error) {
            if (error.code === 50001) {
                console.warn(
                    [
                        'Skipping slash command registration: Discord returned 50001 Missing Access.',
                        'Check that BOT_TOKEN and CLIENT_ID belong to the same Discord application,',
                        'and that the dev bot is installed in the target guild with the applications.commands scope.',
                        `Current scope: ${commandScope}${guildId ? `, guild: ${guildId}` : ''}`
                    ].join(' ')
                );
                return;
            }

            console.error('Failed to register application commands:', error);
        }
    }
}
