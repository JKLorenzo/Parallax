import { Colors, EmbedBuilder, WebhookClient } from 'discord.js';
import TelemetryNode from '../modules/TelemetryNode.js';
import Manager from '../structures/Manager.js';

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

    process.on('uncaughtException', this.logUnhandledException);
  }

  node(manager: Manager, section: string, broadcast = true) {
    return new TelemetryNode(this, manager.constructor.name, section, broadcast);
  }

  logMessage(options: logOptions) {
    console.log(`[${options.origin}] ${options.section}: ${options.value}`);

    if (options.broadcast) {
      this.webhook?.send({
        username: options.origin,
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
        username: options.section,
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

  logUnhandledException(origin: string, value: unknown) {
    console.error(`[${origin}] Uncaught Exception: ${value}`);

    this.webhook?.send({
      username: origin,
      embeds: [
        new EmbedBuilder()
          .setTitle('Uncaught Exception')
          .setDescription(typeof value === 'string' ? value : `\`\`\`js\n${value}\n\`\`\``)
          .setColor(Colors.Red),
      ],
    });
  }
}
