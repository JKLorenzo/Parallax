import type { Executable } from '../database/database_defs.js';
import DatabaseFacade from '../database/database_facade.js';
import Manager from '../modules/manager.js';
import PalworldServer from './servers/palworld_server.js';
import SatisfactoryServer from './servers/satisfactory_server.js';
import AbioticFactorServer from './servers/abiotic_server.js';
import RustServer from './servers/rust_server.js';
import ValheimServer from './servers/valheim_server.js';
import ZomboidServer from './servers/zomboid_server.js';

export default class ServerManager extends Manager {
  private static _instance: ServerManager;
  private _executables: Executable[];

  private _abiotic?: AbioticFactorServer;
  private _palworld?: PalworldServer;
  private _rust?: RustServer;
  private _satisfactory?: SatisfactoryServer;
  private _valheim?: ValheimServer;
  private _zomboid?: ZomboidServer;

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
    if (!this._abiotic) this._abiotic = new AbioticFactorServer(this);
    return this._abiotic;
  }

  get palworld() {
    if (!this._palworld) this._palworld = new PalworldServer(this);
    return this._palworld;
  }

  get rust() {
    if (!this._rust) this._rust = new RustServer(this);
    return this._rust;
  }

  get satisfactory() {
    if (!this._satisfactory) this._satisfactory = new SatisfactoryServer(this);
    return this._satisfactory;
  }

  get valheim() {
    if (!this._valheim) this._valheim = new ValheimServer(this);
    return this._valheim;
  }

  get zomboid() {
    if (!this._zomboid) this._zomboid = new ZomboidServer(this);
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
