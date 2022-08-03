/* eslint-disable @typescript-eslint/ban-types */

import { Snowflake } from 'discord.js';
import { sleep } from './functions.js';

const _queuers = new Map<string, Queuer>();

type queue_item = {
  exec: () => unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

export function queuerOf(guildId: Snowflake): Queuer {
  if (!_queuers.has(guildId)) _queuers.set(guildId, new Queuer());
  return _queuers.get(guildId)!;
}

export class Queuer {
  private timeout: number;
  private running = false;
  private queued = [] as queue_item[];

  constructor(timeout = 0) {
    this.timeout = timeout;
  }

  private async run(): Promise<void> {
    this.running = true;

    while (this.queued.length > 0) {
      const this_queue = this.queued.shift();
      if (!this_queue) continue;

      try {
        const promise = await Promise.race([this_queue.exec()]);
        this_queue.resolve(promise);
      } catch (error) {
        this_queue.reject(error);
      } finally {
        if (this.timeout > 0) await sleep(this.timeout);
      }
    }

    this.running = false;
  }

  queue<T>(exec: () => T | PromiseLike<T>): Promise<T> {
    const this_queue = { exec } as queue_item;
    const promise = new Promise<T>((resolve, reject) => {
      this_queue.resolve = value => resolve(value as T);
      this_queue.reject = reject;
    });

    this.queued.push(this_queue);

    if (!this.running) this.run();

    return promise;
  }
}
