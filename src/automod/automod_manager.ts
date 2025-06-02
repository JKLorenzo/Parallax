import { client } from '../main.js';
import Manager from '../modules/manager.js';
import AutomodAntiSpamOperator from './operators/automod_antispam_operator.js';

export default class AutomodManager extends Manager {
  private static _instance: AutomodManager;
  private antiSpamOperator: AutomodAntiSpamOperator;

  constructor() {
    super();

    this.antiSpamOperator = new AutomodAntiSpamOperator();
  }

  static instance() {
    if (!this._instance) {
      this._instance = new AutomodManager();
    }

    return this._instance;
  }

  init() {
    client.on('messageCreate', message => {
      this.antiSpamOperator.register(message);
    });
  }
}
