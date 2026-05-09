/**
 * middlewares/roleValidation.js
 *
 * Middleware untuk memvalidasi role pengguna sebelum mengakses route tertentu.
 * Middleware ini bergantung pada `req.user` yang telah diisi oleh `accessValidation`.
 *
 * ============================================================
 * PENGGUNAAN
 * ============================================================
 *   app.use('/admin', accessValidation, roleValidation(['admin']), adminRouter);
 *   app.use('/teachers', accessValidation, roleValidation(['wali_kelas']), teacherRouter);
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Middleware ini HANYA untuk validasi role (whitelist), BUKAN untuk otorisasi
 *   berbasis data spesifik seperti kepemilikan kelas atau tahun ajaran.
 * - Pastikan `accessValidation` dipasang SEBELUM roleValidation.
 * - Jika ada kebutuhan otorisasi berdasarkan data (misal: wali_kelas hanya boleh
 *   akses kelas tertentu), lakukan di controller menggunakan query ke database.
 *
 * @module roleValidation
 */

/**
 * Factory function yang mengembalikan middleware role-checking.
 *
 * @param {string[]} allowedRoles - Array role yang diizinkan (contoh: ['admin', 'wali_kelas'])
 * @returns {import('express').RequestHandler} Express middleware
 */
module.exports = (allowedRoles) => (req, res, next) => {
  // Guard: pastikan req.user sudah diisi oleh accessValidation
  if (!req.user) {
    return res.status(401).json({ message: 'Anda harus login terlebih dahulu' });
  }

  // Cek apakah role user termasuk dalam daftar yang diizinkan
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Akses ditolak. Route ini hanya untuk: ${allowedRoles.join(', ')}`,
    });
  }

  // Lanjut ke middleware/controller berikutnya
  return next();
};