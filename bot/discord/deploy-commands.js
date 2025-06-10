const { REST, Routes } = require('discord.js');
const { commands } = require('./random.js');
const dotenv = require('dotenv');
const path = require('path');
const debug = require('debug')('gdl-api:discord');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function deployCommands() {
  try {
    console.log('Started refreshing global application (/) commands...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('Successfully registered global application commands.');
  } catch (error) {
    debug('Error registering global commands:', error);
    throw error;
  }
}

module.exports = { deployCommands };

if (require.main === module) { deployCommands().catch(debug); }