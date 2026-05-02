/**
 * middlewares/roleValidation.js
 * ------------------------------
 * Middleware untuk memvalidasi role pengguna sebelum mengakses route tertentu.
 *
 * Cara penggunaan:
 *   app.use('/admin', accessValidation, roleValidation(['admin']), adminRouter);
 *   app.use('/teachers', accessValidation, roleValidation(['wali_kelas']), teacherRouter);
 *
 * Catatan: Middleware ini bergantung pada `req.user` yang diisi oleh
 * `accessValidation` sebelumnya. Pastikan `accessValidation` selalu
 * dipasang sebelum middleware ini.
 *
 * @module middlewares/roleValidation
 */

/**
 * Factory function yang mengembalikan middleware role-checking.
 *
 * @param {string[]} allowedRoles - Array role yang diizinkan (contoh: ['admin', 'wali_kelas'])
 * @returns {import('express').RequestHandler} Express middleware
 */
module.exports = (allowedRoles) => (req, res, next) => {
  // Guard: req.user seharusnya sudah diisi oleh accessValidation
  if (!req.user) {
    return res.status(401).json({ message: 'Anda harus login terlebih dahulu' });
  }

  // Cek apakah role user termasuk dalam daftar yang diizinkan
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Akses ditolak. Route ini hanya untuk: ${allowedRoles.join(', ')}`,
    });
  }

  return next();
};

/**
 * CATATAN PENTING (Bug yang sudah diperbaiki):
 * ─────────────────────────────────────────────
 * Versi sebelumnya memiliki dua pengecekan bermasalah:
 *
 *   if (req.user.role === 'wali_kelas' && req.user.class_id !== req.params.class_id) {
 *     return res.status(403)...
 *   }
 *   if (req.user.role === 'kepala_sekolah' && req.params.class_id) {
 *     return res.status(403)...
 *   }
 *
 * Bug #1 (wali_kelas): `req.user` hanya memiliki field `id` dan `role`
 * (sesuai query di accessValidation). Field `class_id` tidak ada, sehingga
 * `req.user.class_id` selalu `undefined`. Akibatnya, SEMUA wali_kelas yang
 * mengakses route dengan `:class_id` param akan selalu di-reject (403).
 *
 * Bug #2 (kepala_sekolah): Kepala sekolah tidak bisa mengakses route apapun
 * yang kebetulan memiliki param `:class_id`, padahal mereka mungkin perlu akses tersebut.
 *
 * Kedua pengecekan ini dihapus. Autorisasi berbasis kepemilikan kelas
 * (ownership check) dilakukan di level controller secara eksplisit —
 * bukan di middleware generik.
 */
