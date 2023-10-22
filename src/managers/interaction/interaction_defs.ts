import type { Awaitable, Guild } from 'discord.js';

export enum CommandScope {
  Global,
  Guild,
}

export type CommandOptions = {
  scope: CommandScope;
  guilds?(guild: Guild): Awaitable<boolean>;
};
