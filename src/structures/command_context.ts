import type {
  Awaitable,
  CacheType,
  ContextMenuCommandInteraction,
  MessageApplicationCommandData,
  UserApplicationCommandData,
} from 'discord.js';
import BaseCommand from './command_base.js';

export default abstract class ContextCommand extends BaseCommand<
  UserApplicationCommandData | MessageApplicationCommandData
> {
  abstract exec(interaction: ContextMenuCommandInteraction<CacheType>): Awaitable<unknown>;
}
