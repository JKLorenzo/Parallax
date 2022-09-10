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

  logUnhandledException(error: unknown) {
    console.error(`[TelemetryManager] Uncaught Exception: ${error}`);

    const inspected = this.bot.utils.inspect(error);
    const split = this.bot.utils.splitString(inspected);

    this.webhook?.send({
      username: 'TelemetryManager',
      embeds: split.map(
        e =>
          new EmbedBuilder({
            title: 'Uncaught Exception',
            description: e,
            color: Colors.Fuchsia,
          }),
      ),
    });
  }
}
