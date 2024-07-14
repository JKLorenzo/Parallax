import { Colors, EmbedBuilder, WebhookClient } from 'discord.js';
import type { TelemetryData } from './telemetry_defs.js';
import type Bot from '../../modules/bot.js';
import Utils from '../../static/utils.js';
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

    this.bot = bot;
  }

  async logMessage(data: TelemetryData) {
    const { origin, identifier, value, broadcast } = data;
    console.log(broadcast ? '[B]' : '[D]', origin, identifier, value);

    if (broadcast && this.webhook) {
      const embed = new EmbedBuilder({
        author: {
          name: this.bot?.client.user?.username ?? '',
          icon_url: this.bot?.client.user?.displayAvatarURL(),
        },
        title: identifier,
        color: Colors.Blurple,
        footer: { text: origin ?? this.bot?.telemetry.identifier ?? 'Unknown' },
      });

      await this.webhook.send({
        embeds: Utils.formatToJs(value).map(
          e => new EmbedBuilder({ ...embed.data, description: e }),
        ),
      });
    }
  }

  async logError(data: TelemetryData) {
    const { origin, identifier, value, broadcast } = data;
    console.warn(broadcast ? '[B]' : '[D]', origin, identifier, value);

    if (broadcast && this.webhook) {
      const embed = new EmbedBuilder({
        author: {
          name: this.bot?.client.user?.username ?? '',
          icon_url: this.bot?.client.user?.displayAvatarURL(),
        },
        title: identifier,
        color: Colors.Fuchsia,
        footer: { text: origin ?? this.bot?.telemetry.identifier ?? 'Unknown' },
      });

      await this.webhook.send({
        embeds: Utils.formatToJs(value).map(
          e => new EmbedBuilder({ ...embed.data, description: e }),
        ),
      });
    }
  }

  logUncaughtException(data: TelemetryData) {
    const { origin, identifier, value, broadcast } = data;
    console.error(broadcast ? '[B]' : '[D]', origin, identifier, value);

    if (broadcast && this.webhook) {
      const embed = new EmbedBuilder({
        author: {
          name: this.bot?.client.user?.username ?? '',
          icon_url: this.bot?.client.user?.displayAvatarURL(),
        },
        title: 'Uncaught Exception',
        color: Colors.Red,
        footer: { text: origin ?? this.bot?.telemetry.identifier ?? 'Unknown' },
      });

      this.webhook.send({
        embeds: Utils.formatToJs(value).map(
          e => new EmbedBuilder({ ...embed.data, description: e }),
        ),
      });
    }
  }
}
