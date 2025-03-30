import {
  Activity,
  ActivityType,
  Colors,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  Role,
} from 'discord.js';
import DatabaseFacade from '../../global/database/database_facade.js';
import type Bot from '../../modules/bot.js';
import Queuer from '../../modules/queuer.js';
import Manager from '../manager.js';
import {
  GameStatus,
  type GameData,
  type GuildGameData,
} from '../../global/database/database_defs.js';
import Constants from '../../static/constants.js';
import gis from 'async-g-i-s';
import GameScreeningComponent from '../interaction/components/game_screening_component.js';
import GameScreeningGuildComponent from '../interaction/components/game_screening_guild_component.js';
import Utils from '../../static/utils.js';
import GameInviteComponent from '../interaction/components/game_invite_component.js';

export default class GameManager extends Manager {
  private screeningQueue: Queuer;
  private roleQueue: Queuer;
  private timekeepingQueue: Queuer;
  private messageQueue: Queuer;

  constructor(bot: Bot) {
    super(bot);

    this.screeningQueue = new Queuer();
    this.roleQueue = new Queuer();
    this.timekeepingQueue = new Queuer();
    this.messageQueue = new Queuer();
  }

  async init() {
    this.bot.client.on('presenceUpdate', async (oldPresence, newPresence) => {
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
        this.roleQueue.queue(() => this.addGameRole(game, member));
        this.timekeepingQueue.queue(() => this.updateGameLastPlayed(game, member.guild));
      }
    });

    this.bot.client.on('messageCreate', async message => {
      const db = DatabaseFacade.instance();

      if (message.author.bot) return;
      if (!message.inGuild()) return;

      const config = await db.gameConfig(message.guildId);
      if (!config?.enabled) return;

      for (const role of message.mentions.roles.values()) {
        this.messageQueue.queue(() => this.gameInvite(message, role));
      }
    });
  }

  static makeInviteEmbed(inviterId: string, data: GameData, joinersId?: string[]) {
    const embed = new EmbedBuilder({
      author: { name: Constants.GAME_MANAGER_TITLE },
      title: data.name,
      fields: [
        {
          name: Constants.GAME_EMBED_INVITER_FIELD,
          value: Utils.mentionUserById(inviterId),
          inline: true,
        },
      ],
      footer: { text: `${new Date()}` },
      color: Colors.Yellow,
    });

    if (data.id) {
      embed.addFields({ name: Constants.GAME_EMBED_APPID_FIELD, value: data.id, inline: true });
    }

    if (joinersId?.length) {
      embed.addFields(
        joinersId.map((joiner, i) => ({
          name: `Player ${i + 2}`,
          value: Utils.mentionUserById(joiner),
        })),
      );
    }

    if (data.iconURLs?.length && typeof data.iconIndex === 'number') {
      embed.setThumbnail(data.iconURLs[data.iconIndex]);
    }

    if (data.bannerURLs?.length && typeof data.bannerIndex === 'number') {
      embed.setImage(data.bannerURLs[data.bannerIndex]);
    }

    return embed;
  }

  static makeScreeningEmbed(data: GameData, guildData?: GuildGameData) {
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

  private async screenGame(game: Activity) {
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

    const gameChannelId = await db.botConfig('GameScreeningChannelId');
    if (!gameChannelId) return;

    const controlServer = this.bot.client.guilds.cache.get(Constants.CONTROL_SERVER_ID);
    const gameChannel = controlServer?.channels.cache.get(gameChannelId);
    if (!gameChannel || !gameChannel.isSendable()) return;

    const embed = GameManager.makeScreeningEmbed(data);
    await gameChannel.send({ embeds: [embed], components: GameScreeningComponent.data() });
  }

  private async screenGuildGame(game: Activity, guild: Guild) {
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

    const embed = GameManager.makeScreeningEmbed(gameData, data);
    await gameChannel.send({ embeds: [embed], components: GameScreeningGuildComponent.data() });
  }

  private async addGameRole(game: Activity, member: GuildMember) {
    const db = DatabaseFacade.instance();

    if (!game.applicationId) return;

    const gameData = await db.gameData(game.applicationId);
    if (gameData?.status !== GameStatus.Approved) return;

    const guildGameData = await db.guildGameData(member.guild.id, game.applicationId);
    if (guildGameData?.status !== GameStatus.Approved) return;

    if (!guildGameData.roleId) return;
    if (member.roles.cache.has(guildGameData.roleId)) return;

    const role = member.guild.roles.cache.get(guildGameData.roleId);
    if (!role) return;

    await member.roles.add(role, Constants.GAME_MANAGER_TITLE);
  }

  private async updateGameLastPlayed(game: Activity, guild: Guild) {
    const db = DatabaseFacade.instance();

    if (!game.applicationId) return;

    const gameData = await db.gameData(game.applicationId);
    if (gameData?.status !== GameStatus.Approved) return;

    const guildGameData = await db.guildGameData(guild.id, game.applicationId);
    if (guildGameData?.status !== GameStatus.Approved) return;

    let updateNeeded = true;
    if (guildGameData.lastPlayed) {
      const difference = Utils.compareDate(guildGameData.lastPlayed);
      if (difference.days < 1) updateNeeded = false;
    }
    if (!updateNeeded) return;

    await db.guildGameData(guild.id, game.applicationId, {
      lastPlayed: new Date(),
    });
  }

  private async gameInvite(message: Message<boolean>, role: Role) {
    const db = DatabaseFacade.instance();

    const gameRoleData = await db.findGuildGameByRole(role.guild.id, role.id);
    if (!gameRoleData?.id) return;

    const gameData = await db.gameData(gameRoleData.id);
    if (!gameData) return;

    const embed = GameManager.makeInviteEmbed(message.author.id, gameData);
    await message.reply({ embeds: [embed], components: GameInviteComponent.data() });
  }
}
