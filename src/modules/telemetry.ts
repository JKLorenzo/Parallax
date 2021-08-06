import { Snowflake, TextChannel, Webhook } from 'discord.js';
import express, { json } from 'express';
import { getGlobalConfig } from './database.js';
import { client } from '../main.js';

let webhook: Webhook | undefined;
const port = process.env.PORT ?? 3000;
const app = express().use(json());

export async function initTelemetry(): Promise<void> {
  const guildId = await getGlobalConfig<Snowflake>('guildId');
  const channelId = await getGlobalConfig<Snowflake>('telemetryId');
  if (guildId && channelId) {
    const guild = client.guilds.cache.get(guildId);
    const telemetry = guild?.channels.cache.get(channelId);
    const webhooks = await (telemetry as TextChannel)?.fetchWebhooks();
    webhook = webhooks?.find(w => w.name === 'Telemetry');
  }

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
}

app.get('/status', (req, res) => {
  res.send(client.ws.ping ? 'online' : 'offline');
});

export function logError(name: string, title: string, error: string): void {
  webhook?.send({
    username: `Telemetry: ${name}`,
    content: `**${title}** - ${error}`,
  });
}
