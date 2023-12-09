import { Client, type ClientOptions } from 'discord.js';
import EnvironmentFacade from '../global/environment/environment_facade.js';
import TelemetryFacade from '../global/telemetry/telemetry_facade.js';
import type TelemetryNode from '../global/telemetry/telemetry_node.js';
import GatewayManager from '../managers/gateway/gateway_manager.js';
import InteractionManager from '../managers/interaction/interaction_manager.js';
import MusicManager from '../managers/music/music_manager.js';
import Constants from '../static/constants.js';

export default class Bot {
  client: Client;
  managers: {
    gateway: GatewayManager;
    interaction: InteractionManager;
    music: MusicManager;
  };
  telemetry: TelemetryNode;

  constructor(options: ClientOptions) {
    this.client = new Client(options);
    this.managers = {
      gateway: new GatewayManager(this),
      interaction: new InteractionManager(this),
      music: new MusicManager(this),
    };
    this.client.bot = this;
    this.telemetry = TelemetryFacade.instance().register(this);
  }

  async start() {
    const env = EnvironmentFacade.instance();
    const logger = this.telemetry.start(this.start, env.isProduction());

    this.client.once('ready', () => {
      logger.log('Connected to Discord. Initializing...');

      // Delay manager initializiation for 5 seconds
      setTimeout(async () => {
        try {
          // Initialize other managers
          await Promise.all([this.managers.gateway.init(), this.managers.music.init()]);

          // Initialize interaction manager last to accept user commands
          await this.managers.interaction.init();

          logger.log(`Online on ${this.client.guilds.cache.size} servers.`);
        } catch (error) {
          logger.error(error);
        }
      }, 5000);
    });

    await this.client.login(env.get('botToken'));

    logger.end();
  }

  get guild() {
    return this.client.guilds.cache.get(Constants.CONTROL_SERVER_ID);
  }

  findEmoji(name: string) {
    return this.guild?.emojis.cache.find(e => e.name === name);
  }
}
