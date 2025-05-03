import { join } from 'path';
import { pathToFileURL } from 'url';
import {
  ApplicationCommandType,
  Collection,
  CommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from 'discord.js';
import type Modal from '../modules/modal.js';
import Manager from '../modules/manager.js';
import EnvironmentFacade from '../environment/environment_facade.js';
import Utils from '../modules/utils.js';
import { client } from '../main.js';
import type { Component } from '../modules/component.js';
import { CommandScope, type Command } from '../modules/command.js';

export default class InteractionManager extends Manager {
  private static _instance: InteractionManager;
  private commands: Collection<string, Command>;
  private components: Collection<string, Component>;
  private modals: Collection<string, Modal>;

  private constructor() {
    super();

    this.commands = new Collection();
    this.components = new Collection();
    this.modals = new Collection();

    InteractionManager._instance = this;
  }

  static instance() {
    if (!this._instance) {
      this._instance = new InteractionManager();
    }

    return this._instance;
  }

  static get CustomIdSeparator() {
    return '__';
  }

  async init() {
    const env = EnvironmentFacade.instance();
    const telemetry = this.telemetry.start(this.init, false);

    try {
      const interactionsPath = env.interactionsPath();

      // Load modals
      const modalsPath = join(interactionsPath, 'modals');
      const loadModals = Utils.getFiles(modalsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const modalPath = pathToFileURL(path).href;
          const { default: Interaction } = await import(modalPath);
          const modal = new Interaction() as Modal;
          this.modals.set(modal.data.customId, modal);
        });
      await Promise.all(loadModals);
      telemetry.log(`A total of ${loadModals.length} modals were loaded.`);

      // Load components
      const componentsPath = join(interactionsPath, 'components');
      const loadComponents = Utils.getFiles(componentsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const componentPath = pathToFileURL(path).href;
          const { default: Interaction } = await import(componentPath);
          const component = new Interaction() as Component;
          this.components.set(component.name, component);
        });
      await Promise.all(loadComponents);
      telemetry.log(`A total of ${loadComponents.length} components were loaded.`);

      // Load commands
      const commandsPath = join(interactionsPath, 'commands');
      const loadCommands = Utils.getFiles(commandsPath)
        .filter(path => path.endsWith('.js'))
        .map(async path => {
          const commandPath = pathToFileURL(path).href;
          const { default: Interaction } = await import(commandPath);
          const command = new Interaction() as Command;
          this.commands.set(command.data.name, command);
        });
      await Promise.all(loadCommands);
      telemetry.log(`A total of ${loadCommands.length} commands were loaded.`);

      // Initialize commands
      await client.application?.commands.fetch();
      const initCommands = this.commands.map(command => command.init());
      await Promise.all(initCommands);
      telemetry.log(`A total of ${initCommands.length} commands were initialized.`);

      // Delete commands
      const deleteCommands: Promise<unknown>[] = [];

      client.application?.commands.cache
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
              telemetry.log(`Global ${type} command ${command.name} deleted.`, true);
            }),
          ),
        );

      client.guilds.cache.map(guild =>
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
                telemetry.log(
                  `Guild ${type} command ${command.name} deleted on ${guild.name}.`,
                  true,
                );
              }),
            ),
          ),
      );

      const deletedCommands = await Promise.all(deleteCommands);
      if (deletedCommands.length > 0) {
        telemetry.log(`A total of ${deleteCommands.length} commands were deleted.`, true);
      }
    } catch (error) {
      telemetry.error(error);
    }

    client.on('interactionCreate', interaction => {
      if (interaction.isCommand()) {
        this.processCommand(interaction);
      } else if (interaction.isMessageComponent()) {
        this.processComponent(interaction);
      } else if (interaction.isModalSubmit()) {
        this.processModal(interaction);
      }
    });

    client.on('guildCreate', guild => {
      this.commands.forEach(command => command.init(guild));
    });

    telemetry.end();
  }

  private async processModal(interaction: ModalSubmitInteraction) {
    const telemetry = this.telemetry.start(this.processModal);

    const thisModal = this.modals.get(interaction.customId);
    if (!thisModal) return;

    try {
      await thisModal.exec(interaction);
    } catch (error) {
      telemetry.error(error);
    }

    telemetry.end();
  }

  private async processCommand(interaction: CommandInteraction) {
    const telemetry = this.telemetry.start(this.processCommand);

    const thisCommand = this.commands.get(interaction.commandName);
    if (!thisCommand) return;

    try {
      await thisCommand.exec(interaction);
    } catch (error) {
      telemetry.error(error);
    }

    telemetry.end();
  }

  private async processComponent(interaction: MessageComponentInteraction) {
    const telemetry = this.telemetry.start(this.processComponent);

    const [name, customId] = interaction.customId.split(InteractionManager.CustomIdSeparator);
    if (!name || !customId) return;

    const thisComponent = this.components.get(name);
    if (!thisComponent) return;

    try {
      await thisComponent.exec(interaction, customId);
    } catch (error) {
      telemetry.error(error);
    }

    telemetry.end();
  }
}
