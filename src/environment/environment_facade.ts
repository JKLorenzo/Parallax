import { join } from 'path';
import { BatteryKeys, EnvKeys, type BatteryData } from './environment_defs.js';
import child_process from 'node:child_process';

export default class EnvironmentFacade {
  private static _instance: EnvironmentFacade;
  private environments: Map<string, string>;

  private constructor() {
    this.environments = new Map();

    Object.values(EnvKeys).forEach(key => {
      const value = process.env[key];

      if (typeof value === 'undefined') {
        throw new ReferenceError(`Environment variable '${key}' not set.`);
      }

      this.environments.set(key, value);
    });
  }

  static instance() {
    if (!this._instance) {
      this._instance = new EnvironmentFacade();
    }

    return this._instance;
  }

  get(key: keyof typeof EnvKeys) {
    return this.environments.get(EnvKeys[key])!;
  }

  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  get cwd() {
    return join(process.cwd(), 'build');
  }

  assetsPath(name: string) {
    return join(process.cwd(), 'src', 'assets', name);
  }

  battery(): BatteryData {
    const raw = child_process.execSync('sudo pwrstat -status', {
      encoding: 'utf-8',
    });
    const data = raw
      .split('\n')
      .map(s => [s.split('.. ')[0].replaceAll('.', '').trim(), s.split('.. ')[1]?.trim()]);

    const getVal = (key: keyof typeof BatteryKeys) =>
      data.find(d => d[0] === BatteryKeys[key])?.at(1);

    return {
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
  }
}
