import Color from 'color';
import { MessageAttachment, MessageEmbed, Role, TextChannel } from 'discord.js';
import cron from 'node-cron';
import fetch from 'node-fetch';
import { client } from '../main.js';
import { getFreeGame, getFreeGameConfig, pushFreeGame } from '../modules/database.js';
import { logError } from '../modules/telemetry.js';
import { fetchImage, hasAny, parseHTML } from '../utils/functions.js';
import { RedditPostData, RedditResponseData } from '../utils/types.js';

const allowedDomains = [
  'steampowered.com',
  'humblebundle.com',
  'epicgames.com',
  'gog.com',
  'playstation.com',
  'microsoft.com',
  'xbox.com',
];

export async function initFreeGame(): Promise<void> {
  cron.schedule('0 * * * *', () => scan());
  await scan();
}

export async function scan(url?: string): Promise<string> {
  try {
    const baseURL = 'https://www.reddit.com/r/FreeGameFindings';
    const response = await fetch(`${baseURL}/new/.json?limit=10&sort=new`)
      .then(data => data.json() as Promise<RedditResponseData>)
      .then(entry =>
        entry.data.children
          .map(child => child.data)
          .filter(data => allowedDomains.includes(data.domain))
          .map(
            data =>
              ({
                title: parseHTML(data.title),
                url: data.url,
                author: data.author,
                selftext: parseHTML(data.selftext),
                domain: data.domain,
                created: data.created * 1000,
                link_flair_text: data.link_flair_text,
                score: data.score,
                upvote_ratio: data.upvote_ratio * 100,
                permalink: `https://www.reddit.com${data.permalink}`,
              } as RedditPostData),
          ),
      );
    if (!response) return 'No response received.';

    for (const data of response) {
      const this_game = await getFreeGame(data.url);
      const day_old = Date.now() - 86400000;
      if (url) {
        if (url.trim() === data.url) {
          if (this_game) return 'This entry is already posted.';
          return await post(data);
        }
      } else if (
        !this_game &&
        data.score >= 100 &&
        data.upvote_ratio >= 90 &&
        data.created >= day_old
      ) {
        await post(data);
      }
    }
    return 'Uh-oh! The link you provided is no longer valid.';
  } catch (error) {
    logError('Free Game', 'Scan', error);
    return `${error}`;
  }
}

