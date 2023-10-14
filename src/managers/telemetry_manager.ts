import { Colors, EmbedBuilder, WebhookClient } from 'discord.js';
import TelemetryNode from '../modules/telemetry_node.js';
import Manager from '../structures/manager.js';

type logOptions = {
  broadcast: boolean;
  origin: string;
  section: string;
  value: unknown;
};

export default class TelemetryManager extends Manager {
  webhook?: WebhookClient;

  async init() {
    const telemetryUrl = await this.bot.managers.database.botConfig('TelemetryWebhookURL');
    if (telemetryUrl) this.webhook = new WebhookClient({ url: telemetryUrl });

    this.bot.client.on('debug', msg => {
      console.log(`[Client] ${msg}`);
    });

    this.bot.client.on('error', msg => {
      console.error(`[Client] ${msg}`);
    });

    process.on('uncaughtException', error => {
      this.logUnhandledException(error);
    });
  }

  node(origin: string | Manager, section: string, broadcast = true) {
    const _origin = typeof origin === 'string' ? origin : origin.constructor.name;
    return new TelemetryNode(this, _origin, section, broadcast);
  }

  logMessage(options: logOptions) {
    console.log(`[${options.origin}] ${options.section}: ${options.value}`);

    if (options.broadcast) {
      this.webhook?.send({
        username: `${this.bot.client.user?.username ?? ''} - ${options.origin}`,
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

  logError(options: logOptions) {
    console.warn(`[${options.origin}] ${options.section}: ${options.value}`);

    if (options.broadcast) {
      this.webhook?.send({
        username: `${this.bot.client.user?.username ?? ''} - ${options.origin}`,
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
      username: `${this.bot.client.user?.username ?? ''} - TelemetryManager`,
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
