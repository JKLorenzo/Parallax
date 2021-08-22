import { WebhookClient } from 'discord.js';
import { getBotConfig } from './database.js';
import { app, client } from '../main.js';

let webhook: WebhookClient | undefined;

export async function initTelemetry(): Promise<void> {
  const telemetryUrl = await getBotConfig('TelemetryWebhookURL');
  if (telemetryUrl) webhook = new WebhookClient({ url: telemetryUrl });

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

  app.get('/', (req, res) => {
    res.redirect('https://github.com/JKLorenzo/Quarantine-Gaming');
  });

  app.get('/status', (req, res) => {
    res.send(client.ws.ping ? 'online' : 'offline');
  });

  app.get('/ping', (req, res) => {
    res.json({ ping: client.ws.ping });
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
