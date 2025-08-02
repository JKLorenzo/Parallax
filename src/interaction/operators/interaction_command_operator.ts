import {
  ApplicationCommandType,
  AutocompleteInteraction,
  Collection,
  CommandInteraction,
} from 'discord.js';
import EnvironmentFacade from '../../environment/environment_facade.js';
import { CommandScope, SlashCommandAutoComplete, type Command } from '../modules/command.js';
import Utils from '../../misc/utils.js';
import type InteractionManager from '../interaction_manager.js';
import { client } from '../../main.js';
import Telemetry from '../../telemetry/telemetry.js';

export default class InteractionCommandOperator {
  private telemetry: Telemetry;
  private commands: Collection<string, Command>;

  constructor(manager: InteractionManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });
    this.commands = new Collection();
  }

  async init() {
    const telemetry = this.telemetry.start(this.init);
    const env = EnvironmentFacade.instance();

    const topLevelDirs = await Utils.getPaths(env.cwd);
    const commandPaths = topLevelDirs
      .map(dir => Utils.joinPaths(dir, 'commands'))
      .filter(dir => Utils.dirExists(dir));

    for (const commandPath of commandPaths) {
      await this.load(commandPath);
    }

    await this.initCommands();

    client.on('guildCreate', guild => {
      this.commands.forEach(command => command.init(guild));
    });

    telemetry.end();
  }

  async load(dir: string) {
    const telemetry = this.telemetry.start(this.load);

    const commandPathURLs = Utils.getFiles(dir)
      .filter(path => path.endsWith('.js'))
      .map(path => Utils.getPathURL(path).href);

    for (const commandPathURL of commandPathURLs) {
      const { default: Interaction } = await import(commandPathURL);
      const command = new Interaction() as Command;
      this.commands.set(command.data.name, command);
    }

    telemetry.end();
  }

  async initCommands() {
    const telemetry = this.telemetry.start(this.initCommands);

    const globalCommands = await client.application?.commands.fetch();

    // Initialize commands
    for (const [name, command] of this.commands) {
      await command.init();
      telemetry.log(`Command ${name} initialized.`);
    }
    telemetry.log(`A total of ${this.commands.size} commands were initialized.`);

    // Remove global commands
    for (const command of globalCommands?.values() ?? []) {
      const commandExists = this.commands.some(thisCommand => {
        if (thisCommand.data.name !== command.name) return false;
        if (thisCommand.options.scope !== CommandScope.Global) return false;
        return true;
      });
      if (commandExists) continue;
      await command.delete();

      const type = ApplicationCommandType[command.type].toLowerCase();
      telemetry.log(`Global ${type} command ${command.name} deleted.`, true);
    }

    // Remove guild commands
    for (const guild of client.guilds.cache.values()) {
      const guildCommands = await guild.commands.fetch();
      for (const command of guildCommands.values()) {
        const commandExists = this.commands.some(thisCommand => {
          if (thisCommand.data.name !== command.name) return false;
          if (thisCommand.options.scope !== CommandScope.Guild) return false;
          return true;
        });
        if (commandExists) continue;
        await command.delete();

        const type = ApplicationCommandType[command.type].toLowerCase();
        telemetry.log(`Guild ${type} command ${command.name} deleted.`, true);
      }
    }

    telemetry.end();
  }

  async process(interaction: CommandInteraction | AutocompleteInteraction) {
    const telemetry = this.telemetry.start(this.process);

    const thisCommand = this.commands.get(interaction.commandName);
    if (!thisCommand) return;

    try {
      if (interaction instanceof AutocompleteInteraction) {
        if (!(thisCommand instanceof SlashCommandAutoComplete)) {
          throw `${interaction.commandName} does not support autocomplete.`;
        }

        await thisCommand.autocomplete(interaction);
      } else {
        await thisCommand.exec(interaction);
      }
    } catch (error) {
      telemetry.error(error);
    }

    telemetry.end();
  }
}
