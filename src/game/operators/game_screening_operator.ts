import { Guild, type Activity } from 'discord.js';
import gis from 'async-g-i-s';
import DatabaseFacade from '../../database/database_facade.js';
import { GameStatus, type GameData, type GuildGameData } from '../../database/database_defs.js';
import { client } from '../../main.js';
import { Constants } from '../../misc/constants.js';
import GameManager from '../game_manager.js';
import GameScreeningComponent from '../../interaction/components/game_screening_component.js';
import GameScreeningGuildComponent from '../../interaction/components/game_screening_guild_component.js';

export default class GameScreeningOperator {
  static async screenGame(game: Activity) {
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

    const controlServer = client.guilds.cache.get(Constants.CONTROL_SERVER_ID);
    const gameChannel = controlServer?.channels.cache.get(gameChannelId);
    if (!gameChannel || !gameChannel.isSendable()) return;

    const embed = GameManager.makeScreeningEmbed(data);
    await gameChannel.send({ embeds: [embed], components: GameScreeningComponent.data() });
  }

  static async screenGuildGame(game: Activity, guild: Guild) {
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
}
