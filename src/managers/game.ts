import { Activity, Collection, MessageEmbed, Presence, TextChannel } from 'discord.js';
import cron from 'node-cron';
import { getComponent } from './interaction.js';
import { client } from '../main.js';
import {
  getBotConfig,
  getExpiredUserGames,
  getGame,
  getGameConfig,
  updateGame,
  updateGameConfig,
  updateUserGame,
} from '../modules/database.js';
import { addRole, createRole, deleteRole, removeRole } from '../modules/role.js';
import { logError } from '../modules/telemetry.js';
import { fetchImage } from '../utils/functions.js';
import { ActivityData } from '../utils/types.js';

export function initGame(): void {
  cron.schedule('0 * * * *', async () => {
    try {
      const expired = await getExpiredUserGames();
      for (const [userId, game_names] of expired) {
        for (const guild of client.guilds.cache.values()) {
          const member = guild.members.cache.get(userId);
          const config = await getGameConfig(guild.id);
          const game_roles = [
            ...guild.roles.cache
              .filter(r => game_names.includes(r.name) && (config?.roles?.includes(r.id) ?? false))
              .values(),
          ];
          if (member && game_roles) await removeRole(member, game_roles);
        }
      }
    } catch (error) {
      logError('Game', 'Clear Expired', error);
    }
  });

  client.on('presenceUpdate', processPresence);
}

async function processPresence(oldPresence: Presence | null, newPresence: Presence): Promise<void> {
  const guild = newPresence.guild;
  const member = newPresence.member;

  if (!guild || !member || member.user.bot) return;
  const config = await getGameConfig(guild.id);

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
    } else {
      if (!config || !config.enabled) return;

      if (game_data.status === 'approved' && status === 'new') {
        let game_role = guild.roles.cache.find(
          role => role.name === game_name && (config.roles?.includes(role.id) ?? false),
        );

        if (!game_role) {
          game_role = await createRole(guild, {
            name: game_name,
            color: config.color,
            mentionable: config.mentionable,
            position: config.reference_role
              ? guild.roles.cache.get(config.reference_role)?.position
              : undefined,
          });
        }
        if (game_role) {
          if (!config.roles?.includes(game_role.id)) {
            await updateGameConfig(guild.id, { roles: [...(config.roles ?? []), game_role.id] });
          }
          if (!member.roles.cache.has(game_role.id)) await addRole(member, game_role);
          await updateUserGame(member.id, game_role.name);
        }
      } else if (game_data.status === 'denied') {
        const game_role = guild.roles.cache.find(
          role => role.name === game_name && (config.roles?.includes(role.id) ?? false),
        );
        if (game_role) {
          await updateGameConfig(guild.id, {
            roles: [...(config.roles ?? []).filter(r => r !== game_role.id)],
          });
          await deleteRole(game_role);
        }
      }
    }
  }
}

async function screenGame(game_name: string, activity: Activity): Promise<void> {
  const channelId = await getBotConfig('GameScreeningChannelId');
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
