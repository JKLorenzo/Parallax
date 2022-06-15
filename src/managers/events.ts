import { GuildScheduledEvent, MessageEmbedOptions, User } from 'discord.js';
import { client } from '../main.js';
import { fetchImage, parseMention } from '../utils/functions.js';
import { Queuer } from '../utils/queuer.js';

const queuer = new Queuer();

export function initEvents(): void {
  client.on('guildScheduledEventUserAdd', (event, user) => {
    queuer.queue(async () => {
      await processUserAdd(event, user);
    });
  });

  client.on('guildScheduledEventUserRemove', (event, user) => {
    queuer.queue(async () => {
      await processUserRemove(event, user);
    });
  });
}

async function processUserAdd(event: GuildScheduledEvent, user: User): Promise<void> {
  const defaultDescription = event.description?.split('.')[0];

  // Check if event is a game invite
  if (!defaultDescription?.split(' ').slice(1).join(' ').startsWith('is inviting you to play')) {
    return;
  }

  const inviter = event.guild?.members.cache.get(
    parseMention(defaultDescription?.split(' ')[0] ?? ''),
  );
  if (!inviter || inviter.id === user.id) return;

  const subscribers = await event.fetchSubscribers();
  const image = await fetchImage(event.name);
  const embed: MessageEmbedOptions = {
    author: { name: 'Parallax Game Coordinator' },
    title: event.name,
    url: event.url,
    thumbnail: { url: image?.iconUrl },
    description: `${user} is also interested.`,
    image: { url: image?.bannerUrl },
    footer: { iconURL: event.guild?.iconURL() ?? undefined, text: event.guild?.name },
    color: 'GREEN',
  };

  await inviter.send({ embeds: [embed] });

  for (const subscriber of subscribers.values()) {
    if (subscriber.user.id === user.id || subscriber.user.id === inviter?.id) continue;

    await subscriber.user.send({ embeds: [embed] });
  }
}

async function processUserRemove(event: GuildScheduledEvent, user: User): Promise<void> {
  const defaultDescription = event.description?.split('.')[0];

  // Check if event is a game invite
  if (!defaultDescription?.split(' ').slice(1).join(' ').startsWith('is inviting you to play')) {
    return;
  }

  const inviter = event.guild?.members.cache.get(
    parseMention(defaultDescription?.split(' ')[0] ?? ''),
  );
  if (!inviter || inviter.id === user.id) return;

  const subscribers = await event.fetchSubscribers();
  const image = await fetchImage(event.name);
  const embed: MessageEmbedOptions = {
    author: { name: 'Parallax Game Coordinator' },
    title: event.name,
    url: event.url,
    thumbnail: { url: image?.iconUrl },
    description: `${user} is no longer interested.`,
    image: { url: image?.bannerUrl },
    footer: { iconURL: event.guild?.iconURL() ?? undefined, text: event.guild?.name },
    color: 'LUMINOUS_VIVID_PINK',
  };

  await inviter.send({ embeds: [embed] });

  for (const subscriber of subscribers.values()) {
    if (subscriber.user.id === user.id || subscriber.user.id === inviter?.id) continue;

    await subscriber.user.send({ embeds: [embed] });
  }
}
