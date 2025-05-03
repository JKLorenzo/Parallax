import { type Snowflake } from 'discord.js';
import { MongoClient } from 'mongodb';
import {
  type BotConfigKeys,
  type GameConfig,
  type GameData,
  type GatewayConfig,
  type GuildConfig,
  type GuildGameData,
  type MemberData,
  type MusicConfig,
} from './database_defs.js';
import EnvironmentFacade from '../environment/environment_facade.js';

export default class DatabaseFacade {
  private static _instance: DatabaseFacade;
  private mongoClient!: MongoClient;
  private botConfigCache: Map<string, string>;
  private guildConfigCache: Map<string, GuildConfig>;
  private memberDataCache: Map<string, Map<string, MemberData>>;
  private gameDataCache: Map<string, GameData>;
  private guildGameDataCache: Map<string, Map<string, GuildGameData>>;

  private constructor() {
    this.botConfigCache = new Map();
    this.guildConfigCache = new Map();
    this.memberDataCache = new Map();
    this.gameDataCache = new Map();
    this.guildGameDataCache = new Map();
  }

  static instance() {
    if (!this._instance) {
      this._instance = new DatabaseFacade();
    }

    return this._instance;
  }

  async init() {
    const env = EnvironmentFacade.instance();
    this.mongoClient = new MongoClient(env.get('dbUri'));

    await this.mongoClient.connect();
  }

  async botConfig(key: BotConfigKeys, value?: string) {
    if (typeof value !== 'undefined') {
      // Upsert
      this.botConfigCache.set(key, value);

      await this.mongoClient
        .db('global')
        .collection('config')
        .updateOne({ key }, { $set: { value } }, { upsert: true });
    } else if (!this.botConfigCache.get(key)) {
      // Get
      const result = await this.mongoClient.db('global').collection('config').findOne({ key });
      if (result?.value) this.botConfigCache.set(key, result.value);
    }

    return this.botConfigCache.get(key);
  }

  async musicConfig(guildId: Snowflake, data?: MusicConfig) {
    if (data && Object.keys(data).length > 0) {
      // Upsert
      const config = this.guildConfigCache.get(guildId) ?? {};
      if (!config.music) config.music = {};
      if ('enabled' in data) config.music.enabled = data.enabled;
      if ('channel' in data) config.music.channel = data.channel;
      if ('ignored_prefix' in data) config.music.ignored_prefix = data.ignored_prefix;
      this.guildConfigCache.set(guildId, config);

      await this.mongoClient
        .db(guildId)
        .collection('config')
        .updateOne({ name: 'music' }, { $set: config.music }, { upsert: true });
    } else if (!this.guildConfigCache.get(guildId)?.music) {
      // Get
      const result = await this.mongoClient
        .db(guildId)
        .collection('config')
        .findOne({ name: 'music' });

      this.guildConfigCache.set(guildId, {
        music: {
          enabled: result?.enabled,
          channel: result?.channel,
          ignored_prefix: result?.ignored_prefix,
        },
      });
    }

    return this.guildConfigCache.get(guildId)?.music;
  }

  async gatewayConfig(guildId: Snowflake, data?: GatewayConfig) {
    if (data && Object.keys(data).length > 0) {
      // Upsert
      const config = this.guildConfigCache.get(guildId) ?? {};
      if (!config.gateway) config.gateway = {};
      if ('enabled' in data) config.gateway.enabled = data.enabled;
      if ('channel' in data) config.gateway.channel = data.channel;
      if ('role' in data) config.gateway.role = data.role;
      this.guildConfigCache.set(guildId, config);

      await this.mongoClient
        .db(guildId)
        .collection('config')
        .updateOne({ name: 'gateway' }, { $set: config.gateway }, { upsert: true });
    } else if (!this.guildConfigCache.get(guildId)?.gateway) {
      // Get
      const result = await this.mongoClient
        .db(guildId)
        .collection('config')
        .findOne({ name: 'gateway' });

      this.guildConfigCache.set(guildId, {
        gateway: {
          enabled: result?.enabled,
          channel: result?.channel,
          role: result?.role,
        },
      });
    }

    return this.guildConfigCache.get(guildId)?.gateway;
  }

  async gameConfig(guildId: Snowflake, data?: GameConfig) {
    if (data && Object.keys(data).length > 0) {
      // Upsert
      const config = this.guildConfigCache.get(guildId) ?? {};
      if (!config.game) config.game = {};
      if ('enabled' in data) config.game.enabled = data.enabled;
      if ('channel' in data) config.game.channel = data.channel;
      if ('role' in data) config.game.role = data.role;
      this.guildConfigCache.set(guildId, config);

      await this.mongoClient
        .db(guildId)
        .collection('config')
        .updateOne({ name: 'game' }, { $set: config.game }, { upsert: true });
    } else if (!this.guildConfigCache.get(guildId)?.game) {
      // Get
      const result = await this.mongoClient
        .db(guildId)
        .collection('config')
        .findOne({ name: 'game' });

      this.guildConfigCache.set(guildId, {
        game: {
          enabled: result?.enabled,
          channel: result?.channel,
          role: result?.role,
        },
      });
    }

    return this.guildConfigCache.get(guildId)?.game;
  }

