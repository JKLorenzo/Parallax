import { Role, Snowflake } from 'discord.js';
import mongodb from 'mongodb';
import { hexToUtf, utfToHex } from '../utils/functions.js';
import Limiter from '../utils/limiter.js';
import {
  BotConfigKeys,
  DedicatedConfig,
  FreeGameConfig,
  GameConfig,
  GameData,
  GuildConfig,
  ImageData,
  NSFWConfig,
  PlayConfig,
  StreamingConfig,
} from '../utils/types.js';

const mongoClient = new mongodb.MongoClient(process.env.DB_URI!);

const _botconfig = new Map<string, string>();
const _guildconfig = new Map<Snowflake, GuildConfig>();

const _games = new Map<string, GameData>();
const _images = new Map<string, ImageData>();

const _gameroles = new Map<string, Map<string, string>>();

const _limiter = new Limiter(1800000);

export async function connectDb(): Promise<void> {
  await mongoClient.connect();
}

export async function getBotConfig(key: BotConfigKeys): Promise<string | undefined> {
  if (!_botconfig.get(key)) {
    const result = await mongoClient.db('global').collection('config').findOne({ _id: key });
    if (result?.value) _botconfig.set(key, result.value);
  }
  return _botconfig.get(key);
}

export async function setBotConfig(key: BotConfigKeys, value: string): Promise<void> {
  _botconfig.set(key, value);
  await mongoClient
    .db('global')
    .collection('config')
    .updateOne({ _id: key }, { $set: { value: value } }, { upsert: true });
}

export async function updateUserGame(userId: Snowflake, game_name: string): Promise<void> {
  const hex_name = utfToHex(game_name);

  if (_limiter.limit(`${userId}-${hex_name}`)) return;

  await mongoClient
    .db('users')
    .collection(userId)
    .updateOne(
      { _id: hex_name, type: 'game' },
      { $set: { _id: hex_name, type: 'game', last_updated: Date.now() } },
      { upsert: true },
    );
}

export async function getExpiredUserGames(): Promise<Map<string, string[]>> {
  const collections = await mongoClient.db('users').collections();
  const expired = new Map<string, string[]>();
  for (const collection of collections) {
    // Expire in 7 days
    const expire_time = Date.now() - 604800000;
    const result = await collection
      .find({
        type: 'game',
        last_updated: { $lte: expire_time },
      })
      .toArray();

    if (result.length === 0) continue;

    expired.set(
      collection.collectionName,
      result.map(r => hexToUtf(r._id)),
    );
  }
  return expired;
}

export async function getImage(name: string): Promise<ImageData | undefined> {
  const id = utfToHex(name);
  if (!_images.get(id)) {
    const result = await mongoClient.db('global').collection('images').findOne({ _id: id });
    if (result) {
      _images.set(id, {
        name: name,
        bannerUrl: result.bannerUrl,
        iconUrl: result.iconUrl,
      });
    }
  }
  return _images.get(id);
}

export async function updateImage(data: ImageData): Promise<void> {
  if (Object.keys(data).length === 0) return;
  if (!data.name) return;

  const id = utfToHex(data.name);
  await mongoClient
    .db('global')
    .collection('images')
    .updateOne({ _id: id }, { $set: data }, { upsert: true });
}

export async function getGame(name: string): Promise<GameData | undefined> {
  const id = utfToHex(name);
  if (!_games.get(id)) {
    const result = await mongoClient.db('global').collection('games').findOne({ _id: id });
    if (result) {
      _games.set(id, {
        name: result.name,
        status: result.status,
      });
    }
  }
  return _games.get(id);
}

export async function updateGame(data: GameData): Promise<void> {
  if (Object.keys(data).length === 0) return;
  if (!data.name) return;

  const id = utfToHex(data.name);
  _games.set(id, data);
  await mongoClient
    .db('global')
    .collection('games')
    .updateOne({ _id: id }, { $set: data }, { upsert: true });
}

export async function getDedicatedConfig(guildId: Snowflake): Promise<DedicatedConfig | undefined> {
  if (!_guildconfig.get(guildId)?.dedicated) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'dedicated' });

    _guildconfig.set(guildId, {
      dedicated: {
        hoisted: result?.hoisted,
        reference_role: result?.reference_role,
        text_category: result?.text_category,
        voice_category: result?.voice_category,
      },
    });
  }

  return _guildconfig.get(guildId)?.dedicated;
}

export async function updateDedicatedConfig(
  guildId: Snowflake,
  data: DedicatedConfig,
): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.dedicated) config.dedicated = {};
  if ('hoisted' in data) config.dedicated.hoisted = data.hoisted;
  if ('reference_role' in data) config.dedicated.reference_role = data.reference_role;
  if ('text_category' in data) config.dedicated.text_category = data.text_category;
  if ('voice_category' in data) config.dedicated.voice_category = data.voice_category;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'dedicated' }, { $set: config.dedicated }, { upsert: true });
}

