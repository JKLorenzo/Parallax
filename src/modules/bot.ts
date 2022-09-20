import { Client, ClientOptions } from 'discord.js';
import Utils from './utils.js';
import DatabaseManager from '../managers/database_manager.js';
import EnvironmentManager from '../managers/environment_manager.js';
import GatewayManager from '../managers/gateway_manager.js';
import InteractionManager from '../managers/interaction_manager.js';
import MusicManager from '../managers/music_manager.js';
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
    this.client.once('ready', async client => {
      console.log(`Online on ${client.guilds.cache.size} servers.`);
      // Initialzie database first then telemetry
      await this.managers.database.init();
      await this.managers.telemetry.init();
      // Initialize other managers
      await Promise.all([this.managers.gateway.init(), this.managers.music.init()]);
      // Initialize interaction manager last to accept user commands
      await this.managers.interaction.init();
      console.log('Initialized');
    });

    await this.client.login(this.managers.environment.get('botToken'));
  }

  get guild() {
    return this.client.guilds.cache.get(this.utils.constants.CONTROL_SERVER_ID);
  }
}
