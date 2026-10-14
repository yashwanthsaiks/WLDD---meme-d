import Redis from 'ioredis';

let redisClient: Redis | null = null;
let isRedisAvailable = false;
let cacheHits = 0;
let cacheMisses = 0;

// Local in-memory fallback cache if Redis daemon is not running
const localMemoryCache = new Map<string, { value: any; expiresAt: number }>();

export function initRedis(): { connected: boolean; message: string } {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;

  try {
    if (redisUrl) {
      console.log(`[Redis] Connecting to Redis at ${redisUrl}...`);
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Do not spam reconnects in sandbox if server isn't running
        enableOfflineQueue: false,
        connectTimeout: 2000,
      });
    } else {
      // Proactively test default localhost:6379 if available
      redisClient = new Redis({
        host: '127.0.0.1',
        port: 6379,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
        connectTimeout: 1000,
        lazyConnect: true,
      });
    }

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      console.log('[Redis] Connected successfully to Redis.');
    });

    redisClient.on('error', (err) => {
      if (isRedisAvailable) {
        console.warn('[Redis] Connection lost:', err.message);
      }
      isRedisAvailable = false;
    });

    // Attempt non-blocking connection
    redisClient.connect().catch(() => {
      isRedisAvailable = false;
      console.log('[Redis] Redis daemon not detected locally. Operating in resilient cache mode.');
    });

    return {
      connected: isRedisAvailable,
      message: 'Redis client initialized.',
    };
  } catch (err: any) {
    isRedisAvailable = false;
    console.log('[Redis] Operating in fallback cache mode:', err.message);
    return {
      connected: false,
      message: `Operating in fallback cache mode: ${err.message}`,
    };
  }
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    // 1. Try Redis if connected
    if (isRedisAvailable && redisClient) {
      try {
        const raw = await redisClient.get(key);
        if (raw) {
          cacheHits++;
          return JSON.parse(raw) as T;
        }
      } catch (err) {
        // Fallback to local memory cache
      }
    }

    // 2. Check local memory cache
    const cached = localMemoryCache.get(key);
    if (cached) {
      if (Date.now() > cached.expiresAt) {
        localMemoryCache.delete(key);
      } else {
        cacheHits++;
        return cached.value as T;
      }
    }

    cacheMisses++;
    return null;
  },

  async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    const serialized = JSON.stringify(value);

    // 1. Try Redis
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.set(key, serialized, 'EX', ttlSeconds);
      } catch (err) {
        // Fallback
      }
    }

    // 2. Always write to local memory cache as well
    localMemoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  async del(key: string): Promise<void> {
    if (isRedisAvailable && redisClient) {
      try {
        await redisClient.del(key);
      } catch (err) {
        // Ignore
      }
    }
    localMemoryCache.delete(key);
  },

  getStats() {
    return {
      isRedisAvailable,
      provider: isRedisAvailable ? 'Redis (Live Server)' : 'In-Memory Cache (Redis-Compatible Fallback)',
      hits: cacheHits,
      misses: cacheMisses,
      keysCached: localMemoryCache.size,
    };
  },
};
