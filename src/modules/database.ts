import { Snowflake } from 'discord.js';
import mongodb from 'mongodb';
import { logError } from './telemetry.js';
import { utfToHex } from '../utils/functions.js';
import Limiter from '../utils/limiter.js';
import {
  BotConfigKeys,
  FreeGameConfig,
  GameConfig,
  GameData,
  GuildConfig,
  ImageData,
  MusicConfig,
  PlayConfig,
  RedditPostData,
  GatewayConfig,
  MemberData,
} from '../utils/types.js';

const mongoClient = new mongodb.MongoClient(process.env.DB_URI!);

const _botconfig = new Map<string, string>();
const _guildconfig = new Map<Snowflake, GuildConfig>();

const _games = new Map<string, GameData | undefined>();
const _images = new Map<string, ImageData>();
const _freegames = new Map<string, RedditPostData>();
const _usergames = new Map<string, string[]>();

const _memberdata = new Map<string, Map<string, MemberData>>();

const _limiter = new Limiter(1800000);

export async function initDatabase(): Promise<void> {
  await mongoClient.connect();
}

export async function getBotConfig(key: BotConfigKeys): Promise<string | undefined> {
  if (!_botconfig.get(key)) {
    const result = await mongoClient.db('global').collection('config').findOne({ key });
    if (result?.value) _botconfig.set(key, result.value);
  }
  return _botconfig.get(key);
}

export async function setBotConfig(key: BotConfigKeys, value: string): Promise<void> {
  _botconfig.set(key, value);
  await mongoClient
    .db('global')
    .collection('config')
    .updateOne({ key }, { $set: { value } }, { upsert: true });
}

export async function getUserGames(userId: Snowflake): Promise<string[]> {
  const games = _usergames.get(userId) ?? [];
  if (!_limiter.limit(`${userId}-getusergames`)) {
    const result = await mongoClient
      .db('users')
      .collection(userId)
      .find({ type: 'game' })
      .toArray();

    for (const data of result) {
      if (games.includes(data.name)) continue;
      games.push(data.name);
    }
    _usergames.set(userId, games);
  }
  return games;
}

export async function updateUserGame(userId: Snowflake, game_name: string): Promise<void> {
  const hex_name = utfToHex(game_name);
  if (_limiter.limit(`${userId}-updateusergame-${hex_name}`)) return;

  const games = await getUserGames(userId);
  if (!games.includes(game_name)) _usergames.set(userId, [...games, game_name]);

  await mongoClient
    .db('users')
    .collection(userId)
    .updateOne(
      { name: game_name, type: 'game' },
      { $set: { last_updated: Date.now() } },
      { upsert: true },
    );
}

export async function getUserExpiredGames(): Promise<Map<string, string[]>> {
  // Expire in 7 days
  const seven_days = 604800000;
  const expire_time = Date.now() - seven_days;
  const expired = new Map<string, string[]>();

  try {
    const collections = await mongoClient.db('users').collections();

    for (const collection of collections) {
      const user_id = collection.collectionName;
      let result;

      try {
        result = await collection
          .find({
            type: 'game',
            last_updated: { $lte: expire_time },
          })
          .toArray();
      } catch (error) {
        logError('Database', 'Fetch User Expired Games', error);
      }

      if (!result || result.length === 0) continue;

      try {
        const games = await getUserGames(user_id);
        const expired_games = result.map(r => r.name);

        _usergames.set(
          user_id,
          games.filter(g => !expired_games.includes(g)),
        );

        await collection.deleteMany({ name: { $in: result.map(r => r.name) }, type: 'game' });

        expired.set(user_id, expired_games);
      } catch (error) {
        logError('Database', 'Clear User Expired Games', error);
      }
    }
  } catch (error) {
    logError('Database', 'Get User Expired Games', error);
  }

  return expired;
}

