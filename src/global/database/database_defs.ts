import type { Snowflake } from 'discord.js';

export type BotConfigKeys = 'BotOwnerId' | 'TelemetryWebhookURL' | 'GameScreeningChannelId';

export type MusicConfig = {
  enabled?: boolean;
  channel?: Snowflake;
  ignored_prefix?: string[];
};

export type GatewayConfig = {
  enabled?: boolean;
  channel?: Snowflake;
  role?: Snowflake;
};

export type GameConfig = {
  enabled?: boolean;
  channel?: Snowflake;
  role?: Snowflake;
};

export type GuildConfig = {
  music?: MusicConfig;
  gateway?: GatewayConfig;
  game?: GameConfig;
};

export type MemberData = {
  id: Snowflake;
  tag?: string;
  inviter?: Snowflake;
  inviterTag?: string;
  moderator?: Snowflake;
  moderatorTag?: string;
};

export enum GameStatus {
  Pending,
  Approved,
  Denied,
}

export type GameData = {
  id?: Snowflake;
  name?: string;
  status?: GameStatus;
  iconURLs?: string[];
  iconIndex?: number;
  bannerURLs?: string[];
  bannerIndex?: number;
  moderatorId?: Snowflake;
};

export type GuildGameData = {
  id?: Snowflake;
  status?: GameStatus;
  roleId?: Snowflake;
  moderatorId?: Snowflake;
  lastPlayed?: Date;
};
