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
  AutocompleteInteraction,
  MessageFlags,
} from 'discord.js';
import Telemetry from '../../telemetry/telemetry.js';
import { client } from '../../main.js';
import DatabaseFacade from '../../database/database_facade.js';

export enum CommandScope {
  Global,
  Guild,
}

export type CommandOptions = {
  scope: CommandScope;
  guilds?(guild: Guild): Awaitable<boolean>;
};

export abstract class Command<T extends ApplicationCommandData = ApplicationCommandData> {
  data: T;
  options: CommandOptions;
  telemetry: Telemetry;
  ownerId?: string;

  constructor(data: T, options: CommandOptions) {
    this.data = data;
    this.options = options;
    this.telemetry = new Telemetry(this);
  }

  async init(guild?: Guild) {
    const telemetry = this.telemetry.start(this.init, true);

    const db = DatabaseFacade.instance();
    this.ownerId = await db.botConfig('BotOwnerId');

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
        telemetry.log(`Global ${type} command ${this.data.name} ${status}.`);
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
          telemetry.log(`Guild ${type} command ${this.data.name} ${status} on ${thisGuild.name}.`);
        }
      }
    }

    telemetry.end();
  }

  notOwner(interaction: CommandInteraction) {
    if (interaction.user.id === this.ownerId) return false;

    interaction.reply({
      content: 'Sorry! You dont have the necessary permission to execute this command.',
      flags: MessageFlags.Ephemeral,
    });

    return true;
  }

  abstract exec(interaction: CommandInteraction): Awaitable<unknown>;
}

export abstract class SlashCommand extends Command<ChatInputApplicationCommandData> {
  abstract exec(interaction: ChatInputCommandInteraction<CacheType>): Awaitable<unknown>;
}

export abstract class SlashCommandAutoComplete extends SlashCommand {
  abstract autocomplete(interaction: AutocompleteInteraction<CacheType>): Awaitable<unknown>;
}

export abstract class ContextCommand extends Command<
  UserApplicationCommandData | MessageApplicationCommandData
> {
  abstract exec(interaction: ContextMenuCommandInteraction<CacheType>): Awaitable<unknown>;
}
