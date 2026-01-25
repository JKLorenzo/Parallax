export interface BatteryDataProperties {
  properties: {
    model: string;
    firmware: string;
    voltageRated: string;
    powerRated: string;
  };
  status: {
    state: string;
    lastEvent: string;
  };
}

export interface BatteryDataNormal extends BatteryDataProperties {
  status: {
    state: 'Normal';
    source: string;
    voltageUtility: string;
    voltageOutput: string;
    capacity: string;
    remainingRuntime: string;
    powerLoad: string;
    lineInteraction: string;
    lastEvent: string;
  };
}

export interface BatteryDataPowerFailure extends BatteryDataProperties {
  status: {
    state: 'Power Failure';
    source: string;
    voltageUtility: string;
    voltageOutput: string;
    capacity: string;
    remainingRuntime: string;
    powerLoad: string;
    lineInteraction: string;
    lastEvent: string;
  };
}

export interface BatteryDataLostComms extends BatteryDataProperties {
  status: {
    state: 'Lost Communication';
    lastEvent: string;
  };
}

export default class BatteryData {
  properties: {
    model: string;
    firmware: string;
    voltageRated: string;
    powerRated: string;
  };
  status: {
    state: string;
    source?: string;
    voltageUtility?: string;
    voltageOutput?: string;
    capacity?: string;
    remainingRuntime?: string;
    powerLoad?: string;
    lineInteraction?: string;
    lastEvent: string;
  };

  constructor(raw: string) {
    const data = raw
      .split('\n')
      .map(s => [s.split('.. ')[0].replaceAll('.', '').trim(), s.split('.. ')[1]?.trim()]);

    const getVal = (key: string) => data.find(d => d[0] === key)?.at(1);

    this.properties = {
      model: getVal('Model Name')!,
      firmware: getVal('Firmware Number')!,
      powerRated: getVal('Rating Power')!,
      voltageRated: getVal('Rating Voltage')!,
    };

    this.status = {
      state: getVal('State')!,
      lastEvent: getVal('Last Power Event')!,
      capacity: getVal('Battery Capacity'),
      lineInteraction: getVal('Line Interaction'),
      powerLoad: getVal('Load'),
      remainingRuntime: getVal('Remaining Runtime'),
      source: getVal('Power Supply by'),
      voltageOutput: getVal('Output Voltage'),
      voltageUtility: getVal('Utility Voltage'),
    };
  }

  isNormal(): this is BatteryDataNormal {
    return this.status.state === 'Normal';
  }

  isPowerFail(): this is BatteryDataPowerFailure {
    return this.status.state === 'Power Failure';
  }

  isLostComms(): this is BatteryDataLostComms {
    return this.status.state === 'Lost Communication';
  }
}
