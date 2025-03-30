const { Client, Events, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const debug = require('debug')('gdl-api:discord');
const config = require('../config');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Define commands
const commands = [
    new SlashCommandBuilder()
        .setName('random')
        .setDescription('Get a random image from the gallery')
        .toJSON()
];

// Use API configuration from main config
const API_BASE_URL = 'https://api.mcalec.dev/gdl/api';

// Command prefix
const PREFIX = '!';

// Add scale tracking to URL parameters
let currentScale = 100; // Default scale

// Update the getActionRow function to include all buttons
const getActionRow = () => {
    return new ActionRowBuilder()
        .addComponents(
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
        );
};

// Add helper function to build URL with scale
function buildImageUrl(baseUrl, scale) {
    const url = new URL(baseUrl, 'https://api.mcalec.dev/');
    url.searchParams.set('x', scale);
    return url.toString();
}

// Function to fetch random image
async function getRandomImage() {
    try {
        const response = await axios.get(`${API_BASE_URL}/random`);
        debug('Random image response:', response.data);
        
        // Ensure the URL is properly formatted
        const imageData = response.data;
        if (!imageData.url.startsWith('http')) {
            imageData.url = `https://api.mcalec.dev${imageData.url}`;
        }
        
        return imageData;
    } catch (error) {
        debug('Error fetching random image:', error);
        throw error;
    }
}

// Add helper function to check if file is video
function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// Update the sendImageEmbed function
async function sendImageEmbed(interaction, imageData) {
    const imageUrl = new URL(imageData.url, 'https://api.mcalec.dev/').toString();
    const isVideo = isVideoFile(imageData.file);
    
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(imageData.file)
        .setURL(imageUrl)
        .addFields(
            { name: 'Collection', value: imageData.collection, inline: true },
            { name: 'Size', value: `${Math.round(imageData.size / 1024)} KB`, inline: true },
            { name: 'Type', value: isVideo ? 'Video' : 'Image', inline: true },
            { name: 'Scale', value: `${currentScale}%`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Gallery-DL Random Image' });

    if (!isVideo) {
        embed.setImage(imageUrl);
    }

    const actionRow = getActionRow();

    try {
        if (isVideo) {
            if (interaction.deferred) {
                await interaction.editReply({ content: `Video: ${imageUrl}` });
                await interaction.followUp({ embeds: [embed], components: [actionRow] });
            } else {
                await interaction.reply({ content: `Video: ${imageUrl}` });
                await interaction.followUp({ embeds: [embed], components: [actionRow] });
            }
        } else {
            if (interaction.deferred) {
                await interaction.editReply({ embeds: [embed], components: [actionRow] });
            } else {
                await interaction.reply({ embeds: [embed], components: [actionRow] });
            }
        }
    } catch (error) {
        debug('Error sending embed:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Error fetching random image. Please try again later.',
                flags: [1 << 6]
            });
        } else {
            await interaction.editReply({
                content: 'Error fetching random image. Please try again later.',
                components: []
            });
        }
    }
}

// Event handlers
client.once(Events.ClientReady, () => {
    console.log('Discord bot is ready!');
});

// Update the MessageCreate event handler
client.on(Events.MessageCreate, async message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const command = message.content.slice(PREFIX.length).toLowerCase();
    
    if (command === 'random') {
        debug(`User ${message.author.tag} ran command: ${message.content}`);
        console.log(`[Command] ${message.author.tag} used !random in #${message.channel.name}`);
        
        const loadingMessage = await message.reply('Loading...');
        
        try {
            const imageData = await getRandomImage();
            const imageUrl = new URL(imageData.url, 'https://api.mcalec.dev/').toString();
            const isVideo = isVideoFile(imageData.file);
            
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(imageData.file)
                .setURL(imageUrl)
                .addFields(
                    { name: 'Collection', value: imageData.collection, inline: true },
                    { name: 'Size', value: `${Math.round(imageData.size / 1024)} KB`, inline: true },
                    { name: 'Type', value: isVideo ? 'Video' : 'Image', inline: true },
                    { name: 'Scale', value: '100%', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Gallery-DL Random Image' });

            // Only set image for non-video files
            if (!isVideo) {
                embed.setImage(imageUrl);
            }

            const actionRow = getActionRow();
            
            if (isVideo) {
                await loadingMessage.edit(`Video: ${imageUrl}`);
                await message.channel.send({ embeds: [embed], components: [actionRow] });
            } else {
                await loadingMessage.edit({ 
                    embeds: [embed], 
                    components: [actionRow] 
                });
            }
        } catch (error) {
            debug('Error handling random command:', error);
            await loadingMessage.edit('Error fetching random image. Please try again later.');
        }
    }
});

// Handle button interactions
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton() && !interaction.isChatInputCommand()) return;

    try {
        if (interaction.isButton()) {
            await interaction.deferUpdate();
            
            let imageData;
            let newScale = currentScale;

            switch (interaction.customId) {
                case 'scaleUp':
                    newScale = Math.min(500, currentScale + 50); // Cap at 400%
                    imageData = interaction.message.embeds[0];
                    break;
                case 'scaleDown':
                    newScale = Math.max(25, currentScale - 25); // Min at 25%
                    imageData = interaction.message.embeds[0];
                    break;
                case 'regenerate':
                    newScale = 100; // Reset scale for new image
                    imageData = await getRandomImage();
                    break;
            }

            currentScale = newScale;
            const imageUrl = buildImageUrl(
                interaction.customId === 'regenerate' ? imageData.url : imageData.url,
                currentScale
            );
            
            const isVideo = isVideoFile(
                interaction.customId === 'regenerate' ? imageData.file : imageData.title
            );

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(interaction.customId === 'regenerate' ? imageData.file : imageData.title)
                .setURL(imageUrl)
                .addFields(
                    { name: 'Collection', value: interaction.customId === 'regenerate' ? imageData.collection : interaction.message.embeds[0].fields[0].value, inline: true },
                    { name: 'Size', value: interaction.customId === 'regenerate' ? `${Math.round(imageData.size / 1024)} KB` : interaction.message.embeds[0].fields[1].value, inline: true },
                    { name: 'Type', value: isVideo ? 'Video' : 'Image', inline: true },
                    { name: 'Scale', value: `${currentScale}%`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Gallery-DL Random Image' });

            if (!isVideo) {
                embed.setImage(imageUrl);
            }

            await interaction.editReply({
                content: isVideo ? `Video: ${imageUrl}` : null,
                embeds: [embed],
                components: [getActionRow()]
            });
        }

        if (interaction.isChatInputCommand() && interaction.commandName === 'random') {
            await interaction.deferReply();
            const imageData = await getRandomImage();
            await sendImageEmbed(interaction, imageData);
        }
    } catch (error) {
        debug('Error handling interaction:', error);
        
        // Only try to respond if the interaction hasn't been responded to
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({ 
                    content: 'Error fetching random image. Please try again later.',
                    flags: [1 << 6] // Using flags instead of ephemeral
                });
            } catch (innerError) {
                debug('Error sending error response:', innerError);
            }
            return;
        }

        // If the interaction was deferred, try to edit the reply
        if (interaction.deferred) {
            try {
                const actionRow = getActionRow();
                await interaction.editReply({
                    content: 'Error fetching random image. Please try again later.',
                    components: [actionRow]
                });
            } catch (innerError) {
                debug('Error editing error response:', innerError);
            }
        }
    }
});

// Export the client
module.exports = { client, commands };