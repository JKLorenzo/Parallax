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

  async nodeStatus() {
    const telemetry = this.telemetry.start(this.nodeStatus);

    const node = EnvironmentFacade.instance().get('proxmoxNode');
    const status = await this.api.nodes.$(node).status.$get();
    const sensors = JSON.parse(status.sensorsOutput);

    const data = {
      cpu: {
        usage: status['cpu'] as number,
        freq: status['cpuinfo']['mhz'] as string,
        loadAvg: status['loadavg'] as string[],
        temp: sensors['k10temp-pci-00c3']['Tccd1']['temp3_input'] as number,
      },
      memory: {
        used: status['memory']['used'] as number,
        total: status['memory']['total'] as number,
        free: status['memory']['free'] as number,
        available: status['memory']['available'] as number,
      },
      gpu: {
        usage: sensors['nouveau-pci-0600']['GPU core']['in0_input'] as number,
        temp: sensors['nouveau-pci-0600']['temp1']['temp1_input'] as number,
      },
      ssd: {
        temp: sensors['nvme-pci-0100']['Composite']['temp1_input'] as number,
      },
      uptime: status['uptime'] as number,
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

    telemetry.log('Shutting system down...', true);

    telemetry.end();
  }

  async reboot() {
    const telemetry = this.telemetry.start(this.reboot);

    const node = EnvironmentFacade.instance().get('proxmoxNode');

    await this.api.nodes.$(node).status.$post({
      command: 'reboot',
    });

    telemetry.log('Rebooting system...', true);

    telemetry.end();
  }

  async shutdownVM() {
    const telemetry = this.telemetry.start(this.shutdownVM);

    const node = EnvironmentFacade.instance().get('proxmoxNode');
    const vmid = EnvironmentFacade.instance().get('proxmoxVMID');

    await this.api.nodes.$(node).qemu.$(Number(vmid)).status.shutdown.$post();

    telemetry.log('Shutting virtual machine down...', true);

    telemetry.end();
  }

  async rebootVM() {
    const telemetry = this.telemetry.start(this.rebootVM);

    const node = EnvironmentFacade.instance().get('proxmoxNode');
    const vmid = EnvironmentFacade.instance().get('proxmoxVMID');

    await this.api.nodes.$(node).qemu.$(Number(vmid)).status.reboot.$post();

    telemetry.log('Rebooting virtual machine...', true);

    telemetry.end();
  }
}
