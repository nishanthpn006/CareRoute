/**
 * In-memory sliding window rate limiter for login protection against brute-force attacks.
 */

export class LoginRateLimiter {
  /**
   * @param {object} options
   * @param {number} [options.windowMs=900000] - 15 minutes window
   * @param {number} [options.maxAttempts=5] - max failed attempts per window
   */
  constructor({ windowMs = 15 * 60 * 1000, maxAttempts = 5 } = {}) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.records = new Map();

    // Periodic cleanup every 5 minutes to avoid memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  getKey(req) {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const email = String(req.body?.email || '').trim().toLowerCase();
    return { ip, email, combined: `${ip}:${email}` };
  }

  isRateLimited(req) {
    const { ip, email, combined } = this.getKey(req);
    const now = Date.now();

    // Check IP, email, and combined IP:email counters
    for (const key of [combined, email, ip]) {
      if (!key) continue;
      const record = this.records.get(key);
      if (!record) continue;

      // Filter attempts within active window
      const validAttempts = record.timestamps.filter((ts) => now - ts < this.windowMs);
      if (validAttempts.length >= this.maxAttempts) {
        const oldestAttempt = validAttempts[0];
        const retryAfterSeconds = Math.ceil((oldestAttempt + this.windowMs - now) / 1000);
        return { limited: true, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
      }
    }

    return { limited: false, retryAfterSeconds: 0 };
  }

  recordFailure(req) {
    const { ip, email, combined } = this.getKey(req);
    const now = Date.now();

    for (const key of [combined, email, ip]) {
      if (!key) continue;
      const record = this.records.get(key) || { timestamps: [] };
      record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);
      record.timestamps.push(now);
      this.records.set(key, record);
    }
  }

  recordSuccess(req) {
    const { ip, email, combined } = this.getKey(req);
    this.records.delete(combined);
    this.records.delete(email);
  }

  reset() {
    this.records.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < this.windowMs);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Express middleware applying the rate limit check.
   */
  middleware() {
    return (req, res, next) => {
      const { limited, retryAfterSeconds } = this.isRateLimited(req);
      if (limited) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        return res.status(429).json({
          error: 'Too many login attempts. Please try again later.',
        });
      }
      next();
    };
  }
}

export const loginRateLimiter = new LoginRateLimiter();
