import { Activity, ColorResolvable, Guild, Snowflake } from 'discord.js';

export type BotConfigKeys =
  | 'BotOwnerId'
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
  dedicated?: DedicatedConfig;
  free_game?: FreeGameConfig;
  game?: GameConfig;
  nsfw?: NSFWConfig;
  play?: PlayConfig;
  streaming?: StreamingConfig;
};

export type DedicatedConfig = {
  hoisted?: boolean;
  text_category?: Snowflake;
  voice_category?: Snowflake;
  reference_role?: Snowflake;
};

export type FreeGameConfig = {
  free_games_channel?: Snowflake;
  epic_role?: Snowflake;
  gog_role?: Snowflake;
  ps_role?: Snowflake;
  steam_role?: Snowflake;
  uplay_role?: Snowflake;
  wii_role?: Snowflake;
  xbox_role?: Snowflake;
};

export type GameConfig = {
  enabled?: boolean;
  mentionable?: boolean;
  color?: ColorResolvable;
  invite_channel?: Snowflake;
  reference_role?: Snowflake;
};

export type NSFWConfig = {
  nsfw_channels?: Snowflake[];
  nsfw_role?: Snowflake;
};

export type PlayConfig = {
  enabled?: boolean;
  mentionable?: boolean;
  reference_role?: Snowflake;
};

export type StreamingConfig = {
  enabled?: boolean;
  streaming_role?: Snowflake;
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
