import { Colors, EmbedBuilder, escapeMarkdown, WebhookClient } from 'discord.js';
import Manager from '../structures/Manager';

export default class TelemetryManager extends Manager {
  webhook?: WebhookClient;

  async init() {
    const telemetryUrl = await this.bot.managers.database.botConfig('TelemetryWebhookURL');
    if (telemetryUrl) this.webhook = new WebhookClient({ url: telemetryUrl });

    process.on('uncaughtException', this.logUnhandledException);
  }

  logMessage(manager: Manager, section: string, value: unknown) {
    console.log({ manager: manager.constructor.name, section, value });
    this.webhook?.send({
      username: manager.constructor.name,
      embeds: [
        new EmbedBuilder()
          .setTitle(section)
          .setDescription(escapeMarkdown(`${value}`, { codeBlock: true }))
          .setColor(Colors.Blurple),
      ],
    });
  }

  logError(manager: Manager, section: string, value: unknown) {
    console.warn({ manager: manager.constructor.name, section, value });
    this.webhook?.send({
      username: manager.constructor.name,
      embeds: [
        new EmbedBuilder()
          .setTitle(section)
          .setDescription(escapeMarkdown(`${value}`, { codeBlock: true }))
          .setColor(Colors.Fuchsia),
      ],
    });
  }

  logUnhandledException(origin: string, value: unknown) {
    console.error({ origin, value });
    this.webhook?.send({
      username: 'Telemetry Manager',
      embeds: [
        new EmbedBuilder()
          .setTitle('Uncaught Exception')
          .addFields([
            {
              name: 'Origin',
              value: escapeMarkdown(origin, { codeBlock: true }),
            },
            {
              name: 'Error',
              value: escapeMarkdown(`${value}`, { codeBlock: true }),
            },
          ])
          .setColor(Colors.Red),
      ],
    });
  }
}
