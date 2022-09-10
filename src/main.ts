import 'dotenv/config';
import { ActivityType, GatewayIntentBits } from 'discord.js';
import Bot from './modules/bot.js';

const bot = new Bot({
  allowedMentions: {
    parse: ['everyone', 'roles', 'users'],
    repliedUser: true,
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildMessageReactions,
  ],
  presence: {
    activities: [
      {
        name: '/',
        type: ActivityType.Listening,
      },
    ],
    status: 'online',
    afk: false,
  },
});

bot.start();
