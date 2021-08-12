import { Activity, Collection, MessageEmbed, Presence, TextChannel } from 'discord.js';
import cron from 'node-cron';
import { getComponent } from './interaction.js';
import { client } from '../main.js';
import {
  addGuildGameRole,
  getBotConfig,
  getExpiredUserGames,
  getGame,
  getGameConfig,
  getGuildGameRoles,
  updateGame,
  updateUserGame,
} from '../modules/database.js';
import { addRole, createRole, deleteRole, removeRole } from '../modules/role.js';
import { logError } from '../modules/telemetry.js';
import { fetchImage, utfToHex } from '../utils/functions.js';
import Limiter from '../utils/limiter.js';
import { ActivityData } from '../utils/types.js';

const _screeningLimiter = new Limiter(1800000);

export function initGame(): void {
  cron.schedule('0 * * * *', async () => {
    try {
      const expired = await getExpiredUserGames();
      for (const [userId, game_names] of expired) {
        for (const guild of client.guilds.cache.values()) {
          const member = guild.members.cache.get(userId);
          const games = await getGuildGameRoles(guild.id);
          const game_roles = [];
          for (const game_name of game_names) {
            let game_role;
            const role_id = games.get(game_name);
            if (role_id) game_role = guild.roles.cache.get(role_id);
            if (game_role) game_roles.push(game_role);
          }
          if (member && game_roles) await removeRole(member, game_roles);
        }
      }
    } catch (error) {
      logError('Game Manager', 'Clear Expired', error);
    }
  });

  client.on('presenceUpdate', processPresence);
}

async function processPresence(oldPresence: Presence | null, newPresence: Presence): Promise<void> {
  try {
    const guild = newPresence.guild;
    const member = newPresence.member;

    if (!guild || !member || member.user.bot) return;
    const config = await getGameConfig(guild.id);

    const games = await getGuildGameRoles(guild.id);
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

        let game_role;
        const role_id = games.get(utfToHex(game_name));
        if (role_id) game_role = guild.roles.cache.get(role_id);

        if (game_data.status === 'approved' && status === 'new') {
          if (!game_role) {
            game_role = await createRole(guild, {
              name: game_name,
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
            await addGuildGameRole(game_role);
            if (!member.roles.cache.has(game_role.id)) await addRole(member, game_role);
            await updateUserGame(member.id, game_role.name);
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
