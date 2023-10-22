import 'dotenv/config';
import { ActivityType, GatewayIntentBits } from 'discord.js';
import DatabaseFacade from './global/database/database_facade.js';
import TelemetryFacade from './global/telemetry/telemetry_facade.js';
import Bot from './modules/bot.js';

const telemetry = TelemetryFacade.instance();
const database = DatabaseFacade.instance();

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

await database.init();
await telemetry.init(bot);
await bot.start();
