import child_process from 'node:child_process';
import Telemetry from '../../telemetry/telemetry.js';
import HostManager from '../host_manager.js';
import { BatteryKeys, type BatteryData } from '../host_defs.js';

export default class UPSOperator {
  private telemetry: Telemetry;
  private interval?: NodeJS.Timeout;

  constructor(manager: HostManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });
  }

  getData() {
    const telemetry = this.telemetry.start(this.getData);

    const raw = child_process.execSync('sudo pwrstat -status', {
      encoding: 'utf-8',
    });

    const data = raw
      .split('\n')
      .map(s => [s.split('.. ')[0].replaceAll('.', '').trim(), s.split('.. ')[1]?.trim()]);

    const getVal = (key: keyof typeof BatteryKeys) =>
      data.find(d => d[0] === BatteryKeys[key])?.at(1);

    const battData: BatteryData = {
      properties: {
        model: getVal('model'),
        firmware: getVal('firmware'),
        powerRated: getVal('powerRated'),
        voltageRated: getVal('voltageRated'),
      },
      status: {
        capacity: getVal('capacity'),
        lastEvent: getVal('lastEvent'),
        lineInteraction: getVal('lineInteraction'),
        powerLoad: getVal('powerLoad'),
        remainingRuntime: getVal('remainingRuntime'),
        state: getVal('state'),
        source: getVal('source'),
        voltageOutput: getVal('voltageOutput'),
        voltageUtility: getVal('voltageUtility'),
      },
    };

    // Stop interval if already on line
    if (this.interval && battData.status?.source === 'Normal') {
      this.onNormal();
    }

    telemetry.end();

    return battData;
  }

  onNormal() {
    const telemetry = this.telemetry.start(this.onNormal);

    const data = this.getData();
    telemetry.log(`Charging at ${data.status?.capacity}`, true);

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }

    telemetry.end();
  }

  onPowerFailure() {
    const telemetry = this.telemetry.start(this.onPowerFailure);

    const data = this.getData();
    telemetry.log(`${data.status?.remainingRuntime} remaining at ${data.status?.capacity}`);

    if (!this.interval) this.interval = setInterval(() => this.getData(), 5000);

    telemetry.end();
  }

  onLowBattery() {
    const telemetry = this.telemetry.start(this.onLowBattery);

    const data = this.getData();
    telemetry.log(`${data.status?.remainingRuntime} remaining at ${data.status?.capacity}`);

    HostManager.instance().proxmox.shutdown();

    telemetry.end();
  }
}
