/**
 * middlewares/loadActiveSemester.js
 *
 * Middleware yang memuat semester aktif dari database dan menyimpannya
 * di `req.activeSemester` untuk digunakan oleh route handler berikutnya.
 *
 * ============================================================
 * PENGGUNAAN
 * ============================================================
 * Middleware ini dipasang pada route yang membutuhkan konteks semester aktif,
 * seperti input/edit kehadiran (teacherAttendanceController) atau input/edit nilai.
 *
 * Contoh:
 *   router.get('/attendances', loadActiveSemester, attendanceCtrl.getAttendances);
 *   // di dalam getAttendances, req.activeSemester sudah tersedia
 *
 * ============================================================
 * VALIDASI
 * ============================================================
 * Middleware ini memastikan bahwa:
 *   1. Ada semester dengan is_active = true
 *   2. Semester tersebut berasal dari tahun ajaran yang juga aktif (is_active = true)
 * Jika tidak ditemukan, langsung kembalikan 404 dan tidak melanjutkan ke handler berikutnya.
 *
 * @module loadActiveSemester
 */

// ============================================================
// Dependencies
// ============================================================
const { Semester, AcademicYear } = require('../models');

// ============================================================
// Middleware
// ============================================================

/**
 * Memuat semester aktif dan menyuntikkannya ke `req.activeSemester`.
 *
 * Logika:
 *   - Cari semester dengan is_active = true
 *   - Pastikan semester tersebut terkait dengan tahun ajaran yang juga aktif
 *   - Jika ditemukan, simpan ke req.activeSemester dan panggil next()
 *   - Jika tidak ditemukan, kembalikan 404
 *   - Jika terjadi error, log di server dan kembalikan 500 (pesan generik)
 *
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 * @returns {Promise<void>}
 */
module.exports = async function loadActiveSemester(req, res, next) {
  try {
    /**
     * Ambil semester aktif yang juga berasal dari tahun ajaran aktif.
     *
     * Mengapa perlu join dengan AcademicYear?
     *   - Ada kemungkinan semester aktif terakhir berasal dari tahun ajaran
     *     yang sudah dinonaktifkan (misal: admin lupa menonaktifkan semester
     *     setelah tahun ajaran berakhir). Dengan join ini, kita menolak
     *     semester dari tahun ajaran tidak aktif.
     *
     * `required: true` pada include menyebabkan INNER JOIN, sehingga jika
     * AcademicYear tidak ditemukan atau tidak aktif, query mengembalikan null.
     */
    const semester = await Semester.findOne({
      where: { is_active: true },
      include: {
        model: AcademicYear,
        as: 'academic_year',
        where: { is_active: true },
        required: true, // INNER JOIN — tolak jika tahun ajaran tidak aktif
      },
    });

    if (!semester) {
      return res.status(404).json({
        message: 'Tidak ada semester aktif yang ditemukan. ' +
                 'Pastikan tahun ajaran dan semester aktif sudah dikonfigurasi.',
      });
    }

    // Suntikkan semester ke request object untuk digunakan controller
    req.activeSemester = semester;
    return next();
  } catch (err) {
    // Hanya log di server, jangan bocorkan detail error ke client
    console.error('[loadActiveSemester] Error:', err);
    return res.status(500).json({ message: 'Gagal memuat data semester aktif' });
  }
};