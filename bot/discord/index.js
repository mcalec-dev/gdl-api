const debug = require('debug')('gdl-api:bot:discord')
const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })
const { Events } = require('discord.js')
const { client, getRandomImage, sendImageEmbed } = require('./random')
const { deployCommands } = require('./deploy-commands')
client.once(Events.ClientReady, async (c) => {
  debug(`Logged in as ${c.user.tag}`)
  try {
    await deployCommands()
    debug(`Global commands registered successfully`)
  } catch (error) {
    debug('Failed to register global commands:', error)
  }
  debug(`Serving ${c.guilds.cache.size} guilds`)
})
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return
  if (interaction.commandName === 'random') {
    try {
      await interaction.deferReply().catch(() => {
        debug('Failed to defer reply - interaction may have expired')
        return
      })
      const imageData = await getRandomImage()
      if (interaction.replied || !interaction.webhook) {
        debug('Interaction is no longer valid')
        return
      }
      await sendImageEmbed(interaction, imageData)
    } catch {
      if (!interaction.replied && interaction.webhook) {
        await interaction
          .editReply('Error fetching random image. Please try again later.')
          .catch((err) => debug('Failed to send error response:', err))
      }
    }
  }
})

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  debug('[Bot] Failed to start:', error)
  process.exit(1)
})
