import { Activity, Collection, MessageEmbed, Presence, Role, TextChannel } from 'discord.js';
import cron from 'node-cron';
import { getComponent } from './interaction.js';
import { client } from '../main.js';
import {
  getBotConfig,
  getUserExpiredGames,
  getGame,
  getGameConfig,
  updateGame,
  updateUserGame,
  getUserGames,
} from '../modules/database.js';
import { addRole, createRole, deleteRole, removeRole } from '../modules/role.js';
import { logError } from '../modules/telemetry.js';
import { fetchImage } from '../utils/functions.js';
import Limiter from '../utils/limiter.js';
import { ActivityData } from '../utils/types.js';

const _screeningLimiter = new Limiter(1800000);

export const game_prefix = '🔰';

export async function initGame(): Promise<void> {
  const clearExpired = async () => {
    try {
      const expired = await getUserExpiredGames();
      for (const [userId, game_names] of expired) {
        for (const guild of client.guilds.cache.values()) {
          const member = guild.members.cache.get(userId);
          const game_roles = [];
          for (const game_name of game_names) {
            const game_role = guild.roles.cache.find(r => r.name === `${game_prefix}${game_name}`);
            if (game_role) game_roles.push(game_role);
          }
          if (member && game_roles.length) await removeRole(member, game_roles);
        }
      }

      for (const guild of client.guilds.cache.values()) {
        for (const member of guild.members.cache.values()) {
          const game_roles = [
            ...member.roles.cache.filter(r => r.name.startsWith(game_prefix)).values(),
          ];
          const user_games = await getUserGames(member.id);
          const expired_roles = [] as Role[];
          for (const game_role of game_roles) {
            const game = await getGame(game_role.name.replace(game_prefix, ''));
            if (!game || user_games.includes(game_role.name)) continue;
            expired_roles.push(game_role);
          }
          if (expired_roles.length) await removeRole(member, expired_roles);
        }
        for (const role of guild.roles.cache.filter(r => r.name.startsWith(game_prefix)).values()) {
          if (role.members.size > 0) continue;
          await deleteRole(role);
        }
      }
    } catch (error) {
      logError('Game Manager', 'Clear Expired', error);
    }
  };

  cron.schedule('0 * * * *', clearExpired);

  await clearExpired();

  client.on('presenceUpdate', processPresence);
}

async function processPresence(oldPresence: Presence | null, newPresence: Presence): Promise<void> {
  try {
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
      const game_data = await getGame(game_name.replace(game_prefix, ''));
      if (!game_data) {
        await screenGame(game_name, activity);
      } else {
        if (!config || !config.enabled) return;

        let game_role = guild.roles.cache.find(r => r.name === `${game_prefix}${game_name}`);

        if (game_data.status === 'approved' && status === 'new') {
          if (!game_role) {
            game_role = await createRole(guild, {
              name: `${game_prefix}${game_name}`,
              mentionable: config.mentionable,
              color: config.reference_role
                ? guild.roles.cache.get(config.reference_role)?.color
                : undefined,
              position: config.reference_role
                ? guild.roles.cache.get(config.reference_role)?.position
                : undefined,
              permissions: config.reference_role
                ? guild.roles.cache.get(config.reference_role)?.permissions
                : undefined,
            });
          }
          if (game_role) {
            if (!member.roles.cache.has(game_role.id)) await addRole(member, game_role);
            await updateUserGame(member.id, game_role.name);
            // Update role using reference role
            const reference_role = config.reference_role
              ? guild.roles.cache.get(config.reference_role)
              : undefined;
            if (reference_role) {
              if (reference_role.mentionable !== game_role.mentionable) {
                await game_role.setMentionable(reference_role.mentionable);
              }
              if (reference_role.color !== game_role.color) {
                await game_role.setColor(reference_role.color);
              }
              if (!reference_role.permissions.equals(game_role.permissions)) {
                await game_role.setPermissions(reference_role.permissions);
              }
            }
          }
        } else if (game_data.status === 'denied') {
          if (game_role) await deleteRole(game_role);
        }
      }
    }
  } catch (error) {
    logError('Game Manager', 'Process Presence', error);
  }
}

async function screenGame(game_name: string, activity: Activity): Promise<void> {
  try {
    if (_screeningLimiter.limit(game_name)) return;
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
  } catch (error) {
    logError('Game Manager', 'Screen Game', error);
  }
}
