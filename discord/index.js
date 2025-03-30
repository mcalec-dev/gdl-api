const debug = require('debug')('gdl-api:discord');
const dotenv = require('dotenv');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { client, commands } = require('./random');

// Load environment variables from root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Create REST instance for registering commands
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Function to register commands
async function registerCommands() {
    try {
        debug('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        debug('Successfully registered application (/) commands.');
    } catch (error) {
        debug('Error registering commands:', error);
    }
}

// Register commands when bot is ready
client.once('ready', () => {
    debug('Discord bot is ready!');
    registerCommands();
});

// Start the bot
client.login(process.env.DISCORD_TOKEN);