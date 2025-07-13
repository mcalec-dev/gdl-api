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
const axios = require('axios')
const debug = require('debug')('gdl-api:bot:discord')
const { HOST, BASE_PATH } = require('../../config')

// Update client configuration
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  allowedMentions: { parse: ['users'] },
  partials: ['CHANNEL'], // Required for DM support
})

// Update command configuration
const commands = [
  new SlashCommandBuilder()
    .setName('random')
    .setDescription('Get a random image from the gallery')
    .setDMPermission(true) // Enable DMs
    .setDefaultMemberPermissions(null) // Available to everyone
    .toJSON(),
]

const API_BASE_URL = `https://${HOST}${BASE_PATH}/api`

// Add scale tracking to URL parameters
let currentScale = 100 // Default scale

// Update the getActionRow function to include all buttons
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

// Add helper function to build URL with scale
function buildImageUrl(baseUrl, scale) {
  // If it's a full URL, use it directly
  const url = baseUrl.startsWith('http')
    ? new URL(baseUrl)
    : new URL(baseUrl, API_BASE_URL) // Fallback to primary URL

  url.searchParams.set('x', scale)
  return url.toString()
}

// Function to fetch random image
async function getRandomImage() {
  const urls = [API_BASE_URL]
  let lastError = null

  for (const baseUrl of urls) {
    try {
      debug(`Attempting to fetch from ${baseUrl}/random`)
      const response = await axios.get(`${baseUrl}/random`, {
        timeout: 60 * 1000, // 60 seconds timeout
      })

      debug(`Successfully fetched from ${baseUrl}`)
      const imageData = response.data

      // If the URL is relative, make it absolute
      if (imageData.url && !imageData.url.startsWith('http')) {
        const apiDomain = new URL(baseUrl).origin
        imageData.url = `${apiDomain}${imageData.url}`
        debug(`Converted relative URL to absolute: ${imageData.url}`)
      }

      return imageData
    } catch (error) {
      debug(`Failed to fetch from ${baseUrl}:`, error.message)
      debug(`Response status:`, error.response?.status)
      debug(`Response data:`, error.response?.data)
      lastError = error
    }
  }

  debug('All API endpoints failed')
  throw new Error(
    `Failed to fetch image from all endpoints: ${lastError?.message}`
  )
}

// Add helper function to check if file is video
function isVideoFile(filename) {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv']
  return videoExtensions.some((ext) => filename.toLowerCase().endsWith(ext))
}

// Update the sendImageEmbed function
async function sendImageEmbed(interaction, imageData) {
  // Validate interaction is still valid
  if (!interaction.webhook) {
    debug('Interaction is no longer valid')
    return
  }

  const imageUrl = new URL(imageData.url, 'https://api.mcalec.dev/').toString()
  const isVideo = isVideoFile(imageData.file)

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle(imageData.file)
    .setURL(imageUrl)
    .addFields(
      { name: 'Author', value: imageData.author, inline: true },
      { name: 'Platform', value: imageData.collection, inline: true },
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
      text: `Gallery-DL Random Image | Requested by ${interaction.user.tag}`,
    })

  if (!isVideo) {
    embed.setImage(imageUrl)
  }

  const actionRow = getActionRow()

  try {
    if (isVideo) {
      await interaction
        .editReply({ content: `Video: ${imageUrl}` })
        .catch(() => debug('Failed to edit reply with video'))

      if (interaction.webhook) {
        await interaction
          .followUp({ embeds: [embed], components: [actionRow] })
          .catch(() => debug('Failed to send follow-up embed'))
      }
    } else {
      await interaction
        .editReply({ embeds: [embed], components: [actionRow] })
        .catch(() => debug('Failed to edit reply with embed'))
    }
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

// Event handlers
client.once(Events.ClientReady, () => {
  debug('Discord bot is ready!')
})

// Handle button interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton() && !interaction.isChatInputCommand()) return

  try {
    if (interaction.isButton()) {
      // Get the original user from the footer text
      const footer = interaction.message.embeds[0].footer.text
      const originalUser = footer.split('Requested by ')[1]

      // Check if the interaction user is the original user
      if (interaction.user.tag !== originalUser) {
        await interaction.reply({
          content: 'This is not your message to interact with!',
          ephemeral: true,
        })
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
      const imageUrl = buildImageUrl(
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
          text: `Gallery-DL Random Image | Requested by ${originalUser}`,
        })

      if (!isVideo) {
        embed.setImage(imageUrl)
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
      try {
        await interaction.deferReply()
      } catch {
        debug('Failed to defer reply - interaction may have expired')
        return
      }
      const imageData = await getRandomImage()
      await sendImageEmbed(interaction, imageData)
    }
  } catch (error) {
    debug('Error handling interaction:', error)

    // Only try to respond if the interaction hasn't been responded to
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: 'Error fetching random image. Please try again later.',
          flags: [1 << 6], // Using flags instead of ephemeral
        })
      } catch (innerError) {
        debug('Error sending error response:', innerError)
      }
      return
    }

    // If the interaction was deferred, try to edit the reply
    if (interaction.deferred) {
      try {
        const actionRow = getActionRow()
        await interaction.editReply({
          content: 'Error fetching random image. Please try again later.',
          components: [actionRow],
        })
      } catch (innerError) {
        debug('Error editing error response:', innerError)
      }
    }
  }
})

// Export the client and required functions
module.exports = {
  client,
  commands,
  getRandomImage,
  sendImageEmbed,
}
