import {
  type ApplicationCommandData,
  ApplicationCommandType,
  type Awaitable,
  CommandInteraction,
  Guild,
  type ChatInputApplicationCommandData,
  ChatInputCommandInteraction,
  type CacheType,
  type UserApplicationCommandData,
  type MessageApplicationCommandData,
  ContextMenuCommandInteraction,
} from 'discord.js';
import { CommandScope, type CommandOptions } from './interaction_defs.js';
import Telemetry from '../../global/telemetry/telemetry.js';
import type Bot from '../../modules/bot.js';

export abstract class Command<T extends ApplicationCommandData = ApplicationCommandData> {
  bot: Bot;
  data: T;
  options: CommandOptions;
  telemetry: Telemetry;

  constructor(bot: Bot, data: T, options: CommandOptions) {
    this.bot = bot;
    this.data = data;
    this.options = options;
    this.telemetry = new Telemetry(this, { parent: bot.telemetry });
  }

  async init(guild?: Guild) {
    const telemetry = this.telemetry.start(this.init, true);

    const type = ApplicationCommandType[this.data.type!].toLowerCase();

    if (this.options.scope === CommandScope.Global) {
      const command = this.bot.client.application?.commands.cache.find(
        c => c.name === this.data.name && c.type === this.data.type,
      );

      let status: string | undefined;

      // Create
      if (!command) {
        await this.bot.client.application?.commands.create(this.data);
        status = 'created';
      } else if (!command.equals(this.data)) {
        await command.edit(this.data);
        status = 'updated';
      }

      if (status) {
        telemetry.log(`Global ${type} command ${this.data.name} ${status}`);
      }
    } else if (this.options.scope === CommandScope.Guild) {
      const guilds = guild ? [guild] : [...this.bot.client.guilds.cache.values()];
      await Promise.all(guilds.map(e => e.commands.fetch()));

      for (const thisGuild of guilds) {
        const isFiltered =
          typeof this.options.guilds !== 'undefined' &&
          !(await Promise.race([this.options.guilds(thisGuild)]));

        const command = thisGuild.commands.cache.find(
          c => c.name === this.data.name && c.type === this.data.type,
        );

        let status: string | undefined;

        if (!isFiltered) {
          if (!command) {
            await thisGuild.commands.create(this.data);
            status = 'created';
          } else if (!command.equals(this.data)) {
            await command.edit(this.data);
            status = 'updated';
          }
        } else if (command) {
          await command.delete();
          status = 'deleted';
        }

        if (status) {
          telemetry.log(`Guild ${type} command ${this.data.name} ${status} on ${thisGuild.name}`);
        }
      }
    }

    telemetry.end();
  }

  abstract exec(interaction: CommandInteraction): Awaitable<unknown>;
}

export abstract class SlashCommand extends Command<ChatInputApplicationCommandData> {
  abstract exec(interaction: ChatInputCommandInteraction<CacheType>): Awaitable<unknown>;
}

export abstract class ContextCommand extends Command<
  UserApplicationCommandData | MessageApplicationCommandData
> {
  abstract exec(interaction: ContextMenuCommandInteraction<CacheType>): Awaitable<unknown>;
}
