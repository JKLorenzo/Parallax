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

  port() {
    return parseInt(process.env.PORT ?? '3000');
  }

  url() {
    if (!this.isProduction()) return `http://localhost:${this.port()}`;

    const url = process.env.URL;
    if (!url) throw new Error("Environment variable 'URL' not set.");

    return url;
  }

  routesPath() {
    return join(process.cwd(), this.isProduction() ? 'routes' : 'app/build/routes');
  }

  interactionsPath() {
    return join(process.cwd(), this.isProduction() ? 'interactions' : 'app/build/interactions');
  }
}
