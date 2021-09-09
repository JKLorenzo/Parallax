import { Activity, Guild, Snowflake } from 'discord.js';

export type BotConfigKeys =
  | 'BotOwnerId'
  | 'BotInviteLink'
  | 'ControlServerId'
  | 'TelemetryWebhookURL'
  | 'GameScreeningChannelId'
  | 'GuildMaxRoles';

export type CommandPermissionData = {
  allow?: Snowflake[];
  deny?: Snowflake[];
};

export type GuildCommandOptions = {
  guilds?(guild: Guild): Promise<boolean> | boolean;
  permissions?: {
    users?: CommandPermissionData;
    roles?: CommandPermissionData;
  };
};

export type GuildConfig = {
  free_game?: FreeGameConfig;
  game?: GameConfig;
  play?: PlayConfig;
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
