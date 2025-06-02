import 'dotenv/config';
import { ActivityType, Client, GatewayIntentBits } from 'discord.js';
import DatabaseFacade from './database/database_facade.js';
import TelemetryFacade from './telemetry/telemetry_facade.js';
import GatewayManager from './gateway/gateway_manager.js';
import EnvironmentFacade from './environment/environment_facade.js';
import InteractionManager from './interaction/interaction_manager.js';
import GameManager from './game/game_manager.js';
import VoiceManager from './voice/voice_manager.js';

const database = DatabaseFacade.instance();
const telemetry = TelemetryFacade.instance();

await database.init();
await telemetry.init();

export const client = new Client({
  allowedMentions: {
    parse: ['everyone', 'roles', 'users'],
    repliedUser: true,
  },
  intents: [
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
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

client.once('ready', async () => {
  // Initialize other managers
  await Promise.all([
    GatewayManager.instance().init(),
    GameManager.instance().init(),
    VoiceManager.instance().init(),
  ]);

  // Initialize interaction manager last to accept user commands
  await InteractionManager.instance().init();

  telemetry.logMessage({
    identifier: 'Client',
    value: `Online on ${client.guilds.cache.size} servers.`,
    broadcast: true,
    origin: 'Main',
  });
});

client.login(EnvironmentFacade.instance().get('botToken'));
