import { join } from 'path';
import type Bot from '../modules/bot.js';
import Manager from '../structures/manager.js';

const EnvKeys = {
  botToken: 'BOT_TOKEN',
  dbUri: 'DB_URI',
  soundcloudId: 'SOUNDCLOUD_ID',
  spotifyId: 'SPOTIFY_ID',
  spotifySecret: 'SPOTIFY_SECRET',
  spotifyRefresh: 'SPOTIFY_REFRESH',
  userAgent: 'USER_AGENT',
};

export default class EnvironmentManager extends Manager {
  private environments: Map<string, string>;

  constructor(bot: Bot) {
    super(bot);

    this.environments = new Map();

    Object.values(EnvKeys).forEach(key => {
      const value = process.env[key];

      if (typeof value === 'undefined') {
        throw new ReferenceError(`Environment variable '${key}' not set.`);
      }

      this.environments.set(key, value);
    });
  }

  get(key: keyof typeof EnvKeys) {
    return this.environments.get(EnvKeys[key])!;
  }

  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  assetPath(path: string) {
    return join(process.cwd(), this.isProduction() ? 'assets' : 'build/assets', path);
  }

  routesPath() {
    return join(process.cwd(), this.isProduction() ? 'routes' : 'build/routes');
  }

  interactionsPath() {
    return join(process.cwd(), this.isProduction() ? 'interactions' : 'build/interactions');
  }
}
