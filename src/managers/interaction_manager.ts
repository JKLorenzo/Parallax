import { join } from 'path';
import { pathToFileURL } from 'url';
import {
  ActionRowData,
  ApplicationCommandType,
  Collection,
  CommandInteraction,
  MessageActionRowComponent,
  MessageActionRowComponentData,
  MessageComponentInteraction,
  ModalComponentData,
  ModalSubmitInteraction,
} from 'discord.js';
import type Bot from '../modules/bot.js';
import { CommandScope } from '../schemas/enums.js';
import type Command from '../structures/command_base.js';
import type Component from '../structures/component.js';
import Manager from '../structures/manager.js';
import type Modal from '../structures/modal.js';

const interactionsRelPath = 'build/interactions';

export default class InteractionManager extends Manager {
  private commands: Collection<string, Command>;
  private components: Collection<string, Component>;
  private modals: Collection<string, Modal>;

  constructor(bot: Bot) {
    super(bot);

    this.commands = new Collection();
    this.components = new Collection();
    this.modals = new Collection();
  }

  async init() {
    const initTelemetry = this.bot.managers.telemetry.node(this, 'Initialize');

    try {
      // Load modals
      const modalsPath = join(process.cwd(), `${interactionsRelPath}/modals`);
      const loadModals = this.bot.utils
        .getFiles(modalsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const modalPath = pathToFileURL(path).href;
          const { default: Interaction } = await import(modalPath);
          const modal = new Interaction(this.bot) as Modal;
          this.modals.set(modal.data.customId, modal);
        });
      await Promise.all(loadModals);
      initTelemetry.logMessage(`A total of ${loadModals.length} modals were loaded`, false);

      // Load components
      const componentsPath = join(process.cwd(), `${interactionsRelPath}/components`);
      const loadComponents = this.bot.utils
        .getFiles(componentsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const componentPath = pathToFileURL(path).href;
          const { default: Interaction } = await import(componentPath);
          const component = new Interaction(this.bot) as Component;
          this.components.set(component.name, component);
        });
      await Promise.all(loadComponents);
      initTelemetry.logMessage(`A total of ${loadComponents.length} components were loaded`, false);

      // Load commands
      const commandsPath = join(process.cwd(), `${interactionsRelPath}/commands`);
      const loadCommands = this.bot.utils
        .getFiles(commandsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const commandPath = pathToFileURL(path).href;
          const { default: Interaction } = await import(commandPath);
          const command = new Interaction(this.bot) as Command;
          this.commands.set(command.data.name, command);
        });
      await Promise.all(loadCommands);
      initTelemetry.logMessage(`A total of ${loadCommands.length} commands were loaded`, false);

      // Initialize commands
      await this.bot.client.application?.commands.fetch();
      const initCommands = this.commands.map(command => command.init());
      await Promise.all(initCommands);
      initTelemetry.logMessage(
        `A total of ${initCommands.length} commands were initialized`,
        false,
      );

      // Delete commands
      const deleteCommands: Promise<unknown>[] = [];

      this.bot.client.application?.commands.cache
        .filter(
          command =>
            !this.commands.some(thisCommand => {
              if (thisCommand.data.name !== command.name) return false;
              if (thisCommand.options.scope !== CommandScope.Global) return false;
              return true;
            }),
        )
        .forEach(command =>
          deleteCommands.push(
            command.delete().then(() => {
              const type = ApplicationCommandType[command.type].toLowerCase();
              initTelemetry.logMessage(`global ${type} command ${command.name} deleted`);
            }),
          ),
        );

      this.bot.client.guilds.cache.map(guild =>
        guild.commands.cache
          .filter(
            command =>
              !this.commands.some(thisCommand => {
                if (thisCommand.data.name !== command.name) return false;
                if (thisCommand.options.scope !== CommandScope.Guild) return false;
                return true;
              }),
          )
          .forEach(command =>
            deleteCommands.push(
              command.delete().then(() => {
                const type = ApplicationCommandType[command.type].toLowerCase();
                initTelemetry.logMessage(
                  `guild ${type} command ${command.name} deleted on ${guild.name}`,
                );
              }),
            ),
          ),
      );

      await Promise.all(deleteCommands);
      initTelemetry.logMessage(`A total of ${deleteCommands.length} commands were deleted`, false);
    } catch (error) {
      initTelemetry.logError(error);
    }

    this.bot.client.on('interactionCreate', interaction => {
      if (interaction.isCommand()) {
        this.processCommand(interaction);
      } else if (interaction.isMessageComponent()) {
        this.processComponent(interaction);
      } else if (interaction.isModalSubmit()) {
        this.processModal(interaction);
      }
    });

    this.bot.client.on('guildCreate', guild => {
      this.commands.forEach(command => command.init(guild));
    });
  }

  private async processModal(interaction: ModalSubmitInteraction) {
    const { telemetry } = this.bot.managers;
    const processModalTelemetry = telemetry.node(this, 'Modal Interaction');

    const thisModal = this.modals.get(interaction.customId);
    if (!thisModal) return;

    try {
      await thisModal.exec(interaction);
    } catch (error) {
      processModalTelemetry.logError(error);
    }
  }

  private async processCommand(interaction: CommandInteraction) {
    const { telemetry } = this.bot.managers;
    const processCommandTelemetry = telemetry.node(this, 'Command Interaction');

    const thisCommand = this.commands.get(interaction.commandName);
    if (!thisCommand) return;

    try {
      await thisCommand.exec(interaction);
    } catch (error) {
      processCommandTelemetry.logError(error);
    }
  }

  private async processComponent(interaction: MessageComponentInteraction) {
    const { telemetry } = this.bot.managers;
    const processComponentTelemetry = telemetry.node(this, 'Component Interaction');

    const [name, customId] = interaction.customId.split('__');
    if (!name || !customId) return;

    const thisComponent = this.components.get(name);
    if (!thisComponent) return;

    try {
      await thisComponent.exec(interaction, customId);
    } catch (error) {
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

  modalData(customId: string): ModalComponentData | undefined {
    return this.modals.get(customId)?.data;
  }
}
