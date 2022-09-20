import type {
  ChatInputCommandInteraction,
  CacheType,
  ChatInputApplicationCommandData,
  Awaitable,
} from 'discord.js';
import BaseCommand from './command_base.js';

export default abstract class SlashCommand extends BaseCommand<ChatInputApplicationCommandData> {
  abstract exec(interaction: ChatInputCommandInteraction<CacheType>): Awaitable<unknown>;
}
