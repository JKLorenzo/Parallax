import { Activity, Guild, Snowflake, User } from 'discord.js';

export type BotConfigKeys =
  | 'BotOwnerId'
  | 'BotInviteLink'
  | 'ControlServerId'
  | 'TelemetryWebhookURL'
  | 'GameScreeningChannelId'
  | 'GuildMaxRoles';

export type CommandOptions = {
  scope: 'global' | 'guild';
  guilds?(guild: Guild): Promise<boolean> | boolean;
};

export type GuildConfig = {
  free_game?: FreeGameConfig;
  game?: GameConfig;
  play?: PlayConfig;
  music?: MusicConfig;
  gateway?: GatewayConfig;
};

export type FreeGameConfig = {
  enabled?: boolean;
  channel?: Snowflake;
  steam_role?: Snowflake;
  epic_role?: Snowflake;
  gog_role?: Snowflake;
  ps_role?: Snowflake;
  xbox_role?: Snowflake;
};

export type GameConfig = {
  enabled?: boolean;
  mentionable?: boolean;
  invite_channel?: Snowflake;
  reference_role?: Snowflake;
};

export type PlayConfig = {
  enabled?: boolean;
  hoisted?: boolean;
  mentionable?: boolean;
  reference_role?: Snowflake;
};

export type MusicConfig = {
  enabled?: boolean;
  channel?: Snowflake;
};

export type GatewayConfig = {
  enabled?: boolean;
  channel?: Snowflake;
  role?: Snowflake;
};

export type GameData = {
  name: string;
  status: 'approved' | 'denied' | 'pending';
};

export type ImageData = {
  name?: string;
  iconUrl?: string;
  bannerUrl?: string;
};

export type ImageOptions = {
  ratio: number;
  minWidth: number;
  minHeight: number;
};

export type ActivityData = {
  activity: Activity;
  status: 'old' | 'new';
};

export type RedditPostData = {
  author: string;
  created: number;
  domain: string;
  link_flair_text: string | null;
  permalink: string;
  score: number;
  selftext: string;
  title: string;
  upvote_ratio: number;
  url: string;
};

export type RedditResponseData = {
  data: {
    children: {
      data: RedditPostData;
    }[];
  };
};

export type MemberData = {
  id: Snowflake;
  tag?: string;
  inviter?: Snowflake;
  inviterTag?: string;
  moderator?: Snowflake;
  moderatorTag?: string;
};

export type CachedInvite = {
  code: string;
  expiresTimestamp: number | null;
  inviter: User | null;
  maxUses: number | null;
  uses: number | null;
};
