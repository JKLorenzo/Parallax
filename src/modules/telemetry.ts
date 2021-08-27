import { WebhookClient } from 'discord.js';
import { getBotConfig } from './database.js';
import { client } from '../main.js';

let webhook: WebhookClient | undefined;

export async function initTelemetry(): Promise<void> {
  const telemetryUrl = await getBotConfig('TelemetryWebhookURL');
  if (telemetryUrl) webhook = new WebhookClient({ url: telemetryUrl });

  client.on('rateLimit', data => {
    webhook?.send({
      username: 'Telemetry: Client RateLimit',
      content: [
        `At: ${data.path}`,
        `Limit: ${data.limit}`,
        `Timeout: ${data.timeout}`,
        `Global: ${data.global}`,
        `On: ${data.method} ${data.route}`,
      ].join('\n'),
    });
  });

  client.on('warn', message => {
    webhook?.send({
      username: 'Telemetry: Client Warning',
      content: message,
    });
  });

  client.on('error', error => {
    webhook?.send({
      username: 'Telemetry: Client Error',
      content: `${error.name}: ${error.message}`,
    });
  });

  client.on('guildCreate', guild => {
    webhook?.send({
      username: 'Telemetry: Client',
      content: `Joined \`${guild.name}\` server with a total of ${guild.memberCount} members.`,
    });
  });

  client.on('guildDelete', guild => {
    webhook?.send({
      username: 'Telemetry: Client',
      content: `Left \`${guild.name}\` server. Joined on \`${guild.joinedAt}\`.`,
    });
  });

  await webhook?.send({
    username: 'Telemetry: Client',
    content: `Online on ${client.guilds.cache.size} servers.`,
  });
}

export function logError(name: string, title: string, error: string): void {
  console.error(error);
  webhook?.send({
    username: `Telemetry: ${name}`,
    content: `**${title}** - ${error}`,
  });
}

export function logMessage(name: string, message: string): void {
  console.log(message);
  webhook?.send({
    username: `Telemetry: ${name}`,
    content: message,
  });
}
