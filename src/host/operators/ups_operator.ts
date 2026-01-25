import child_process from 'node:child_process';
import Telemetry from '../../telemetry/telemetry.js';
import HostManager from '../host_manager.js';
import BatteryData, {
  type BatteryDataLostComms,
  type BatteryDataNormal,
  type BatteryDataPowerFailure,
} from '../modules/battery_data.js';
import Utils from '../../misc/utils.js';

export default class UPSOperator {
  private telemetry: Telemetry;

  private thresholdReached: boolean;
  private dischargeThresholds: number[];

  data!: BatteryData;

  constructor(manager: HostManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });

    this.thresholdReached = false;
    this.dischargeThresholds = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5];

    setInterval(() => this.getStatus(), 1000);
  }

  private getStatus() {
    const raw = child_process.execSync('sudo pwrstat -status', {
      encoding: 'utf-8',
    });

    const current = new BatteryData(raw);
    if (current.isNormal()) this.onNormal(current);
    if (current.isPowerFail()) this.onPowerFailure(current);
    if (current.isLostComms()) this.onLostCommunication(current);

    this.data = current;
  }

  onNormal(data: BatteryDataNormal) {
    const telemetry = this.telemetry.start('UPS State: Normal');
    const { state, capacity } = data.status;
    const previous = this.data;

    if (previous && previous.status.state !== state) {
      telemetry.log(`Charging at ${capacity}`, true);
      this.dischargeThresholds = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5];
    }

    telemetry.end();
  }

  onPowerFailure(data: BatteryDataPowerFailure) {
    const telemetry = this.telemetry.start('UPS State: On Battery');
    const previous = this.data;
    const { remainingRuntime, capacity } = data.status;

    const value = Number(remainingRuntime.split(' ')[0]);
    const unit = remainingRuntime.split(' ')[1];

    if (previous && this.checkThreshold(capacity)) {
      telemetry.log(`${remainingRuntime} remaining at ${capacity}`, true);
    }

    const runtimeThreshold = value < 5 && Utils.hasAny(unit, 'min');
    const capacityThreshold = Number(capacity.split(' ')[0]) < 30;
    if (!this.thresholdReached && (runtimeThreshold || capacityThreshold)) {
      this.thresholdReached = true;
      HostManager.instance().proxmox.shutdown();
    }

    telemetry.end();
  }

  onLostCommunication(data: BatteryDataLostComms) {
    const telemetry = this.telemetry.start('UPS State: Lost Communication');
    const previous = this.data;
    const { state, lastEvent } = data.status;

    if (previous && previous.status.state !== state) {
      telemetry.log(`Last event was ${lastEvent}`, true);
    }

    telemetry.end();
  }

  private checkThreshold(capacity: string) {
    const telemetry = this.telemetry.start(this.checkThreshold);

    const currentCapacity = Number(capacity.split(' ')[0]);
    const nextThreshold = this.dischargeThresholds
      .filter(threshold => threshold >= currentCapacity)
      .pop();
    if (!nextThreshold) return false;

    const thresholdIndex = this.dischargeThresholds.indexOf(nextThreshold);

    const thresholdReached = thresholdIndex > 0;
    if (thresholdReached) {
      this.dischargeThresholds.splice(0, thresholdIndex);
      telemetry.log(`Threshold reached. Thresholds: ${this.dischargeThresholds}`);
    }

    telemetry.end();

    return thresholdReached;
  }
}
