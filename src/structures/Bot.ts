import { Client, ClientOptions } from 'discord.js';
import DatabaseManager from '../managers/DatabaseManager';
import EnvironmentManager from '../managers/EnvironmentManager';
import TelemetryManager from '../managers/TelemetryManager';

export default class Bot {
  client: Client;

  managers: {
    database: DatabaseManager;
    environment: EnvironmentManager;
    telemetry: TelemetryManager;
  };

  constructor(options: ClientOptions) {
    this.client = new Client(options);
    this.managers = {
      telemetry: new TelemetryManager(this),
      environment: new EnvironmentManager(this),
      database: new DatabaseManager(this),
    };
    this.client.bot = this;
  }

  async start() {
    this.client.once('ready', async () => {
      this.managers.database.init();
      this.managers.telemetry.init();
    });

    await this.client.login(this.managers.environment.get('botToken'));
  }
}
