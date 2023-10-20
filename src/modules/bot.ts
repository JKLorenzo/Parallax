import { Client, type ClientOptions } from 'discord.js';
import Utils from './utils.js';
import DatabaseManager from '../managers/database_manager.js';
import EnvironmentManager from '../managers/environment_manager.js';
import GatewayManager from '../managers/gateway_manager.js';
import InteractionManager from '../managers/interaction_manager.js';
import MusicManager from '../managers/music/music_manager.js';
import TelemetryManager from '../managers/telemetry_manager.js';

export default class Bot {
  client: Client;
  managers: {
    database: DatabaseManager;
    environment: EnvironmentManager;
    gateway: GatewayManager;
    interaction: InteractionManager;
    music: MusicManager;
    telemetry: TelemetryManager;
  };
  utils: Utils;

  constructor(options: ClientOptions) {
    this.utils = new Utils();
    this.client = new Client(options);
    this.managers = {
      database: new DatabaseManager(this),
      environment: new EnvironmentManager(this),
      gateway: new GatewayManager(this),
      interaction: new InteractionManager(this),
      music: new MusicManager(this),
      telemetry: new TelemetryManager(this),
    };
    this.client.bot = this;
  }

  async start() {
    const { environment, telemetry } = this.managers;
    const initTelemetry = telemetry.node('Bot', 'Startup', environment.isProduction());

    this.client.once('ready', () => {
      initTelemetry.logMessage('Connected to Discord. Initializing...');

      // Delay manager initializiation for 5 seconds
      setTimeout(async () => {
        try {
          // Initialzie database first then telemetry
          await this.managers.database.init();
          await this.managers.telemetry.init();

          // Initialize other managers
          await Promise.all([this.managers.gateway.init(), this.managers.music.init()]);

          // Initialize interaction manager last to accept user commands
          await this.managers.interaction.init();

          initTelemetry.logMessage(`Online on ${this.client.guilds.cache.size} servers.`);
        } catch (error) {
          initTelemetry.logError(error);
        }
      }, 5000);
    });

    await this.client.login(this.managers.environment.get('botToken'));
  }

  get guild() {
    return this.client.guilds.cache.get(this.utils.constants.CONTROL_SERVER_ID);
  }
}
