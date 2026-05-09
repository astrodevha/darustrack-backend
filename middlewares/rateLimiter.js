/**
 * middlewares/rateLimiter.js
 *
 * Rate limiting untuk melindungi endpoint API SAKTI dari brute force dan abuse.
 * Mendukung Redis sebagai penyimpanan distributed (production) dengan fallback ke MemoryStore.
 *
 * ============================================================
 * FITUR
 * ============================================================
 * - loginLimiter : batas ketat untuk endpoint autentikasi (login, register, forgot-password)
 * - apiLimiter   : batas umum untuk seluruh API (global)
 *
 * ============================================================
 * PENYIMPANAN (STORE)
 * ============================================================
 * - Jika environment REDIS_URL tersedia dan koneksi berhasil → gunakan RedisStore.
 * - Jika REDIS_URL tidak tersedia atau koneksi gagal → fallback ke MemoryStore (built-in).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Nilai windowMs dan max dapat diatur melalui environment variable:
 *   LOGIN_RATE_LIMIT_WINDOW_MS (default 900000 ms = 15 menit)
 *   LOGIN_RATE_LIMIT_MAX (default 10 percobaan)
 * - Jika Redis gagal di runtime, sistem akan fail-open (melewatkan request) daripada blokir semua.
 * - Pastikan Redis URL dalam format: redis://user:pass@host:port
 *
 * @module rateLimiter
 */

// ============================================================
// Dependencies
// ============================================================
const rateLimit = require('express-rate-limit');

// ============================================================
// Helper: Create Redis Store (dengan error handling)
// ============================================================

/**
 * Mencoba membuat Redis store untuk express-rate-limit.
 * Jika gagal (koneksi error, URL tidak valid, dll.), mengembalikan undefined
 * yang menyebabkan express-rate-limit fallback ke MemoryStore.
 *
 * @returns {import('express-rate-limit').Store|undefined}
 */
function createRedisStore() {
  // Tidak ada konfigurasi Redis → langsung gunakan MemoryStore
  if (!process.env.REDIS_URL) {
    return undefined;
  }

  try {
    const RedisStore = require('rate-limit-redis');
    const Redis = require('ioredis');

    /**
     * Konfigurasi Redis client dengan opsi khusus:
     * - lazyConnect: true → tidak connect sampai ada command pertama
     * - maxRetriesPerRequest: null → gunakan retryStrategy sendiri
     * - retryStrategy: coba maksimal 3 kali, lalu berhenti (tidak crash)
     */
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times >= 3) {
          console.warn(
            '[rateLimiter] Redis tidak bisa dihubungi setelah 3 percobaan. ' +
            'Fallback ke MemoryStore. Rate limiter tetap aktif.'
          );
          return null; // null = hentikan retry
        }
        // Backoff: 500ms, 1000ms, 2000ms
        return Math.min(times * 500, 2000);
      },
    });

    // Tangkap error event agar tidak menjadi unhandled error crash server
    client.on('error', (err) => {
      // Log hanya sekali untuk mencegah flood
      if (!client._darustrack_logged) {
        console.warn(`[rateLimiter] Redis error: ${err.message}. MemoryStore digunakan.`);
        client._darustrack_logged = true;
      }
    });

    client.on('connect', () => {
      client._darustrack_logged = false; // Reset flag jika koneksi pulih
      console.info('[rateLimiter] Redis terhubung. Rate limit store: Redis.');
    });

    return new RedisStore({
      sendCommand: async (...args) => {
        try {
          return await client.call(...args);
        } catch {
          // Jika Redis gagal saat runtime, biarkan request lewat (fail open)
          return null;
        }
      },
    });
  } catch (err) {
    console.warn(
      `[rateLimiter] Gagal inisialisasi Redis store: ${err.message}. ` +
      'Fallback ke MemoryStore.'
    );
    return undefined;
  }
}

// ============================================================
// Inisialisasi Store
// ============================================================
const store = createRedisStore();

// ============================================================
// Exported Limiters
// ============================================================

/**
 * loginLimiter - Rate limiter ketat untuk endpoint autentikasi.
 * Melindungi dari brute force attack pada:
 *   - POST /auth/login
 *   - POST /auth/register
 *   - POST /auth/forgot-password
 *   - POST /auth/refresh
 *
 * Default: 10 percobaan per IP per 15 menit.
 * Dapat dikonfigurasi via environment:
 *   LOGIN_RATE_LIMIT_WINDOW_MS (default: 900000)
 *   LOGIN_RATE_LIMIT_MAX (default: 10)
 *
 * @constant
 */
const loginLimiter = rateLimit({
  windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 menit
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '10', 10),
  standardHeaders: true,   // Kirim header `RateLimit-*` standar (RFC 6585)
  legacyHeaders: false,    // Matikan header `X-RateLimit-*` lama
  store: store || undefined, // Jika undefined, fallback ke MemoryStore bawaan

  // Pesan error yang dikembalikan ke client saat rate limit terlampaui
  message: {
    message: 'Terlalu banyak percobaan login dari IP ini. Silakan coba lagi dalam beberapa menit.',
  },

  // Handler dipanggil ketika rate limit tercapai
  handler: (req, res, _next, options) => {
    console.warn(
      `[rateLimiter] Login rate limit — IP: ${req.ip} — ${new Date().toISOString()}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * apiLimiter - Rate limiter umum untuk seluruh endpoint API.
 * Melindungi dari DDoS dan scraping berlebihan.
 *
 * Default: 300 request per IP per menit.
 *
 * @constant
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 menit
  max: 300,                     // 300 request per menit
  standardHeaders: true,
  legacyHeaders: false,
  store: store || undefined,
  message: {
    message: 'Terlalu banyak request dari IP ini. Silakan coba lagi dalam 1 menit.',
  },
});

// ============================================================
// Ekspor
// ============================================================
module.exports = { loginLimiter, apiLimiter };