import 'dotenv/config';
import { ActivityType, GatewayIntentBits } from 'discord.js';
import Bot from './modules/bot.js';

const bot = new Bot({
  allowedMentions: {
    parse: ['everyone', 'roles', 'users'],
    repliedUser: true,
  },
  intents: [
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
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
