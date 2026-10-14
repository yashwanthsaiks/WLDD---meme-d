/**
 * Async Keyed Mutex Lock.
 * Serializes concurrent requests per resource (e.g. campaignId) to prevent race conditions
 * where two simultaneous view updates attempt to allocate the remaining budget.
 */
export class KeyedMutex {
  private locks: Map<string, Promise<void>> = new Map();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const currentLock = this.locks.get(key) || Promise.resolve();
    let releaseLock: () => void = () => {};

    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(key, currentLock.then(() => nextLock));

    await currentLock;
    try {
      return await task();
    } finally {
      releaseLock();
      if (this.locks.get(key) === nextLock) {
        this.locks.delete(key);
      }
    }
  }
}

export const campaignMutex = new KeyedMutex();
