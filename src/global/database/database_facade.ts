import type { Snowflake } from 'discord.js';
import { MongoClient } from 'mongodb';
import type {
  BotConfigKeys,
  GatewayConfig,
  GuildConfig,
  MemberData,
  MusicConfig,
} from './database_defs.js';
import EnvironmentFacade from '../environment/environment_facade.js';

export default class DatabaseFacade {
  private static _instance: DatabaseFacade;
  private mongoClient!: MongoClient;
  private botConfigCache: Map<string, string>;
  private guildConfigCache: Map<string, GuildConfig>;
  private memberDataCache: Map<string, Map<string, MemberData>>;

  private constructor() {
    this.botConfigCache = new Map();
    this.guildConfigCache = new Map();
    this.memberDataCache = new Map();
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
        .updateOne({ id: member.id }, { $set: member }, { upsert: true });
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
}
