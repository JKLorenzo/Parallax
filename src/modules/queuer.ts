import type { Awaitable } from 'discord.js';
import Utils from './utils.js';

type QueueItem = {
  exec: () => unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export default class Queuer {
  private timeout: number;
  private running: boolean;
  private queued: QueueItem[];

  constructor(timeout = 0) {
    this.timeout = timeout;
    this.running = false;
    this.queued = [];
  }

  private async run(): Promise<void> {
    this.running = true;

    while (this.queued.length > 0) {
      const thisQueue = this.queued.shift()!;

      try {
        const promise = await Promise.race([thisQueue.exec()]);
        thisQueue.resolve(promise);
      } catch (error) {
        thisQueue.reject(error);
      } finally {
        if (this.timeout > 0) await Utils.sleep(this.timeout);
      }
    }

    this.running = false;
  }

  queue<T>(exec: () => Awaitable<T>): Promise<T> {
    const thisQueue = { exec } as QueueItem;
    const promise = new Promise<T>((resolve, reject) => {
      thisQueue.resolve = value => resolve(value as T);
      thisQueue.reject = reject;
    });

    this.queued.push(thisQueue);

    if (!this.running) this.run();

    return promise;
  }
}