  async memberData(guildId: Snowflake, memberId: Snowflake, data?: MemberData) {
    if (data && Object.keys(data).length > 0) {
      // Upsert
      const members = this.memberDataCache.get(guildId) ?? new Map<string, MemberData>();
      const member: MemberData = members.get(memberId) ?? { id: memberId };

      if ('tag' in data) member.tag = data.tag;
      if ('inviter' in data) member.inviter = data.inviter;
      if ('inviterTag' in data) member.inviterTag = data.inviterTag;
      if ('moderator' in data) member.moderator = data.moderator;
      if ('moderatorTag' in data) member.moderatorTag = data.moderatorTag;
      members.set(memberId, member);
      this.memberDataCache.set(guildId, members);

      await this.mongoClient
        .db(guildId)
        .collection('members')
        .updateOne({ id: memberId }, { $set: member }, { upsert: true });
    } else if (!this.memberDataCache.get(guildId)?.get(memberId)) {
      // Get
      const result = await this.mongoClient
        .db(guildId)
        .collection('members')
        .findOne({ id: memberId });

      const members = this.memberDataCache.get(guildId) ?? new Map<string, MemberData>();
      const member: MemberData = {
        id: memberId,
        tag: result?.tag,
        inviter: result?.inviter,
        inviterTag: result?.inviterTag,
        moderator: result?.moderator,
        moderatorTag: result?.moderatorTag,
      };

      members.set(memberId, member);
      this.memberDataCache.set(guildId, members);
    }

    return this.memberDataCache.get(guildId)?.get(memberId);
  }

  async gameData(applicationId: string, data?: GameData) {
    if (data && Object.keys(data).length > 0) {
      // Upsert
      const game = this.gameDataCache.get(applicationId) ?? { id: applicationId };

      if ('name' in data) game.name = data.name;
      if ('status' in data) game.status = data.status;
      if ('iconURLs' in data) game.iconURLs = data.iconURLs;
      if ('iconIndex' in data) game.iconIndex = data.iconIndex;
      if ('bannerURLs' in data) game.bannerURLs = data.bannerURLs;
      if ('bannerIndex' in data) game.bannerIndex = data.bannerIndex;
      if ('moderatorId' in data) game.moderatorId = data.moderatorId;
      this.gameDataCache.set(applicationId, game);

      await this.mongoClient
        .db('global')
        .collection('games')
        .updateOne({ id: applicationId }, { $set: game }, { upsert: true });
    } else if (!this.gameDataCache.get(applicationId)) {
      // Get
      const result = await this.mongoClient
        .db('global')
        .collection('games')
        .findOne({ id: applicationId });

      if (result?._id) {
        this.gameDataCache.set(applicationId, {
          id: applicationId,
          name: result?.name,
          status: result?.status,
          iconURLs: result?.iconURLs,
          iconIndex: result?.iconIndex,
          bannerURLs: result?.bannerURLs,
          bannerIndex: result?.bannerIndex,
          moderatorId: result?.moderatorId,
        });
      }
    }

    return this.gameDataCache.get(applicationId);
  }

  async guildGameData(guildId: string, applicationId: string, data?: GuildGameData) {
    if (data && Object.keys(data).length > 0) {
      // Upsert
      const guildGames = this.guildGameDataCache.get(guildId) ?? new Map<string, GuildGameData>();
      const guildGame: GuildGameData = guildGames.get(applicationId) ?? { id: applicationId };

      if ('status' in data) guildGame.status = data.status;
      if ('roleId' in data) guildGame.roleId = data.roleId;
      if ('moderatorId' in data) guildGame.moderatorId = data.moderatorId;
      if ('lastPlayed' in data) guildGame.lastPlayed = data.lastPlayed;
      guildGames.set(applicationId, guildGame);
      this.guildGameDataCache.set(guildId, guildGames);

      await this.mongoClient
        .db(guildId)
        .collection('games')
        .updateOne({ id: applicationId }, { $set: guildGame }, { upsert: true });
    } else if (!this.guildGameDataCache.get(guildId)?.get(applicationId)) {
      // Get
      const result = await this.mongoClient
        .db(guildId)
        .collection('games')
        .findOne({ id: applicationId });

      if (result?._id) {
        const guildGames = this.guildGameDataCache.get(guildId) ?? new Map<string, GuildGameData>();
        const guildGame: GuildGameData = {
          id: applicationId,
          status: result?.status,
          roleId: result?.roleId,
          moderatorId: result?.moderatorId,
          lastPlayed: result?.lastPlayed,
        };

        guildGames.set(applicationId, guildGame);
        this.guildGameDataCache.set(guildId, guildGames);
      }
    }

    return this.guildGameDataCache.get(guildId)?.get(applicationId);
  }

  async findGuildGameByRole(guildId: Snowflake, roleId: Snowflake) {
    const guildGames = this.guildGameDataCache.get(guildId) ?? new Map<string, GuildGameData>();
    if (![...guildGames.values()].some(game => game.roleId === roleId)) {
      const result = await this.mongoClient
        .db(guildId)
        .collection('games')
        .findOne({ roleId: roleId });

      if (result?._id) {
        const guildGame: GuildGameData = {
          id: result.id,
          status: result?.status,
          roleId: result?.roleId,
          moderatorId: result?.moderatorId,
          lastPlayed: result?.lastPlayed,
        };

        guildGames.set(result.id, guildGame);
        this.guildGameDataCache.set(guildId, guildGames);
      }
    }

    const newGuildGames = this.guildGameDataCache.get(guildId);
    if (!newGuildGames) return;

    return [...newGuildGames.values()].find(guildGame => guildGame.roleId === roleId);
  }
}
