import { Colors, EmbedBuilder, WebhookClient } from 'discord.js';
import type { TelemetryOptions } from './telemetry_defs.js';
import type Bot from '../../modules/bot.js';
import DatabaseFacade from '../database/database_facade.js';

export default class TelemetryFacade {
  private static _instance: TelemetryFacade;
  private webhook?: WebhookClient;
  private bot?: Bot;

  static instance() {
    if (!this._instance) {
      this._instance = new TelemetryFacade();
    }

    return this._instance;
  }

  async init(bot: Bot) {
    const db = DatabaseFacade.instance();
    const telemetryUrl = await db.botConfig('TelemetryWebhookURL');

    if (telemetryUrl) {
      this.webhook = new WebhookClient({ url: telemetryUrl });
    }

    process.on('uncaughtException', error => {
      this.logUnhandledException(error);
    });

    bot.client.on('debug', msg => {
      console.log(`[Client] ${msg}`);
    });

    bot.client.on('error', msg => {
      console.error(`[Client] ${msg}`);
    });

    this.bot = bot;
  }

  async logMessage(options: TelemetryOptions) {
    console.log(`[${options.origin}] ${options.section}: ${options.value}`);

    if (options.broadcast && this.webhook) {
      await this.webhook.send({
        username: `${this.bot?.client.user?.username} - ${options.origin}`,
        embeds: [
          new EmbedBuilder()
            .setTitle(options.section)
            .setDescription(
              typeof options.value === 'string'
                ? options.value
                : `\`\`\`js\n${options.value}\n\`\`\``,
            )
            .setColor(Colors.Blurple),
        ],
      });
    }
  }

  async logError(options: TelemetryOptions) {
    console.warn(`[${options.origin}] ${options.section}: ${options.value}`);

    if (options.broadcast && this.webhook) {
      await this.webhook.send({
        username: `${this.bot?.client.user?.username} - ${options.origin}`,
        embeds: [
          new EmbedBuilder()
            .setTitle(options.section)
            .setDescription(
              typeof options.value === 'string'
                ? options.value
                : `\`\`\`js\n${options.value}\n\`\`\``,
            )
            .setColor(Colors.Fuchsia),
        ],
      });
    }
  }

  logUnhandledException(error: unknown) {
    console.error(`[TelemetryManager] Unhandled Exception`);
    console.error(error);

    this.webhook?.send({
      username: `${this.bot?.client.user?.username ?? ''} - TelemetryManager`,
      embeds: [
        new EmbedBuilder({
          title: 'Unhandled Exception',
          description: typeof error === 'string' ? error : `\`\`\`js\n${error}\n\`\`\``,
          color: Colors.Red,
        }),
      ],
    });
  }
}
