import 'dotenv/config';
import { Client, Intents } from 'discord.js';
import { initFreeGame } from './managers/free_game.js';
import { initGame } from './managers/game.js';
import { initGateway } from './managers/gateway.js';
import { initInteraction } from './managers/interaction.js';
import { initMusic } from './managers/music.js';
import { initPlay } from './managers/play.js';
import { initDatabase, getBotConfig } from './modules/database.js';
import { initTelemetry } from './modules/telemetry.js';

await initDatabase();

export const ownerId = (await getBotConfig('BotOwnerId'))!;

export const client = new Client({
  allowedMentions: {
    parse: ['everyone', 'roles', 'users'],
    repliedUser: true,
  },
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_INVITES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
  presence: {
    activities: [
      {
        name: '/',
        type: 'LISTENING',
      },
    ],
    status: 'online',
    afk: false,
  },
});

client.on('ready', async () => {
  console.log('Online');
  await initTelemetry();
  await initInteraction();
  await initGateway();
  await initMusic();
  await initGame();
  await initPlay();
  await initFreeGame();
  console.log('Initialized');
});

client.login(process.env.BOT_TOKEN!);