export async function getFreeGameConfig(guildId: Snowflake): Promise<FreeGameConfig | undefined> {
  if (!_guildconfig.get(guildId)?.free_game) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'free_game' });

    _guildconfig.set(guildId, {
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

  return _guildconfig.get(guildId)?.free_game;
}

export async function updateFreeGameConfig(
  guildId: Snowflake,
  data: FreeGameConfig,
): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.free_game) config.free_game = {};
  if ('free_games_channel' in data) config.free_game.free_games_channel = data.free_games_channel;
  if ('epic_role' in data) config.free_game.epic_role = data.epic_role;
  if ('gog_role' in data) config.free_game.gog_role = data.gog_role;
  if ('ps_role' in data) config.free_game.ps_role = data.ps_role;
  if ('steam_role' in data) config.free_game.steam_role = data.steam_role;
  if ('uplay_role' in data) config.free_game.uplay_role = data.uplay_role;
  if ('wii_role' in data) config.free_game.wii_role = data.wii_role;
  if ('xbox_role' in data) config.free_game.xbox_role = data.xbox_role;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'free_game' }, { $set: config.free_game }, { upsert: true });
}

export async function getGameConfig(guildId: Snowflake): Promise<GameConfig | undefined> {
  if (!_guildconfig.get(guildId)?.game) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'game' });

    _guildconfig.set(guildId, {
      game: {
        enabled: result?.enabled,
        mentionable: result?.mentionable,
        invite_channel: result?.invite_channel,
        reference_role: result?.reference_role,
      },
    });
  }

  return _guildconfig.get(guildId)?.game;
}

export async function updateGameConfig(guildId: Snowflake, data: GameConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.game) config.game = {};
  if ('enabled' in data) config.game.enabled = data.enabled;
  if ('mentionable' in data) config.game.mentionable = data.mentionable;
  if ('invite_channel' in data) config.game.invite_channel = data.invite_channel;
  if ('reference_role' in data) config.game.reference_role = data.reference_role;

  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'game' }, { $set: config.game }, { upsert: true });
}

export async function getGuildGameRoles(guildId: Snowflake): Promise<Map<string, string>> {
  if (!_gameroles.get(guildId)) {
    const result = await mongoClient.db(guildId).collection('game_roles').find().toArray();
    _gameroles.set(guildId, new Map(result.map(r => [r._id, r.role_id])));
  }
  return _gameroles.get(guildId) ?? new Map();
}

export async function addGuildGameRole(role: Role): Promise<void> {
  const guildId = role.guild.id;
  const games = await getGuildGameRoles(guildId);
  const hex_name = utfToHex(role.name);

  _gameroles.set(guildId, games.set(hex_name, role.id));

  await mongoClient
    .db(guildId)
    .collection('game_roles')
    .updateOne({ _id: hex_name }, { $set: { role_id: role.id } }, { upsert: true });
}

export async function getNSFWConfig(guildId: Snowflake): Promise<NSFWConfig | undefined> {
  if (!_guildconfig.get(guildId)?.nsfw) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'nsfw' });

    _guildconfig.set(guildId, {
      nsfw: {
        nsfw_channels: result?.nsfw_channels,
        nsfw_role: result?.nsfw_role,
      },
    });
  }

  return _guildconfig.get(guildId)?.nsfw;
}

export async function updateNSFWConfig(guildId: Snowflake, data: NSFWConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.nsfw) config.nsfw = {};
  if ('nsfw_channels' in data) config.nsfw.nsfw_channels = data.nsfw_channels;
  if ('nsfw_role' in data) config.nsfw.nsfw_role = data.nsfw_role;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'nsfw' }, { $set: config.nsfw }, { upsert: true });
}

export async function getPlayConfig(guildId: Snowflake): Promise<PlayConfig | undefined> {
  if (!_guildconfig.get(guildId)?.play) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'play' });

    _guildconfig.set(guildId, {
      play: {
        enabled: result?.enabled,
        hoisted: result?.hoisted,
        mentionable: result?.mentionable,
        reference_role: result?.reference_role,
      },
    });
  }

  return _guildconfig.get(guildId)?.play;
}

export async function updatePlayConfig(guildId: Snowflake, data: PlayConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.play) config.play = {};
  if ('enabled' in data) config.play.enabled = data.enabled;
  if ('hoisted' in data) config.play.hoisted = data.hoisted;
  if ('mentionable' in data) config.play.mentionable = data.mentionable;
  if ('reference_role' in data) config.play.reference_role = data.reference_role;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'play' }, { $set: config.play }, { upsert: true });
}

export async function getStreamingConfig(guildId: Snowflake): Promise<StreamingConfig | undefined> {
  if (!_guildconfig.get(guildId)?.streaming) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ _id: 'streaming' });

    _guildconfig.set(guildId, {
      streaming: {
        enabled: result?.enabled,
        streaming_role: result?.streaming_role,
      },
    });
  }

  return _guildconfig.get(guildId)?.streaming;
}

export async function updateStreamingConfig(
  guildId: Snowflake,
  data: StreamingConfig,
): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.streaming) config.streaming = {};
  if ('enabled' in data) config.streaming.enabled = data.enabled;
  if ('streaming_role' in data) config.streaming.streaming_role = data.streaming_role;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ _id: 'streaming' }, { $set: config.streaming }, { upsert: true });
}
