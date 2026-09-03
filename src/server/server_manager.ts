import type { Executable } from '../database/database_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import Manager from '../modules/manager.js';
import type ServerOperator from './modules/server_operator.js';
import Utils from '../misc/utils.js';
import EnvironmentFacade from '../environment/environment_facade.js';

export default class ServerManager extends Manager {
  private static _instance: ServerManager;
  private _executables: Executable[];
  private _operators: Map<string, ServerOperator>;

  constructor() {
    super();

    this._executables = [];
    this._operators = new Map<string, ServerOperator>();
  }

  static instance() {
    if (!this._instance) {
      this._instance = new ServerManager();
    }

    return this._instance;
  }

  get executables() {
    return this._executables;
  }

  async init() {
    const telemetry = this.telemetry.start(this.init);

    await this.updateExecutables();

    telemetry.end();
  }

  async updateExecutables() {
    const telemetry = this.telemetry.start(this.updateExecutables);
    const db = DatabaseFacade.instance();

    this._executables = await db.fetchExecutables();

    telemetry.end();

    return this.executables;
  }

  async operator<T extends ServerOperator = ServerOperator>(name: string): Promise<T | undefined> {
    const telemetry = this.telemetry.start(this.operator);
    const env = EnvironmentFacade.instance();

    try {
      if (!this._operators.has(name)) {
        const file = Utils.getFiles(Utils.joinPaths(env.cwd, 'server', 'operators')).find(e =>
          e.endsWith(`${name}_operator.js`),
        );

        if (!file) throw new Error(`Operator not found: ${name}`);

        const { default: Operator } = await import(Utils.getPathURL(file).href);
        const operator = new Operator(this) as ServerOperator;
        this._operators.set(name, operator);
      }
    } catch (error) {
      this.telemetry.error(error);
    } finally {
      telemetry.end();
    }

    return this._operators.get(name) as T | undefined;
  }
}
