import type { Executable } from '../database/database_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import Manager from '../modules/manager.js';
import PalworldOperator from './operators/palworld_operator.js';
import SatisfactoryOperator from './operators/satisfactory_operator.js';
import AbioticFactorOperator from './operators/abiotic_operator.js';
import RustOperator from './operators/rust_operator.js';
import ValheimOperator from './operators/valheim_operator.js';
import ZomboidOperator from './operators/zomboid_operator.js';

export default class ServerManager extends Manager {
  private static _instance: ServerManager;
  private _executables: Executable[];

  // Operators
  private _abiotic?: AbioticFactorOperator;
  private _palworld?: PalworldOperator;
  private _rust?: RustOperator;
  private _satisfactory?: SatisfactoryOperator;
  private _valheim?: ValheimOperator;
  private _zomboid?: ZomboidOperator;

  constructor() {
    super();

    this._executables = [];
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

  get abiotic() {
    if (!this._abiotic) this._abiotic = new AbioticFactorOperator(this);
    return this._abiotic;
  }

  get palworld() {
    if (!this._palworld) this._palworld = new PalworldOperator(this);
    return this._palworld;
  }

  get rust() {
    if (!this._rust) this._rust = new RustOperator(this);
    return this._rust;
  }

  get satisfactory() {
    if (!this._satisfactory) this._satisfactory = new SatisfactoryOperator(this);
    return this._satisfactory;
  }

  get valheim() {
    if (!this._valheim) this._valheim = new ValheimOperator(this);
    return this._valheim;
  }

  get zomboid() {
    if (!this._zomboid) this._zomboid = new ZomboidOperator(this);
    return this._zomboid;
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
}
