import { Colors, EmbedBuilder, WebhookClient } from 'discord.js';
import type { TelemetryData } from './telemetry_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import Utils from '../modules/utils.js';
import { client } from '../main.js';

export default class TelemetryFacade {
  private static _instance: TelemetryFacade;
  private webhook?: WebhookClient;
  private sessionId: string;

  constructor() {
    this.sessionId = Utils.makeId(5);
  }

  static instance() {
    if (!this._instance) {
      this._instance = new TelemetryFacade();
    }

    return this._instance;
  }

  async init() {
    const db = DatabaseFacade.instance();
    const telemetryUrl = await db.botConfig('TelemetryWebhookURL');

    if (telemetryUrl) {
      this.webhook = new WebhookClient({ url: telemetryUrl });
    }

    process.on('uncaughtException', error => {
      this.logUncaughtException({
        broadcast: true,
        identifier: 'Process',
        value: error,
      });
    });
  }

  async logMessage(data: TelemetryData) {
    const { origin, identifier, value, broadcast } = data;
    console.log(broadcast ? '[B]' : '[D]', origin, identifier, value);

    if (broadcast && this.webhook) {
      const embed = new EmbedBuilder({
        author: {
          name: client.user?.username ?? '',
          icon_url: client.user?.displayAvatarURL(),
        },
        title: identifier,
        color: Colors.Blurple,
        footer: { text: `Session (${this.sessionId}) ${origin ?? ''}` },
      });

      try {
        await this.webhook.send({
          embeds: Utils.formatToJs(value).map(
            e => new EmbedBuilder({ ...embed.data, description: e }),
          ),
        });
      } catch (_) {
        await this.webhook.send({
          embeds: [
            new EmbedBuilder({
              ...embed.data,
              description:
                'Message exceeds the allowable length. Refer to console for the actual data.',
            }),
          ],
        });
        console.error(value);
      }
    }
  }

  async logError(data: TelemetryData) {
    const { origin, identifier, value, broadcast } = data;
    console.warn(broadcast ? '[B]' : '[D]', origin, identifier, value);

    if (broadcast && this.webhook) {
      const embed = new EmbedBuilder({
        author: {
          name: client.user?.username ?? '',
          icon_url: client.user?.displayAvatarURL(),
        },
        title: identifier,
        color: Colors.Fuchsia,
        footer: { text: origin ?? 'Unknown' },
      });

      try {
        await this.webhook.send({
          embeds: Utils.formatToJs(value).map(
            e => new EmbedBuilder({ ...embed.data, description: e }),
          ),
        });
      } catch (_) {
        await this.webhook.send({
          embeds: [
            new EmbedBuilder({
              ...embed.data,
              description:
                'Message exceeds the allowable length. Refer to console for the actual data.',
            }),
          ],
        });
        console.error(value);
      }
    }
  }

  logUncaughtException(data: TelemetryData) {
    const { origin, identifier, value, broadcast } = data;
    console.error(broadcast ? '[B]' : '[D]', origin, identifier, value);

    if (broadcast && this.webhook) {
      const embed = new EmbedBuilder({
        author: {
          name: client.user?.username ?? '',
          icon_url: client.user?.displayAvatarURL(),
        },
        title: 'Uncaught Exception',
        color: Colors.Red,
        footer: { text: origin ?? 'Unknown' },
      });

      try {
        this.webhook.send({
          embeds: Utils.formatToJs(value).map(
            e => new EmbedBuilder({ ...embed.data, description: e }),
          ),
        });
      } catch (_) {
        this.webhook.send({
          embeds: [
            new EmbedBuilder({
              ...embed.data,
              description:
                'Message exceeds the allowable length. Refer to console for the actual data.',
            }),
          ],
        });
        console.error(value);
      }
    }
  }
}
