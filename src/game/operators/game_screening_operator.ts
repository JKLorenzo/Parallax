import { ActivityType, Colors, EmbedBuilder, Guild, type Activity } from 'discord.js';
import gis from 'async-g-i-s';
import DatabaseFacade from '../../database/database_facade.js';
import { GameStatus, type GameData, type GuildGameData } from '../../database/database_defs.js';
import { client } from '../../main.js';
import { Constants, CSConstants } from '../../misc/constants.js';
import GameScreeningComponent from '../components/game_screening_component.js';
import GameScreeningGuildComponent from '../components/game_screening_guild_component.js';
import Queuer from '../../misc/queuer.js';
import Utils from '../../misc/utils.js';

export default class GameScreeningOperator {
  private screeningQueue: Queuer;

  constructor() {
    this.screeningQueue = new Queuer();
  }

  async init() {
    client.on('presenceUpdate', async (oldPresence, newPresence) => {
      const db = DatabaseFacade.instance();

      const member = newPresence.member;
      if (!member) return;

      const games = newPresence.activities.filter(
        activity => activity.type === ActivityType.Playing,
      );
      if (games.length === 0) return;

      const config = await db.gameConfig(member.guild.id);
      if (!config?.enabled) return;

      for (const game of games) {
        this.screeningQueue.queue(() => this.screenGame(game));
        this.screeningQueue.queue(() => this.screenGuildGame(game, member.guild));
      }
    });
  }

  makeScreeningEmbed(data: GameData, guildData?: GuildGameData) {
    const embed = new EmbedBuilder({
      author: { name: Constants.GAME_MANAGER_TITLE },
      title: data.name,
    });

    switch (guildData ? guildData.status : data.status) {
      case GameStatus.Pending:
        embed
          .addFields({ name: Constants.GAME_EMBED_STATUS_FIELD, value: 'Pending', inline: true })
          .setColor(Colors.Blurple);
        break;
      case GameStatus.Approved:
        embed
          .addFields({ name: Constants.GAME_EMBED_STATUS_FIELD, value: 'Approved', inline: true })
          .setColor(Colors.Green);
        break;
      case GameStatus.Denied:
        embed
          .addFields({ name: Constants.GAME_EMBED_STATUS_FIELD, value: 'Denied', inline: true })
          .setColor(Colors.Fuchsia);
        break;
      default:
        embed
          .addFields({
            name: Constants.GAME_EMBED_STATUS_FIELD,
            value: `Unknown (${data.status})`,
            inline: true,
          })
          .setColor(Colors.Red);
        break;
    }

    if (data.id) {
      embed.addFields({ name: Constants.GAME_EMBED_APPID_FIELD, value: data.id, inline: true });
    }

    const moderatorId = guildData ? guildData.moderatorId : data.moderatorId;
    if (moderatorId) {
      embed.addFields({
        name: Constants.GAME_EMBED_MOD_FIELD,
        value: Utils.mentionUserById(moderatorId),
      });
    }

    if (data.iconURLs?.length && typeof data.iconIndex === 'number') {
      embed.setThumbnail(data.iconURLs[data.iconIndex]);

      if (!guildData) {
        embed.addFields({
          name: Constants.GAME_EMBED_ICON_FIELD,
          value: `${data.iconIndex + 1} / ${data.iconURLs.length}`,
          inline: true,
        });
      }
    }

    if (data.bannerURLs?.length && typeof data.bannerIndex === 'number') {
      embed.setImage(data.bannerURLs[data.bannerIndex]);

      if (!guildData) {
        embed.addFields({
          name: Constants.GAME_EMBED_BANNER_FIELD,
          value: `${data.bannerIndex + 1} / ${data.bannerURLs.length}`,
          inline: true,
        });
      }
    }

    if (guildData?.roleId) {
      embed.addFields({
        name: Constants.GAME_EMBED_ROLE_FIELD,
        value: Utils.mentionRoleById(guildData.roleId),
        inline: true,
      });
    }

    if (guildData?.lastPlayed) {
      embed.addFields({
        name: Constants.GAME_EMBED_LASTPLAYED_FIELD,
        value: guildData.lastPlayed.toString(),
      });
    }

    return embed;
  }

  async screenGame(game: Activity) {
    const db = DatabaseFacade.instance();

    if (!game.applicationId) return;

    const gameData = await db.gameData(game.applicationId);
    if (gameData) return;

    const filter = (width: number, height: number, aspectRatio: number) => {
      const tolerance = aspectRatio * 0.1;
      const ratio = width / height;
      if (width < 100) return false;
      if (ratio > aspectRatio + tolerance) return false;
      if (ratio < aspectRatio - tolerance) return false;
      return true;
    };

    const icons = await gis(`${game.name} game logo png`);
    const iconURLs = icons.filter(icon => filter(icon.width, icon.height, 1)).map(icon => icon.url);

    const banners = await gis(`${game.name} game banner png`);
    const bannerURLs = banners
      .filter(banner => filter(banner.width, banner.height, 16 / 9))
      .map(logo => logo.url);

    const data: GameData = {
      id: game.applicationId,
      name: game.name,
      status: GameStatus.Pending,
      iconURLs: iconURLs,
      bannerURLs: bannerURLs,
      iconIndex: iconURLs.length > 0 ? 0 : undefined,
      bannerIndex: bannerURLs.length > 0 ? 0 : undefined,
    };
    await db.gameData(game.applicationId, data);

    const controlServer = client.guilds.cache.get(CSConstants.GUILD_ID);
    const screeningChannel = controlServer?.channels.cache.get(
      CSConstants.GAME_SCREENING_CHANNEL_ID,
    );
    if (!screeningChannel?.isSendable()) return;

    const embed = this.makeScreeningEmbed(data);
    await screeningChannel.send({ embeds: [embed], components: GameScreeningComponent.data() });
  }

  async screenGuildGame(game: Activity, guild: Guild) {
    const db = DatabaseFacade.instance();

    if (!game.applicationId) return;

    const config = await db.gameConfig(guild.id);
    if (!config?.channel) return;

    const gameData = await db.gameData(game.applicationId);
    if (gameData?.status !== GameStatus.Approved) return;

    const guildGameData = await db.guildGameData(guild.id, game.applicationId);
    if (guildGameData) return;

    const data: GuildGameData = {
      id: game.applicationId,
      status: GameStatus.Pending,
    };
    await db.guildGameData(guild.id, game.applicationId, data);

    const gameChannel = await guild.channels.cache.get(config.channel);
    if (!gameChannel || !gameChannel.isSendable()) return;

    const embed = this.makeScreeningEmbed(gameData, data);
    await gameChannel.send({ embeds: [embed], components: GameScreeningGuildComponent.data() });
  }
}
