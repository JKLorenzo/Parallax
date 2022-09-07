import { Client, ClientOptions } from 'discord.js';
import DatabaseManager from '../managers/DatabaseManager.js';
import EnvironmentManager from '../managers/EnvironmentManager.js';
import InteractionManager from '../managers/InteractionManager.js';
import TelemetryManager from '../managers/TelemetryManager.js';

export default class Bot {
  client: Client;

  managers: {
    database: DatabaseManager;
    environment: EnvironmentManager;
    interaction: InteractionManager;
    telemetry: TelemetryManager;
  };

  constructor(options: ClientOptions) {
    this.client = new Client(options);
    this.managers = {
      database: new DatabaseManager(this),
      environment: new EnvironmentManager(this),
      interaction: new InteractionManager(this),
      telemetry: new TelemetryManager(this),
    };
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
