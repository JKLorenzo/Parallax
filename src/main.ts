import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import DatabaseFacade from './database/database_facade.js';
import TelemetryFacade from './telemetry/telemetry_facade.js';
import GatewayManager from './gateway/gateway_manager.js';
import EnvironmentFacade from './environment/environment_facade.js';
import InteractionManager from './interaction/interaction_manager.js';
import GameManager from './game/game_manager.js';
import VoiceManager from './voice/voice_manager.js';
import AutomodManager from './automod/automod_manager.js';
import ServerManager from './server/server_manager.js';

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
});

client.once('ready', async () => {
  await Promise.all([
    AutomodManager.instance().init(),
    GatewayManager.instance().init(),
    GameManager.instance().init(),
    InteractionManager.instance().init(),
    ServerManager.instance().init(),
    VoiceManager.instance().init(),
  ]);

  telemetry.logMessage({
    identifier: 'Client',
    value: `Online on ${client.guilds.cache.size} servers.`,
    broadcast: true,
  });
});

client.login(EnvironmentFacade.instance().get('botToken'));
