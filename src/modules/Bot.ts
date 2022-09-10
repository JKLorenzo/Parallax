import { Client, ClientOptions } from 'discord.js';
import Utils from './utils.js';
import DatabaseManager from '../managers/database_manager.js';
import EnvironmentManager from '../managers/environment_manager.js';
import InteractionManager from '../managers/interaction_manager.js';
import TelemetryManager from '../managers/telemetry_manager.js';

export default class Bot {
  client: Client;
  managers: {
    database: DatabaseManager;
    environment: EnvironmentManager;
    interaction: InteractionManager;
    telemetry: TelemetryManager;
  };
  utils: Utils;

  constructor(options: ClientOptions) {
    this.client = new Client(options);
    this.managers = {
      database: new DatabaseManager(this),
      environment: new EnvironmentManager(this),
      interaction: new InteractionManager(this),
      telemetry: new TelemetryManager(this),
    };
    this.utils = new Utils();
    this.client.bot = this;
  }

  async start() {
    this.client.once('ready', async client => {
      console.log(`Online on ${client.guilds.cache.size} servers.`);
      await this.managers.database.init();
      await this.managers.telemetry.init();
      this.managers.interaction.init();
    });

    await this.client.login(this.managers.environment.get('botToken'));
  }
}
