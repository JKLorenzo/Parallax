import { Client, type ClientOptions } from 'discord.js';
import EnvironmentFacade from '../global/environment/environment_facade.js';
import Telemetry from '../global/telemetry/telemetry.js';
import GatewayManager from '../managers/gateway/gateway_manager.js';
import InteractionManager from '../managers/interaction/interaction_manager.js';
import Constants from '../static/constants.js';

export default class Bot {
  telemetry: Telemetry;
  client: Client;
  managers: {
    gateway: GatewayManager;
    interaction: InteractionManager;
  };

  constructor(options: ClientOptions) {
    this.telemetry = new Telemetry(this);
    this.client = new Client(options);
    this.managers = {
      gateway: new GatewayManager(this),
      interaction: new InteractionManager(this)
    };
    this.client.bot = this;

    this.client.on('debug', msg => {
      this.telemetry.start('Client').log(msg).end();
    });

    this.client.on('error', e => {
      this.telemetry.start('Client').error(e).end();
    });
  }

  async start() {
    const env = EnvironmentFacade.instance();
    const telemetry = this.telemetry.start(this.start, env.isProduction());

    this.client.once('ready', () => {
      telemetry.log('Connected to Discord. Initializing...');

      // Delay manager initializiation for 5 seconds
      setTimeout(async () => {
        try {
          // Initialize other managers
          await Promise.all([this.managers.gateway.init()]);

          // Initialize interaction manager last to accept user commands
          await this.managers.interaction.init();

          telemetry.log(`Online on ${this.client.guilds.cache.size} servers.`);
        } catch (error) {
          telemetry.error(error);
        }
      }, 5000);
    });

    await this.client.login(env.get('botToken'));

    telemetry.end();
  }

  get guild() {
    return this.client.guilds.cache.get(Constants.CONTROL_SERVER_ID);
  }

  findEmoji(name: string) {
    return this.guild?.emojis.cache.find(e => e.name === name);
  }
}
