const dotenv = require('dotenv')
const path = require('path')
dotenv.config({ path: path.join(__dirname, '..', '.env') })
const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')
const botToken = process.env.TELEGRAM_BOT_TOKEN
const bot = new TelegramBot(botToken, { polling: true })
const debug = require('debug')('gdl-api:bot:telegram')
if (!botToken) {
  console.error('TELEGRAM_BOT_TOKEN is not set in the environment variables')
  process.exit(1)
}
let randomImageResponse = null
const fetchRandomImage = async () => {
  try {
    const response = await axios.get(
      'https://alt-api.mcalec.dev/gdl/api/random'
    )
    if (response.status !== 200) {
      throw new Error(`API responded with status ${response.status}`)
    }
    return response.data
  } catch (error) {
    console.error('Error fetching random image:', error.message)
    if (error.response) {
      console.error('API response:', error.response.data)
    }
    return null
  }
}
async function isUrlAccessible(url) {
  try {
    const response = await axios.head(url)
    return response.status === 200
  } catch (error) {
    console.error('Error checking URL accessibility:', error.message)
    return false
  }
}
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  const finalFileSize = `${Math.round((size * 100) / 100)} ${units[unitIndex]}`
  return `${finalFileSize}`
}
bot.onText(/\/random/, async (msg) => {
  const chatId = msg.chat.id
  debug('Received random command from', msg.from.username)

  try {
    randomImageResponse = await fetchRandomImage()
    if (randomImageResponse) {
      const mediaUrl = randomImageResponse.url
      const size = formatFileSize(randomImageResponse.size)
      const caption = `Size: ${size}\n${randomImageResponse.author} on ${randomImageResponse.collection}`

      // Check if the URL is accessible
      const isAccessible = await isUrlAccessible(mediaUrl)
      if (!isAccessible) {
        throw new Error('Media URL is not accessible')
      }

      // Check if the file is a video
      const isVideo = /\.(mp4|webm|mov)$/i.test(mediaUrl)

      if (isVideo) {
        // Send as video
        await bot.sendVideo(chatId, mediaUrl, { caption: caption })
      } else {
        // Send as photo
        await bot.sendPhoto(chatId, mediaUrl, { caption: caption })
      }

      bot.sendMessage(chatId, 'Rerun command here: /random')
    } else {
      throw new Error('Failed to fetch random media')
    }
  } catch (error) {
    console.error('Error in /random command:', error.message)
    bot.sendMessage(chatId, `Error: ${error.message}. Please try again later.`)
  }
})
bot.on('polling_error', (error) => {
  console.error('Polling error:', error)
})
console.log('Telegram bot is running')
