/**
 * middlewares/loadActiveSemester.js
 * ----------------------------------
 * Middleware yang memuat semester aktif dari database dan menyimpannya
 * di `req.activeSemester` untuk digunakan oleh route handler berikutnya.
 *
 * Digunakan pada route yang membutuhkan konteks semester aktif, misalnya:
 *   - Input/edit kehadiran
 *   - Input/edit nilai
 *
 * Jika tidak ada semester aktif, middleware ini langsung mengembalikan 404
 * dan tidak melanjutkan ke handler berikutnya.
 *
 * Cara penggunaan:
 *   router.get('/attendances', loadActiveSemester, async (req, res) => {
 *     const semester = req.activeSemester;
 *     // ...
 *   });
 *
 * @module middlewares/loadActiveSemester
 */

const { Semester } = require('../models');

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
module.exports = async function loadActiveSemester(req, res, next) {
  try {
    const semester = await Semester.findOne({ where: { is_active: true } });

    if (!semester) {
      return res.status(404).json({ message: 'Semester aktif tidak ditemukan' });
    }

    req.activeSemester = semester;
    return next();
  } catch (err) {
    console.error('[loadActiveSemester] Error:', err.message);
    return res.status(500).json({ message: 'Gagal memuat semester aktif', error: err.message });
  }
};
