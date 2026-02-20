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
  private thresholds: number[];

  data?: BatteryData;

  constructor(manager: HostManager) {
    this.telemetry = new Telemetry(this, { parent: manager.telemetry });

    this.thresholdReached = false;
    this.thresholds = [];

    setInterval(() => this.getStatus(), 10_000);
  }

  private getStatus() {
    const raw = child_process.execSync('sudo pwrstat -status', {
      encoding: 'utf-8',
    });

    const current = new BatteryData(raw);
    const previous = this.data;
    this.data = current;

    if (!previous) return;

    if (current.isNormal()) this.onNormal(previous, current);
    else if (current.isPowerFail()) this.onPowerFailure(previous, current);
    else if (current.isLostComms()) this.onLostCommunication(previous, current);
    else if (current.status.state !== previous.status.state) {
      this.telemetry
        .start('UPS State: Unknown')
        .error(`Received unknown UPS state: ${current.status.state}`)
        .end();
    }
  }

  onNormal(previous: BatteryData, current: BatteryDataNormal) {
    const { capacity, state } = current.status;

    if (!previous.isNormal()) {
      this.thresholds = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    }

    if (this.checkThreshold(capacity)) {
      this.telemetry.start(`UPS State: ${state}`).log(`Charging at ${capacity}`, true).end();
    }
  }

  onPowerFailure(previous: BatteryData, current: BatteryDataPowerFailure) {
    const { remainingRuntime, capacity, state } = current.status;
    const value = Number(remainingRuntime.split(' ')[0]);
    const unit = remainingRuntime.split(' ')[1];

    if (!previous.isPowerFail()) {
      this.thresholds = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5];
    }

    if (this.checkThreshold(capacity) || previous.status.state !== state) {
      this.telemetry
        .start(`UPS State: ${state}`)
        .log(`${remainingRuntime} remaining at ${capacity}`, true)
        .end();
    }

    const runtimeThreshold = value < 5 && Utils.hasAny(unit, 'min');
    const capacityThreshold = Number(capacity.split(' ')[0]) < 30;
    if (!this.thresholdReached && (runtimeThreshold || capacityThreshold)) {
      this.thresholdReached = true;
      this.telemetry
        .start(`UPS State: ${state}`)
        .log(
          `${runtimeThreshold ? 'Runtime' : 'Capacity'} threshold reached at ${runtimeThreshold ? remainingRuntime : capacity}`,
          true,
        )
        .end();

      HostManager.instance().proxmox.shutdown();
    }
  }

  onLostCommunication(previous: BatteryData, current: BatteryDataLostComms) {
    const { lastEvent, state } = current.status;

    if (!previous.isLostComms()) {
      this.telemetry.start(`UPS State: ${state}`).log(`Last event was ${lastEvent}`, true).end();
    }
  }

  private checkThreshold(capacity: string) {
    const currentCapacity = Number(capacity.split(' ')[0]);
    const nextThreshold = this.thresholds.filter(threshold => threshold >= currentCapacity).pop();
    if (!nextThreshold) return false;

    const thresholdIndex = this.thresholds.indexOf(nextThreshold);
    const thresholdReached = thresholdIndex !== -1;

    if (thresholdReached) this.thresholds.splice(0, thresholdIndex + 1);

    return thresholdReached;
  }
}
