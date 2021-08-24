import { Client, Intents } from 'discord.js';
import express, { json } from 'express';
import { initFreeGame } from './managers/free_game.js';
import { initGame } from './managers/game.js';
import { initInteraction } from './managers/interaction.js';
import { initPlay } from './managers/play.js';
import { connectDb } from './modules/database.js';
import { initSpotify } from './modules/spotify.js';
import { initTelemetry } from './modules/telemetry.js';

export const app = express().use(json());

export const client = new Client({
  allowedMentions: {
    parse: ['everyone', 'roles', 'users'],
    repliedUser: true,
  },
  intents: [
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_BANS,
    Intents.FLAGS.GUILD_INVITES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_VOICE_STATES,
  ],
  partials: ['MESSAGE', 'CHANNEL'],
  presence: {
    status: 'online',
    afk: false,
  },
});

client.on('ready', async () => {
  console.log('Online');
  await connectDb();
  await initTelemetry();
  await initInteraction();
  console.log('Initialized');
  initGame();
  await initPlay();
  await initFreeGame();
  await initSpotify();
  console.log('Done');
});

app.listen(process.env.PORT ?? 3000);

client.login(process.env.BOT_TOKEN!);
