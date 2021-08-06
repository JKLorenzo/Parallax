import { Activity, Collection, MessageEmbed, Presence, Snowflake, TextChannel } from 'discord.js';
import { getComponent } from './interaction.js';
import { client } from '../main.js';
import { getGame, getGameConfig, getGlobalConfig, updateGame } from '../modules/database.js';
import { addRole, createRole } from '../modules/role.js';
import { fetchImage } from '../utils/functions.js';
import { ActivityData } from '../utils/types.js';

export function initGame(): void {
  client.on('presenceUpdate', processPresence);
}

async function processPresence(oldPresence: Presence | null, newPresence: Presence): Promise<void> {
  const guild = newPresence.guild;
  const member = newPresence.member;

  if (!guild || !member) return;
  const config = await getGameConfig(guild.id);
  if (!config || !config.enabled) return;

  const _old = new Collection<string, ActivityData>();
  const _new = new Collection<string, ActivityData>();

  oldPresence?.activities
    .filter(a => a.type === 'PLAYING')
    .forEach(a => {
      _old.set(a.name.trim(), {
        activity: a,
        status: 'old',
      });
    });

  newPresence.activities
    .filter(a => a.type === 'PLAYING')
    .forEach(a => {
      _new.set(a.name.trim(), {
        activity: a,
        status: 'new',
      });
    });

  const diff = _old.difference(_new);
  for (const [game_name, { activity, status }] of diff) {
    const game_data = await getGame(game_name);
    if (!game_data) {
      await screenGame(game_name, activity);
    } else if (game_data.status === 'approved' && status === 'new') {
      let game_role = guild.roles.cache.find(role => role.name === game_name);
      if (!game_role) {
        game_role = await createRole(guild, {
          name: game_name,
          color: config.color,
        });
      }
      await addRole(member, game_role);
    }
  }
}

async function screenGame(game_name: string, activity: Activity): Promise<void> {
  const channelId = await getGlobalConfig<Snowflake>('game_screening_id');
  if (!channelId) return;
  const screeningChannel = client.channels.cache.get(channelId) as TextChannel;
  if (!screeningChannel) return;
  await updateGame({ name: game_name, status: 'pending' });
  const image = await fetchImage(game_name);
  await screeningChannel.send({
    embeds: [
      new MessageEmbed({
        author: { name: 'Global Configuration: Game Manager' },
        title: 'Game Screening',
        fields: [
          {
            name: 'Name:',
            value: game_name,
          },
          {
            name: 'App:',
            value: activity.applicationId ? `Verified (${activity.applicationId})` : 'Unverified',
          },
          {
            name: 'Status:',
            value: 'Pending',
          },
        ],
        thumbnail: { url: image?.iconUrl },
        image: { url: image?.bannerUrl },
        footer: {
          text: 'Apply actions by clicking one of the buttons below.',
        },
        color: 'BLURPLE',
      }),
    ],
    components: getComponent('game_screening'),
  });
}
