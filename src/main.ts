import { Client, Intents } from 'discord.js';
import { connect } from './modules/database.js';
import { initInteractions } from './modules/interaction.js';

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
  await connect();
  await initInteractions();

  console.log('initialized');
});

client.login(process.env.BOT_TOKEN!);
