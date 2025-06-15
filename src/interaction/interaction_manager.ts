import { client } from '../main.js';
import Manager from '../modules/manager.js';
import InteractionCommandOperator from './operators/interaction_command_operator.js';
import InteractionComponentOperator from './operators/interaction_component_operator.js';
import InteractionModalOperator from './operators/interaction_modal_operator.js';

export default class InteractionManager extends Manager {
  private static _instance: InteractionManager;

  private commandOperator: InteractionCommandOperator;
  private componentOperator: InteractionComponentOperator;
  private modalOperator: InteractionModalOperator;

  private constructor() {
    super();

    this.commandOperator = new InteractionCommandOperator(this);
    this.componentOperator = new InteractionComponentOperator(this);
    this.modalOperator = new InteractionModalOperator(this);
  }

  static instance() {
    if (!this._instance) {
      this._instance = new InteractionManager();
    }

    return this._instance;
  }

  async init() {
    const telemetry = this.telemetry.start(this.init, false);

    try {
      await this.commandOperator.init();
      await this.componentOperator.init();
      await this.modalOperator.init();
    } catch (error) {
      telemetry.error(error);
    }

    client.on('interactionCreate', interaction => {
      if (interaction.isCommand() || interaction.isAutocomplete()) {
        this.commandOperator.process(interaction);
      } else if (interaction.isMessageComponent()) {
        this.componentOperator.process(interaction);
      } else if (interaction.isModalSubmit()) {
        this.modalOperator.process(interaction);
      }
    });

    telemetry.end();
  }
}
