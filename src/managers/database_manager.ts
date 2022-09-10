import type { Snowflake } from 'discord.js';
import { MongoClient } from 'mongodb';
import type Bot from '../modules/bot.js';
import type { BotConfigKeys, GuildConfig, MusicConfig } from '../schemas/types.js';
import Manager from '../structures/manager.js';

export default class DatabaseManager extends Manager {
  private mongoClient!: MongoClient;
  private botConfigCache: Map<string, string>;
  private guildConfigCache: Map<string, GuildConfig>;

  constructor(bot: Bot) {
    super(bot);

    this.botConfigCache = new Map();
    this.guildConfigCache = new Map();
  }

  async init() {
    this.mongoClient = new MongoClient(this.bot.managers.environment.get('dbUri'));

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
}
