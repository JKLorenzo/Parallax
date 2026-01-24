import Manager from '../modules/manager.js';
import APIOperator from './operators/api_operator.js';
import ProxmoxOperator from './operators/proxmox_operator.js';
import UPSOperator from './operators/ups_operator.js';

export default class HostManager extends Manager {
  private static _instance: HostManager;

  readonly api: APIOperator;
  readonly proxmox: ProxmoxOperator;
  readonly ups: UPSOperator;

  constructor() {
    super();

    this.api = new APIOperator(this);
    this.proxmox = new ProxmoxOperator(this);
    this.ups = new UPSOperator(this);
  }

  static instance() {
    if (!this._instance) {
      this._instance = new HostManager();
    }

    return this._instance;
  }

  async init() {
    await this.api.init();
  }
}
