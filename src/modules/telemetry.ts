import { WebhookClient } from 'discord.js';
import express, { json } from 'express';
import { getBotConfig } from './database.js';
import { client } from '../main.js';

let webhook: WebhookClient | undefined;
const port = process.env.PORT ?? 3000;
const app = express().use(json());

export async function initTelemetry(): Promise<void> {
  const telemetryUrl = await getBotConfig('TelemetryWebhookURL');
  if (telemetryUrl) webhook = new WebhookClient({ url: telemetryUrl });

  app.listen(port);

  client.on('rateLimit', data => {
    webhook?.send({
      username: 'Telemetry: Client RateLimit',
      content: `${data.method} \`${data.route}\``,
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

app.get('/status', (req, res) => {
  res.send(client.ws.ping ? 'online' : 'offline');
});

app.get('/ping', (req, res) => {
  res.send(client.ws.ping);
});

export function logError(name: string, title: string, error: string): void {
  console.error(error);
  webhook?.send({
    username: `Telemetry: ${name}`,
    content: `**${title}** - ${error}`,
  });
}
