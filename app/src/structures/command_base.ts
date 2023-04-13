import {
  type ApplicationCommandData,
  ApplicationCommandType,
  type Awaitable,
  CommandInteraction,
  Guild,
} from 'discord.js';
import type Bot from '../modules/bot.js';
import { CommandScope } from '../schemas/enums.js';
import type { CommandOptions } from '../schemas/types.js';

export default abstract class BaseCommand<
  T extends ApplicationCommandData = ApplicationCommandData,
> {
  bot: Bot;
  data: T;
  options: CommandOptions;

  constructor(bot: Bot, data: T, options: CommandOptions) {
    this.bot = bot;
    this.data = data;
    this.options = options;
  }

  async init(guild?: Guild) {
    const { client, managers } = this.bot;
    const initTelemetry = managers.telemetry.node(this, 'Initialize');

    const type = ApplicationCommandType[this.data.type!].toLowerCase();

    if (this.options.scope === CommandScope.Global) {
      const command = client.application?.commands.cache.find(
        c => c.name === this.data.name && c.type === this.data.type,
      );

      let status: string | undefined;

      // Create
      if (!command) {
        await client.application?.commands.create(this.data);
        status = 'created';
      } else if (!command.equals(this.data)) {
        await command.edit(this.data);
        status = 'updated';
      }

      if (status) {
        initTelemetry.logMessage(`global ${type} command ${this.data.name} ${status}`);
      }
    } else if (this.options.scope === CommandScope.Guild) {
      const guilds = guild ? [guild] : [...client.guilds.cache.values()];
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
          initTelemetry.logMessage(
            `guild ${type} command ${this.data.name} ${status} on ${thisGuild.name}`,
          );
        }
      }
    }
  }

  abstract exec(interaction: CommandInteraction): Awaitable<unknown>;
}
