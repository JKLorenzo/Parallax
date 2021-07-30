import { Snowflake } from 'discord.js';

export type CommandPermissionData = {
  allow?: Snowflake[];
  deny?: Snowflake[];
};

export type GuildCommandOptions = {
  guilds?: Snowflake[];
  permissions?: {
    users?: CommandPermissionData;
    roles?: CommandPermissionData;
  };
};
