import { join } from 'path';
import { pathToFileURL } from 'url';
import {
  ActionRowData,
  ApplicationCommand,
  Collection,
  CommandInteraction,
  MessageActionRowComponent,
  MessageActionRowComponentData,
  MessageComponentInteraction,
} from 'discord.js';
import type Bot from '../modules/Bot.js';
import type Command from '../structures/Command.js';
import type Component from '../structures/Component.js';
import Manager from '../structures/Manager.js';
import { getFiles } from '../utils/Helpers.js';

export default class InteractionManager extends Manager {
  private commands: Collection<string, Command>;
  private components: Collection<string, Component>;

  constructor(bot: Bot) {
    super(bot);

    this.commands = new Collection();
    this.components = new Collection();
  }

  async init() {
    const initTelemetry = this.bot.managers.telemetry.node(this, 'init', false);

    try {
      // Load components
      const componentsPath = join(process.cwd(), 'build/components');
      const loadComponents = getFiles(componentsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const componentPath = pathToFileURL(path).href;
          const { default: MsgComponent } = await import(componentPath);
          const component = new MsgComponent() as Component;
          this.components.set(component.name, component);
        });
      await Promise.all(loadComponents);
      initTelemetry.logMessage(`A total of ${loadComponents.length} components were loaded`);

      // Load commands
      const commandsPath = join(process.cwd(), 'build/commands');
      const loadCommands = getFiles(commandsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const commandPath = pathToFileURL(path).href;
          const { default: AppCommand } = await import(commandPath);
          const command = new AppCommand(this.bot) as Command;
          this.commands.set(command.data.name, command);
        });
      await Promise.all(loadCommands);
      initTelemetry.logMessage(`A total of ${loadCommands.length} commands were loaded`);

      // Initialize commands
      await this.bot.client.application?.commands.fetch();
      const initCommands = [...this.commands.values()].map(command => command.init(this));
      await Promise.all(initCommands);
      initTelemetry.logMessage(`A total of ${initCommands.length} commands were initialized`);

      // Delete commands
      const deleteCommands: Promise<ApplicationCommand>[] = [];

      this.bot.client.application?.commands.cache
        .filter(
          command =>
            !this.commands.some(thisCommand => {
              if (thisCommand.data.name !== command.name) return false;
              if (thisCommand.options.scope !== 'global') return false;
              return true;
            }),
        )
        .forEach(command => deleteCommands.push(command.delete()));

      this.bot.client.guilds.cache.map(guild =>
        guild.commands.cache
          .filter(
            command =>
              !this.commands.some(thisCommand => {
                if (thisCommand.data.name !== command.name) return false;
                if (thisCommand.options.scope !== 'guild') return false;
                return true;
              }),
          )
          .forEach(command => deleteCommands.push(command.delete())),
      );

      await Promise.all(deleteCommands);
      initTelemetry.logMessage(`A total of ${deleteCommands.length} commands were deleted`);
    } catch (error) {
      initTelemetry.logError(error);
    }

    this.bot.client.on('interactionCreate', interaction => {
      if (interaction.isCommand()) {
        this.processCommand(interaction);
      } else if (interaction.isMessageComponent()) {
        this.processComponent(interaction);
      }
    });

    this.bot.client.on('guildCreate', guild => {
      const guildCreateTelemetry = this.bot.managers.telemetry.node(
        this,
        'Initialize Command on Guild Create',
      );

      this.commands.forEach(command => {
        command.init(this, guild).catch(guildCreateTelemetry.logError);
      });
    });

    initTelemetry.logMessage('Initialized', true);
  }

  private async processCommand(interaction: CommandInteraction) {
    const thisCommand = this.commands.get(interaction.commandName);
    if (!thisCommand) return;

    try {
      await thisCommand.exec(interaction);
    } catch (error) {
      const processCommandTelemetry = this.bot.managers.telemetry.node(this, 'Process Command');
      processCommandTelemetry.logError(error);
    }
  }

  private async processComponent(interaction: MessageComponentInteraction) {
    const [name, customId] = interaction.customId.split('__');
    if (!name || !customId) return;

    const thisComponent = this.components.get(name);
    if (!thisComponent) return;

    try {
      await thisComponent.exec(interaction, customId);
    } catch (error) {
      const processComponentTelemetry = this.bot.managers.telemetry.node(this, 'Process Component');
      processComponentTelemetry.logError(error);
    }
  }

  componentData(name: string): ActionRowData<MessageActionRowComponentData>[] | undefined {
    return this.components.get(name)?.data.map(row => ({
      ...row,
      components: row.components.map(component => ({
        ...component,
        customId: `${name}__${(component as MessageActionRowComponent).customId}`,
      })),
    }));
  }
}
