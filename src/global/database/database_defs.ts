import type { Snowflake } from 'discord.js';

export type BotConfigKeys =
  | 'BotOwnerId'
  | 'TelemetryWebhookURL'
  | 'SpotifyId'
  | 'SpotifySecret'
  | 'SpotifyRefresh'
  | 'YouTubeCookies'
  | 'UserAgent';

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

export type GuildConfig = {
  music?: MusicConfig;
  gateway?: GatewayConfig;
};

export type MemberData = {
  id: Snowflake;
  tag?: string;
  inviter?: Snowflake;
  inviterTag?: string;
  moderator?: Snowflake;
  moderatorTag?: string;
};
