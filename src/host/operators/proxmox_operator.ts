import { proxmoxApi, type Proxmox } from 'proxmox-api';
import Telemetry from '../../telemetry/telemetry.js';
import type HostManager from '../host_manager.js';
import EnvironmentFacade from '../../environment/environment_facade.js';

export default class ProxmoxOperator {
  private telemetry: Telemetry;
  private api: Proxmox.Api;

  constructor(manager: HostManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });

    this.api = proxmoxApi({
      host: EnvironmentFacade.instance().get('proxmoxHost'),
      tokenID: EnvironmentFacade.instance().get('proxmoxToken'),
      tokenSecret: EnvironmentFacade.instance().get('proxmoxSecret'),
    });
  }

  async status() {
    const telemetry = this.telemetry.start(this.status);

    const node = EnvironmentFacade.instance().get('proxmoxNode');
    const vmid = EnvironmentFacade.instance().get('proxmoxVMID');

    const status = await this.api.nodes.$(node).qemu.$(parseInt(vmid)).status.current.$get();

    const maxmem = Number(status.maxmem);
    const freemem = Number(status.freemem);

    const data = {
      cpu: `${Math.ceil(status.cpu)} %`,
      memory: `${Math.ceil(((maxmem - freemem) / maxmem) * 100)} %`,
    };

    telemetry.end();

    return data;
  }

  async shutdown() {
    const telemetry = this.telemetry.start(this.shutdown);

    const node = EnvironmentFacade.instance().get('proxmoxNode');

    await this.api.nodes.$(node).status.$post({
      command: 'shutdown',
    });

    telemetry.log('Shutting down...', true);

    telemetry.end();
  }
}
