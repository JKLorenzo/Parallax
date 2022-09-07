import { ApplicationCommandData, ClientApplication, CommandInteraction, Guild } from 'discord.js';
import type Manager from './Manager.js';
import type Bot from '../modules/Bot.js';
import type { CommandOptions } from '../utils/Types.js';

export default abstract class Command {
  bot: Bot;
  data: ApplicationCommandData;
  options: CommandOptions;

  constructor(bot: Bot, data: ApplicationCommandData, options: CommandOptions) {
    this.bot = bot;
    this.data = data;
    this.options = options;
  }

  async init(manager: Manager, guild?: Guild) {
    const { client, managers } = manager.bot;
    const initTelemetry = managers.telemetry.node(this, 'init');

    let context;
    if (this.options.scope === 'global') {
      context = client.application;
    } else if (this.options.scope === 'guild') {
      if (typeof guild === 'undefined') {
        context = [...client.guilds.cache.values()];
      } else {
        context = [guild];
      }
    }
    if (!context) return;

    if (context instanceof ClientApplication) {
      const command = context.commands.cache.find(
        c => c.name === this.data.name && c.type === this.data.type,
      );

      let status: string | undefined;

      // Create
      if (!command) {
        await context.commands.create(this.data);
        status = 'created';
      } else if (!command.equals(this.data)) {
        await command.edit(this.data);
        status = 'updated';
      }

      if (status) {
        initTelemetry.logMessage(
          `${this.options.scope} ${`${this.data.type}`.toLowerCase()} command ${
            this.data.name
          } ${status}`,
        );
      }
    } else {
      await Promise.all(context.map(e => e.commands.fetch()));

      context.forEach(async e => {
        const isFiltered =
          typeof this.options.guilds !== 'undefined' &&
          !(await Promise.race([this.options.guilds(e)]));

        const command = e.commands.cache.find(
          c => c.name === this.data.name && c.type === this.data.type,
        );

        let status: string | undefined;

        if (!isFiltered) {
          if (!command) {
            await e.commands.create(this.data);
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
            `${this.options.scope} ${`${this.data.type}`.toLowerCase()} command ${
              this.data.name
            } ${status} on ${e}`,
          );
        }
      });
    }
  }

  // eslint-disable-next-line no-unused-vars
  abstract exec(interaction: CommandInteraction): Promise<unknown>;
}
