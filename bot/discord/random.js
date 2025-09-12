const {
  Client,
  Events,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} = require('discord.js')
const debug = require('debug')('gdl-api:bot:discord')
const { HOST, BASE_PATH, NAME } = require('../../config')
const axios = require('axios')
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  allowedMentions: { parse: ['users'] },
  partials: ['CHANNEL'],
})
const commands = [
  new SlashCommandBuilder()
    .setName('random')
    .setDescription('Get a random image from the gallery')
    .toJSON(),
]
const getActionRow = () => {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('regenerate')
      .setLabel('🔃')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('scaleDown')
      .setLabel('⬇️ (-25%)')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('scaleUp')
      .setLabel('⬆️ (+50%)')
      .setStyle(ButtonStyle.Secondary)
  )
}
async function buildImageUrl(baseUrl, scale) {
  const apiHost = await HOST
  const apiBase = `${apiHost}${BASE_PATH}/api/`
  const url = baseUrl.startsWith('http')
    ? new URL(baseUrl)
    : new URL(baseUrl, apiBase)
  url.searchParams.set('x', scale)
  return url.toString()
}
async function getRandomImage() {
  const apiHost = await HOST
  const baseUrl = `https://${apiHost}${BASE_PATH}/api/random`
  try {
    debug('Attempting to fetch from:', baseUrl)
    const response = await axios.get(baseUrl, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GDL-api-BOT/1.0',
      },
      timeout: 60 * 1000,
    })
    debug('Successfully fetched from:', baseUrl)
    return response.data
  } catch (error) {
    debug('Failed to fetch from:', baseUrl, error.message)
    throw new Error(error)
  }
}
function isVideoFile(filename) {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
  return videoExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
}
let currentScale = 100
async function sendImageEmbed(interaction, imageData) {
  if (!interaction.webhook) {
    debug('Interaction is no longer valid')
    return
  }
  let imageUrl = imageData.url
  const isVideo = isVideoFile(imageData.file)
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(imageData.file)
    .setURL(imageUrl)
    .addFields(
      { name: 'Author', value: imageData.author, inline: true },
      {
        name: 'Platform',
        value: imageData.collection,
        inline: true,
      },
      {
        name: 'Size',
        value: `${Math.round(imageData.size / 1024)} KB`,
        inline: true,
      },
      { name: 'Type', value: isVideo ? 'Video' : 'Image', inline: true },
      { name: 'Scale', value: `${currentScale}%`, inline: true }
    )
    .setTimestamp()
    .setFooter({
      text: `${NAME} | Requested by ${interaction.user?.tag}`,
    })
  if (!isVideo && imageUrl) {
    embed.setImage(imageUrl)
  }
  const actionRow = getActionRow()
  try {
    await interaction.editReply({
      content: isVideo ? `Video: ${imageUrl}` : undefined,
      embeds: [embed],
      components: [actionRow],
    })
  } catch (error) {
    debug('Error sending embed:', error)
    if (interaction.webhook) {
      await interaction
        .editReply({
          content: 'Error fetching random image. Please try again later.',
          components: [],
        })
        .catch(() => debug('Failed to send error response'))
    }
  }
}
client.once(Events.ClientReady, () => {
  debug('Discord bot is ready!')
})
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isChatInputCommand()) return
  try {
    if (interaction.isButton()) {
      const footer = interaction.message.embeds[0].footer.text
      const originalUser = footer.split('Requested by ')[1]
      if (interaction.user.tag !== originalUser) {
        await interaction.reply({
          content: 'This is not your message to interact with!',
          ephemeral: true,
        })
        return
      }
      if (interaction.replied || interaction.deferred) {
        debug('Interaction already replied/deferred')
        return
      }
      await interaction.deferUpdate()
      let imageData
      let newScale = currentScale
      switch (interaction.customId) {
        case 'scaleUp':
          newScale = Math.min(500, currentScale + 50)
          imageData = interaction.message.embeds[0]
          break
        case 'scaleDown':
          newScale = Math.max(25, currentScale - 25)
          imageData = interaction.message.embeds[0]
          break
        case 'regenerate':
          newScale = 100
          imageData = await getRandomImage()
          break
      }
      currentScale = newScale
      const imageUrl = await buildImageUrl(
        interaction.customId === 'regenerate' ? imageData.url : imageData.url,
        currentScale
      )
      const isVideo = isVideoFile(
        interaction.customId === 'regenerate' ? imageData.file : imageData.title
      )
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(
          interaction.customId === 'regenerate'
            ? imageData.file
            : imageData.title
        )
        .setURL(imageUrl)
        .addFields(
          {
            name: 'Author',
            value:
              interaction.customId === 'regenerate'
                ? imageData.author
                : interaction.message.embeds[0].fields[0].value,
            inline: true,
          },
          {
            name: 'Platform',
            value:
              interaction.customId === 'regenerate'
                ? imageData.collection
                : interaction.message.embeds[0].fields[1].value,
            inline: true,
          },
          {
            name: 'Size',
            value:
              interaction.customId === 'regenerate'
                ? `${Math.round(imageData.size / 1024)} KB`
                : interaction.message.embeds[0].fields[2].value,
            inline: true,
          },
          { name: 'Type', value: isVideo ? 'Video' : 'Image', inline: true },
          { name: 'Scale', value: `${currentScale}%`, inline: true }
        )
        .setTimestamp()
        .setFooter({
          text: `${NAME} | Requested by ${originalUser}`,
        })
      if (!isVideo) {
        embed.setImage(imageUrl)
      }
      if (!interaction.deferred) {
        debug('Interaction is no longer deferred')
        return
      }
      await interaction.editReply({
        content: isVideo ? `Video: ${imageUrl}` : null,
        embeds: [embed],
        components: [getActionRow()],
      })
    }
    if (
      interaction.isChatInputCommand() &&
      interaction.commandName === 'random'
    ) {
      if (interaction.replied || interaction.deferred) {
        debug('Interaction already replied/deferred')
        return
      }
      try {
        await interaction.deferReply()
        debug('Successfully deferred reply')
      } catch (error) {
        debug('Failed to defer reply - interaction may have expired', error)
        return
      }
      try {
        const imageData = await getRandomImage()
        await sendImageEmbed(interaction, imageData)
      } catch (apiError) {
        debug('API Error:', apiError.message)
        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply({
            content:
              "Sorry, I couldn't fetch an image right now. The API might be experiencing issues. Please try again later.",
            components: [],
          })
        }
      }
    }
  } catch (error) {
    debug('Error handling interaction:', error)
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: 'An error occurred while processing your request.',
          ephemeral: true,
        })
      } catch (innerError) {
        debug('Error sending error response:', innerError)
      }
    } else if (interaction.deferred && !interaction.replied) {
      try {
        await interaction.editReply({
          content: 'An error occurred while processing your request.',
          components: [],
        })
      } catch (innerError) {
        debug('Error editing error response:', innerError)
      }
    }
  }
})
module.exports = {
  client,
  commands,
  getRandomImage,
  sendImageEmbed,
}
