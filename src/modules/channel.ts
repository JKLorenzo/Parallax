import { Guild, GuildChannel, GuildChannelCreateOptions } from 'discord.js';
import { queuerOf } from '../utils/queuer.js';

type createOptions = { name: string } & GuildChannelCreateOptions;

export function createChannel(guild: Guild, data: createOptions): Promise<GuildChannel> {
  return queuerOf(guild.id).queue(async () => {
    const channel = await guild.channels.create(data.name, data);
    return channel;
  });
}

export function deleteChannel(channel: GuildChannel): Promise<void> {
  return queuerOf(channel.guildId).queue(async () => {
    if (channel.deletable) await channel.delete();
  });
}
