/**
 * middlewares/errorHandler.js
 * ----------------------------
 * Centralized error handling middleware untuk Express.
 *
 * Semua error yang tidak ditangani di route handler akan sampai ke sini
 * melalui `next(err)`. Middleware ini memformat response error secara
 * konsisten dan memastikan stack trace hanya ditampilkan di development.
 *
 * Cara penggunaan di route/controller:
 *   try { ... } catch (err) { next(err); }
 *   // atau gunakan asyncHandler agar otomatis
 *
 * @module middlewares/errorHandler
 */

/**
 * Express error-handling middleware (4 parameter: err, req, res, next).
 *
 * @param {Error}           err  - Error object yang dilempar oleh route/middleware
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  // Gunakan status code dari error jika ada, default ke 500
  const statusCode = err.status || err.statusCode || 500;

  // Log error di server (termasuk stack trace) untuk debugging
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} → ${statusCode}:`, err.message);
    if (statusCode >= 500) {
      console.error(err.stack);
    }
  }

  // Jangan expose stack trace ke client di production
  const isDev = process.env.NODE_ENV !== 'production';

  res.status(statusCode).json({
    message: err.message || 'Terjadi kesalahan pada server',
    ...(isDev && { stack: err.stack }),
  });
};
