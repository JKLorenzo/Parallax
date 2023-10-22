import { join } from 'path';
import { AssetsPath, EnvKeys, InteractionPath } from './environment_defs.js';

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

  assetsPath(path: string) {
    return join(process.cwd(), this.isProduction() ? '' : 'build', AssetsPath, path);
  }

  interactionsPath() {
    return join(process.cwd(), this.isProduction() ? '' : 'build', InteractionPath);
  }
}