async function post(data: RedditPostData): Promise<string> {
  try {
    const embed = new MessageEmbed({
      url: data.url,
      footer: {
        text: `Accumulated ${data.score} upvotes with ${data.upvote_ratio}% upvote ratio.`,
        iconURL: client.emojis.cache.find(e => e.name === 'reddit')?.url,
      },
      timestamp: data.created,
    });

    let filter_instance = 0;
    let safe_title = '';
    let filtered_title = '';
    for (const char of data.title.split('')) {
      if (char === '[' || char === '(') {
        filter_instance++;
      }
      if (filter_instance === 0) {
        safe_title += char;
      } else {
        filtered_title += char;
      }
      if (filter_instance > 0 && (char === ']' || char === ')')) {
        filter_instance--;
      }
    }
    // Trim title
    safe_title = safe_title.trim();
    filtered_title = filtered_title.trim();

    if (hasAny(filtered_title.toLowerCase(), ['other', 'alpha', 'beta', 'psa'])) {
      return 'Uh-oh! This free game is marked as filtered.';
    }
    embed.setTitle(`**${safe_title.length ? safe_title : data.title}**`);

    if (data.link_flair_text) {
      if (
        data.link_flair_text.toLowerCase().indexOf('comment') !== -1 ||
        data.link_flair_text.toLowerCase().indexOf('issue') !== -1
      ) {
        embed.setDescription(`[${data.link_flair_text}](${data.permalink})`);
      } else {
        embed.setDescription(`${data.link_flair_text}`);
      }
    }

    const image = await fetchImage(safe_title.length ? safe_title : data.title);
    if (image?.iconUrl) embed.setThumbnail(image.iconUrl);
    if (image?.bannerUrl) embed.setImage(image.bannerUrl);

    const searchables = `${data.url.toLowerCase()}-${data.selftext.toLowerCase()}`;
    const platforms = [] as ('Steam' | 'Epic Games' | 'GOG' | 'PlayStation' | 'Xbox')[];
    if (
      hasAny(searchables, 'steampowered.com') ||
      (hasAny(searchables, 'humblebundle.com') && hasAny(filtered_title, 'steam'))
    ) {
      platforms.push('Steam');
    }
    if (hasAny(searchables, 'epicgames.com')) platforms.push('Epic Games');
    if (hasAny(searchables, 'gog.com')) platforms.push('GOG');
    if (hasAny(searchables, 'playstation.com')) platforms.push('PlayStation');
    if (hasAny(searchables, ['microsoft.com', 'xbox.com'])) platforms.push('Xbox');

    if (!platforms.length) {
      return "Uh-oh! This free game doesn't belong to any supported platforms.";
    }

    const attachments = [];
    if (!embed.image?.url) {
      embed.setImage('attachment://gaming.gif');
      attachments.push(new MessageAttachment('./src/assets/gaming.gif'));
    }

    let server_count = 0;
    for (const guild of client.guilds.cache.values()) {
      const config = await getFreeGameConfig(guild.id);
      if (!config?.enabled) continue;
      if (!config.channel) continue;
      const channel = guild.channels.cache.get(config.channel);
      if (!channel) continue;
      if (!(channel instanceof TextChannel)) continue;

      const roles = [] as Role[];
      let color: Color | undefined;

      if (platforms.includes('Steam') && config.steam_role) {
        const role = guild.roles.cache.get(config.steam_role);
        if (role) {
          roles.push(role);
          const this_color =
            role.hexColor === '#000000' ? Color.rgb(0, 157, 255) : Color(role.hexColor);
          color = color ? color.mix(this_color) : this_color;
        }
      }
      if (platforms.includes('Epic Games') && config.epic_role) {
        const role = guild.roles.cache.get(config.epic_role);
        if (role) {
          roles.push(role);
          const this_color =
            role.hexColor === '#000000' ? Color.rgb(157, 255, 0) : Color(role.hexColor);
          color = color ? color.mix(this_color) : this_color;
        }
      }
      if (platforms.includes('GOG') && config.gog_role) {
        const role = guild.roles.cache.get(config.gog_role);
        if (role) {
          roles.push(role);
          const this_color =
            role.hexColor === '#000000' ? Color.rgb(157, 0, 255) : Color(role.hexColor);
          color = color ? color.mix(this_color) : this_color;
        }
      }
      if (platforms.includes('PlayStation') && config.ps_role) {
        const role = guild.roles.cache.get(config.ps_role);
        if (role) {
          roles.push(role);
          const this_color =
            role.hexColor === '#000000' ? Color.rgb(178, 54, 255) : Color(role.hexColor);
          color = color ? color.mix(this_color) : this_color;
        }
      }
      if (platforms.includes('Xbox') && config.xbox_role) {
        const role = guild.roles.cache.get(config.xbox_role);
        if (role) {
          roles.push(role);
          const this_color =
            role.hexColor === '#000000' ? Color.rgb(77, 222, 31) : Color(role.hexColor);
          color = color ? color.mix(this_color) : this_color;
        }
      }

      if (!roles.length) continue;

      embed.setAuthor(`${guild.name}: Free Game Updates`);
      embed.setFields([
        { name: 'Author', value: data.author, inline: true },
        { name: 'Platforms', value: platforms.join(', '), inline: true },
      ]);
      embed.setColor(color!.rgbNumber());

      await channel.send({
        content: `${embed.title} is now available on ${roles.join(' and ')}.`,
        embeds: [embed],
        files: attachments,
      });

      server_count++;
    }

    await pushFreeGame(data);

    return `Done! ${embed.title} is pushed to ${server_count} servers.`;
  } catch (error) {
    logError('Free Game', 'Post', error);
    return `${error}`;
  }
}
