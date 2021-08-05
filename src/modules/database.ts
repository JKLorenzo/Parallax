import { Collection, Snowflake } from 'discord.js';
import mongodb from 'mongodb';
import {
  DedicatedConfig,
  FreeGameConfig,
  GameConfig,
  GuildConfig,
  NSFWConfig,
  PlayConfig,
  StreamingConfig,
} from '../utils/types.js';

const _config = new Collection<Snowflake, GuildConfig>();
const _global = new Collection<string, unknown>();
const mongoClient = new mongodb.MongoClient(process.env.DB_URI!);

export async function connectDb(): Promise<void> {
  await mongoClient.connect();
}

export async function getGlobalConfig<T>(key: string): Promise<T | undefined> {
  if (!_global.get(key)) {
    const result = await mongoClient.db('global').collection('config').findOne({ _id: key });
    if (result) _global.set(key, result._value ?? { ...result });
  }
  return _global.get(key) as T;
}

export async function updateGlobalConfig<T>(key: string, value: T): Promise<void> {
  await mongoClient
    .db('global')
    .collection('config')
    .updateOne(
      { _id: key },
      { $set: Object.keys(value).length ? { ...value } : { _value: value } },
      { upsert: true },
    );
  _global.set(key, value);
}

export async function getDedicatedConfig(guildId: Snowflake): Promise<DedicatedConfig | undefined> {
  if (!_config.get(guildId)?.dedicated) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'dedicated' });

    _config.set(guildId, {
      dedicated: {
        hoisted: result?.hoisted,
        reference_role: result?.reference_role,
        text_category: result?.text_category,
        voice_category: result?.voice_category,
      },
    });
  }

  return _config.get(guildId)?.dedicated;
}

export async function updateDedicatedConfig(
  guildId: Snowflake,
  data: DedicatedConfig,
): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _config.get(guildId) ?? {};
  if (!config.dedicated) config.dedicated = {};
  if ('hoisted' in data) config.dedicated.hoisted = data.hoisted;
  if ('reference_role' in data) config.dedicated.reference_role = data.reference_role;
  if ('text_category' in data) config.dedicated.text_category = data.text_category;
  if ('voice_category' in data) config.dedicated.voice_category = data.voice_category;
  _config.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'dedicated' }, { $set: config.dedicated }, { upsert: true });
}

export async function getFreeGameConfig(guildId: Snowflake): Promise<FreeGameConfig | undefined> {
  if (!_config.get(guildId)?.free_game) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'free_game' });

    _config.set(guildId, {
      free_game: {
        free_games_channel: result?.free_games_channel,
        epic_role: result?.epic_role,
        gog_role: result?.gog_role,
        ps_role: result?.ps_role,
        steam_role: result?.steam_role,
        uplay_role: result?.uplay_role,
        wii_role: result?.wii_role,
        xbox_role: result?.xbox_role,
      },
    });
  }

  return _config.get(guildId)?.free_game;
}

export async function updateFreeGameConfig(
  guildId: Snowflake,
  data: FreeGameConfig,
): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _config.get(guildId) ?? {};
  if (!config.free_game) config.free_game = {};
  if ('free_games_channel' in data) config.free_game.free_games_channel = data.free_games_channel;
  if ('epic_role' in data) config.free_game.epic_role = data.epic_role;
  if ('gog_role' in data) config.free_game.gog_role = data.gog_role;
  if ('ps_role' in data) config.free_game.ps_role = data.ps_role;
  if ('steam_role' in data) config.free_game.steam_role = data.steam_role;
  if ('uplay_role' in data) config.free_game.uplay_role = data.uplay_role;
  if ('wii_role' in data) config.free_game.wii_role = data.wii_role;
  if ('xbox_role' in data) config.free_game.xbox_role = data.xbox_role;
  _config.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'free_game' }, { $set: config.free_game }, { upsert: true });
}

export async function getGameConfig(guildId: Snowflake): Promise<GameConfig | undefined> {
  if (!_config.get(guildId)?.game) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'game' });

    _config.set(guildId, {
      game: {
        enabled: result?.enabled,
        mentionable: result?.mentionable,
        color: result?.color,
        invite_channel: result?.invite_channel,
        reference_role: result?.reference_role,
      },
    });
  }

  return _config.get(guildId)?.game;
}

export async function updateGameConfig(guildId: Snowflake, data: GameConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _config.get(guildId) ?? {};
  if (!config.game) config.game = {};
  if ('enabled' in data) config.game.enabled = data.enabled;
  if ('mentionable' in data) config.game.mentionable = data.mentionable;
  if ('color' in data) config.game.color = data.color;
  if ('invite_channel' in data) config.game.invite_channel = data.invite_channel;
  if ('reference_role' in data) config.game.reference_role = data.reference_role;
  _config.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'game' }, { $set: config.game }, { upsert: true });
}

export async function getNSFWConfig(guildId: Snowflake): Promise<NSFWConfig | undefined> {
  if (!_config.get(guildId)?.nsfw) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'nsfw' });

    _config.set(guildId, {
      nsfw: {
        nsfw_channels: result?.nsfw_channels,
        nsfw_role: result?.nsfw_role,
      },
    });
  }

  return _config.get(guildId)?.nsfw;
}

export async function updateNSFWConfig(guildId: Snowflake, data: NSFWConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _config.get(guildId) ?? {};
  if (!config.nsfw) config.nsfw = {};
  if ('nsfw_channels' in data) config.nsfw.nsfw_channels = data.nsfw_channels;
  if ('nsfw_role' in data) config.nsfw.nsfw_role = data.nsfw_role;
  _config.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'nsfw' }, { $set: config.nsfw }, { upsert: true });
}

export async function getPlayConfig(guildId: Snowflake): Promise<GameConfig | undefined> {
  if (!_config.get(guildId)?.play) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'play' });

    _config.set(guildId, {
      play: {
        enabled: result?.enabled,
        mentionable: result?.mentionable,
        reference_role: result?.reference_role,
      },
    });
  }

  return _config.get(guildId)?.play;
}

export async function updatePlayConfig(guildId: Snowflake, data: PlayConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _config.get(guildId) ?? {};
  if (!config.play) config.play = {};
  if ('enabled' in data) config.play.enabled = data.enabled;
  if ('mentionable' in data) config.play.mentionable = data.mentionable;
  if ('reference_role' in data) config.play.reference_role = data.reference_role;
  _config.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'play' }, { $set: config.play }, { upsert: true });
}

export async function getStreamingConfig(guildId: Snowflake): Promise<StreamingConfig | undefined> {
  if (!_config.get(guildId)?.streaming) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'streaming' });

    _config.set(guildId, {
      streaming: {
        enabled: result?.enabled,
        streaming_role: result?.streaming_role,
      },
    });
  }

  return _config.get(guildId)?.streaming;
}

export async function updateStreamingConfig(
  guildId: Snowflake,
  data: StreamingConfig,
): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _config.get(guildId) ?? {};
  if (!config.streaming) config.streaming = {};
  if ('enabled' in data) config.streaming.enabled = data.enabled;
  if ('streaming_role' in data) config.streaming.streaming_role = data.streaming_role;
  _config.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'streaming' }, { $set: config.streaming }, { upsert: true });
}
