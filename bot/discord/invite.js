const { OAuth2Scopes, PermissionsBitField } = require('discord.js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const scopes = [
  OAuth2Scopes.Bot,
  OAuth2Scopes.ApplicationsCommands,
  OAuth2Scopes.DmConnect,
  OAuth2Scopes.Identify
];

const permissions = [
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.UseExternalEmojis
];

const inviteUrl = `https://discord.com/api/oauth2/authorize` +
    `?client_id=${process.env.CLIENT_ID}` +
    `&permissions=${permissions.reduce((a, b) => a | b, 0n)}` +
    `&scope=${scopes.join('%20')}`;

console.log(inviteUrl);