export default class Limiter {
  private timeout: number;
  private data: Map<string, number>;

  constructor(timeout: number) {
    this.timeout = timeout;
    this.data = new Map();
  }

  limit(id: string): boolean {
    const now = Date.now();
    const isLimited = this.isLimited(id);
    if (!isLimited) {
      this.data.set(id, now);

      // GC non-limited
      setTimeout(() => {
        if (!this.isLimited(id)) this.data.delete(id);
      }, this.timeout + 10000);
    }
    return isLimited;
  }

  isLimited(id: string): boolean {
    const time = this.data.get(id);
    return time ? time >= Date.now() - this.timeout : false;
  }
}