export async function getImage(name: string): Promise<ImageData | undefined> {
  const id = utfToHex(name);
  if (!_images.get(id)) {
    const result = await mongoClient.db('global').collection('images').findOne({ name });

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
  const image = (await getImage(data.name)) ?? { name: data.name };
  if ('bannerUrl' in data) image.bannerUrl = data.bannerUrl;
  if ('iconUrl' in data) image.iconUrl = data.iconUrl;
  _images.set(id, image);

  await mongoClient
    .db('global')
    .collection('images')
    .updateOne({ name: image.name }, { $set: image }, { upsert: true });
}

export async function getGame(name: string): Promise<GameData | undefined> {
  const id = utfToHex(name);
  if (!_games.has(id)) {
    const result = await mongoClient.db('global').collection('games').findOne({ name });

    _games.set(
      id,
      result && 'name' in result && 'status' in result
        ? {
            name: result.name,
            status: result.status,
          }
        : undefined,
    );
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
    .updateOne({ name: data.name }, { $set: data }, { upsert: true });
}

export async function getFreeGame(url: string): Promise<RedditPostData | undefined> {
  if (!_freegames.get(url)) {
    // Only get the latest (a week old)
    const week_old = Date.now() - 604800000;
    const result = await mongoClient
      .db('global')
      .collection('free_games')
      .find({ url: url, created: { $gte: week_old } })
      .sort({ created: -1 })
      .limit(1)
      .toArray();

    if (result && result.length) {
      const data = result[0];
      _freegames.set(url, {
        author: data.author,
        created: data.created,
        domain: data.domain,
        link_flair_text: data.link_flair_text,
        permalink: data.permalink,
        score: data.score,
        selftext: data.selftext,
        title: data.title,
        upvote_ratio: data.upvote_ratio,
        url: data.url,
      });
    }
  }

  return _freegames.get(url);
}

export async function pushFreeGame(data: RedditPostData): Promise<void> {
  _freegames.set(data.url, data);
  await mongoClient.db('global').collection('free_games').insertOne(data);
}

export async function getFreeGameConfig(guildId: Snowflake): Promise<FreeGameConfig | undefined> {
  if (!_guildconfig.get(guildId)?.free_game) {
    const result = await mongoClient
      .db(guildId)
      .collection('config')
      .findOne({ name: 'free_game' });

    _guildconfig.set(guildId, {
      free_game: {
        enabled: result?.enabled,
        channel: result?.channel,
        steam_role: result?.steam_role,
        epic_role: result?.epic_role,
        gog_role: result?.gog_role,
        ps_role: result?.ps_role,
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
  if ('enabled' in data) config.free_game.enabled = data.enabled;
  if ('channel' in data) config.free_game.channel = data.channel;
  if ('steam_role' in data) config.free_game.steam_role = data.steam_role;
  if ('epic_role' in data) config.free_game.epic_role = data.epic_role;
  if ('gog_role' in data) config.free_game.gog_role = data.gog_role;
  if ('ps_role' in data) config.free_game.ps_role = data.ps_role;
  if ('xbox_role' in data) config.free_game.xbox_role = data.xbox_role;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ name: 'free_game' }, { $set: config.free_game }, { upsert: true });
}

export async function getGameConfig(guildId: Snowflake): Promise<GameConfig | undefined> {
  if (!_guildconfig.get(guildId)?.game) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ name: 'game' });

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
    .updateOne({ name: 'game' }, { $set: config.game }, { upsert: true });
}

export async function getPlayConfig(guildId: Snowflake): Promise<PlayConfig | undefined> {
  if (!_guildconfig.get(guildId)?.play) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ name: 'play' });

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
    .updateOne({ name: 'play' }, { $set: config.play }, { upsert: true });
}

export async function getMusicConfig(guildId: Snowflake): Promise<MusicConfig | undefined> {
  if (!_guildconfig.get(guildId)?.music) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ name: 'music' });

    _guildconfig.set(guildId, {
      music: {
        enabled: result?.enabled,
        channel: result?.channel,
      },
    });
  }

  return _guildconfig.get(guildId)?.music;
}

export async function updateMusicConfig(guildId: Snowflake, data: MusicConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.music) config.music = {};
  if ('enabled' in data) config.music.enabled = data.enabled;
  if ('channel' in data) config.music.channel = data.channel;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ name: 'music' }, { $set: config.music }, { upsert: true });
}

export async function getGatewayConfig(guildId: Snowflake): Promise<GatewayConfig | undefined> {
  if (!_guildconfig.get(guildId)?.gateway) {
    const result = await mongoClient.db(guildId).collection('config').findOne({ name: 'gateway' });

    _guildconfig.set(guildId, {
      gateway: {
        enabled: result?.enabled,
        channel: result?.channel,
        role: result?.role,
      },
    });
  }

  return _guildconfig.get(guildId)?.gateway;
}

export async function updateGatewayConfig(guildId: Snowflake, data: GatewayConfig): Promise<void> {
  if (Object.keys(data).length === 0) return;

  const config = _guildconfig.get(guildId) ?? {};
  if (!config.gateway) config.gateway = {};
  if ('enabled' in data) config.gateway.enabled = data.enabled;
  if ('channel' in data) config.gateway.channel = data.channel;
  if ('role' in data) config.gateway.role = data.role;
  _guildconfig.set(guildId, config);

  await mongoClient
    .db(guildId)
    .collection('config')
    .updateOne({ name: 'gateway' }, { $set: config.gateway }, { upsert: true });
}

export async function getMemberData(
  guildId: Snowflake,
  memberId: Snowflake,
): Promise<MemberData | undefined> {
  if (!_memberdata.get(guildId)?.get(memberId)) {
    const result = await mongoClient.db(guildId).collection('members').findOne({ id: memberId });

    const members = _memberdata.get(guildId) ?? new Map<string, MemberData>();
    const member: MemberData = {
      id: memberId,
      tag: result?.tag,
      inviter: result?.inviter,
      inviterTag: result?.inviterTag,
      moderator: result?.moderator,
      moderatorTag: result?.moderatorTag,
    };

    members.set(memberId, member);
    _memberdata.set(guildId, members);
  }

  return _memberdata.get(guildId)?.get(memberId);
}

export async function setMemberData(guildId: Snowflake, data: MemberData): Promise<void> {
  const members = _memberdata.get(guildId) ?? new Map<string, MemberData>();
  const member: MemberData = members.get(data.id) ?? { id: data.id };
  if ('tag' in data) member.tag = data.tag;
  if ('inviter' in data) member.inviter = data.inviter;
  if ('inviterTag' in data) member.inviterTag = data.inviterTag;
  if ('moderator' in data) member.moderator = data.moderator;
  if ('moderatorTag' in data) member.moderatorTag = data.moderatorTag;
  members.set(member.id, member);
  _memberdata.set(guildId, members);

  await mongoClient
    .db(guildId)
    .collection('members')
    .updateOne({ id: member.id }, { $set: member }, { upsert: true });
}
