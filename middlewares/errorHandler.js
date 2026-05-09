/**
 * middlewares/errorHandler.js
 *
 * Centralized error-handling middleware untuk Express.
 * Ini adalah "jaring pengaman" terakhir untuk semua error yang tidak
 * tertangani di route handler maupun middleware lain.
 *
 * ============================================================
 * ALUR ERROR SAMPAI KE SINI
 * ============================================================
 * (a) Controller memanggil `next(err)` secara eksplisit
 * (b) asyncHandler wrapper menangkap rejected Promise lalu memanggil `next(err)`
 * (c) Middleware synchronous yang melempar error
 * (d) Error dari route yang tidak memiliki try/catch
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - JANGAN menambahkan pesan error detail di response production.
 * - Gunakan console.error untuk logging server, bukan untuk response.
 * - Error handler ini harus dipasang SETELAH semua route dan middleware lain.
 * - Jika menambah error baru, tambahkan mapping ke SEQUELIZE_ERROR_MAP.
 *
 * @module errorHandler
 */

// ============================================================
// Error Mapping (Sequelize → Pesan Aman)
// ============================================================

/**
 * Memetakan nama error Sequelize ke status HTTP dan pesan yang aman
 * untuk dikembalikan ke client. Mencegah kebocoran detail internal DB.
 *
 * @type {Record<string, {status: number, message: string}>}
 */
const SEQUELIZE_ERROR_MAP = {
  SequelizeValidationError: {
    status: 400,
    message: 'Data tidak valid. Periksa kembali input Anda.',
  },
  SequelizeUniqueConstraintError: {
    status: 409,
    message: 'Data sudah ada. Terdapat nilai yang duplikat.',
  },
  SequelizeForeignKeyConstraintError: {
    status: 400,
    message: 'Operasi gagal karena masih ada data yang berelasi.',
  },
  SequelizeConnectionError: {
    status: 503,
    message: 'Koneksi ke database gagal. Silakan coba lagi.',
  },
  SequelizeTimeoutError: {
    status: 503,
    message: 'Permintaan ke database timeout. Silakan coba lagi.',
  },
  SequelizeDatabaseError: {
    status: 500,
    message: 'Terjadi kesalahan pada database.',
  },
};

// ============================================================
// Helper Functions
// ============================================================

/**
 * Menentukan status HTTP yang sesuai berdasarkan objek error.
 * Prioritas: err.status → err.statusCode → mapping Sequelize → 500
 *
 * @param {Error} err - Objek error yang terjadi
 * @returns {number} Status HTTP (4xx, 5xx)
 */
function resolveStatusCode(err) {
  if (Number.isInteger(err.status)) return err.status;
  if (Number.isInteger(err.statusCode)) return err.statusCode;
  if (SEQUELIZE_ERROR_MAP[err.name]) return SEQUELIZE_ERROR_MAP[err.name].status;
  return 500;
}

/**
 * Menentukan pesan error yang aman untuk dikirim ke client.
 * Di PRODUCTION: gunakan pesan generik (tanpa detail teknis).
 * Di DEVELOPMENT: tampilkan detail untuk debugging.
 *
 * @param {Error} err - Objek error yang terjadi
 * @param {boolean} isProduction - Apakah environment production
 * @returns {string} Pesan error yang aman untuk client
 */
function resolveClientMessage(err, isProduction) {
  const seqMapping = SEQUELIZE_ERROR_MAP[err.name];

  if (seqMapping) {
    // Untuk error Sequelize, gunakan pesan dari mapping (aman)
    if (!isProduction && err.name === 'SequelizeValidationError' && err.errors?.length) {
      // Di development, tambahkan detail field yang invalid
      const details = err.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
      return `${seqMapping.message} Detail: ${details}`;
    }
    return seqMapping.message;
  }

  // Untuk error non-Sequelize, gunakan pesan dari error object
  // Diasumsikan pesan ini sudah aman (dibuat oleh developer, bukan dari DB)
  return err.message || 'Terjadi kesalahan pada server. Silakan coba lagi.';
}

// ============================================================
// Error Handler Middleware
// ============================================================

/**
 * Express error-handling middleware.
 *
 * WAJIB memiliki TEPAT 4 parameter agar Express mengenalinya sebagai error handler.
 * Parameter `next` tidak digunakan tapi HARUS ada — Express menggunakan function
 * arity (panjang parameter) untuk membedakan route handler biasa dari error handler.
 *
 * @param {Error} err - Objek error yang terjadi
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function (tidak digunakan)
 */
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const statusCode = resolveStatusCode(err);
  const clientMessage = resolveClientMessage(err, isProduction);

  // ============================================================
  // Logging Server-side (detail lengkap, tidak ke client)
  // ============================================================
  if (process.env.NODE_ENV !== 'test') {
    const logPrefix = `[ErrorHandler] ${req.method} ${req.originalUrl} → ${statusCode}`;
    if (statusCode >= 500) {
      // Error internal server (5xx) → log stack trace penuh
      console.error(`${logPrefix}:`, err.message);
      if (err.stack) console.error(err.stack);
    } else {
      // Error client (4xx) → log ringkas
      console.warn(`${logPrefix}:`, err.message);
    }
  }

  // ============================================================
  // Guard: Jangan kirim response jika sudah dikirim sebelumnya
  // ============================================================
  if (res.headersSent) return;

  // ============================================================
  // Response Keamanan (tidak bocorkan detail internal)
  // ============================================================
  /**
   * Response di PRODUCTION:
   *   { status: 'error', message: 'Pesan aman' }
   *
   * Response di DEVELOPMENT (tambahan untuk debugging):
   *   { status: 'error', message: '...', errorName: '...', stack: '...' }
   *
   * KEAMANAN KRITIS:
   *   - errorName dan stack TIDAK PERNAH dikembalikan di production.
   *   - Keduanya bisa mengekspos struktur internal aplikasi kepada attacker.
   */
  const responseBody = {
    status: 'error',
    message: clientMessage,
    ...(!isProduction && {
      errorName: err.name,
      stack: err.stack,
    }),
  };

  res.status(statusCode).json(responseBody);
};