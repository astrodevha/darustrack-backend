/**
 * routes/academicCalendarRoutes.js
 *
 * Router untuk endpoint kalender akademik sekolah.
 * Mengelola event penting seperti hari libur, ujian, penerimaan raport, dll.
 *
 * ============================================================
 * AKSES BERDASARKAN ROLE
 * ============================================================
 * READ (semua role yang authenticated):
 *   GET    /academic-calendar
 *   GET    /academic-calendar/upcoming
 *   GET    /academic-calendar/:id
 *
 * WRITE (admin only):
 *   POST   /academic-calendar
 *   PUT    /academic-calendar/:id
 *   DELETE /academic-calendar/:id
 *
 * ============================================================
 * KEAMANAN
 * ============================================================
 * Semua route dilindungi oleh `accessValidation` yang dipasang di app.js.
 * Operasi write menggunakan middleware lokal `adminOnly` yang memeriksa role.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Route /upcoming HARUS didaftarkan SEBELUM /:id agar Express tidak
 *   salah menginterpretasikan "upcoming" sebagai parameter ID.
 * - Jika ada endpoint publik baru, tambahkan di sini; pastikan accessValidation tetap.
 * - Jangan hapus adminOnly dari endpoint write tanpa mengganti dengan otorisasi setara.
 *
 * @module academicCalendarRoutes
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/academicCalendarController');

// ============================================================
// Local Middleware: Admin Only
// ============================================================

/**
 * Middleware untuk memastikan hanya admin yang dapat melanjutkan request.
 * @param {import('express').Request} req - Express request (req.user sudah diisi accessValidation)
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next function
 */
const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Akses ditolak. Hanya admin yang dapat mengelola kalender akademik.',
    });
  }
  return next();
};

// ============================================================
// READ Routes (All Authenticated Users)
// ============================================================

/**
 * GET /academic-calendar/upcoming
 *
 * Mendapatkan event yang akan datang, dibatasi jumlah (max 50, default 10).
 * Berguna untuk widget "Agenda Mendatang" di dashboard.
 *
 * @query {number} [limit=10] - Maksimal event yang ditampilkan (maks 50)
 * @access Semua user terautentikasi
 */
router.get('/upcoming', ctrl.getUpcomingEvents);

/**
 * GET /academic-calendar
 *
 * Mendapatkan semua event kalender dengan dukungan filter.
 *
 * @query {number} [year] - Filter berdasarkan tahun (contoh: 2025)
 * @query {number} [month] - Filter berdasarkan bulan (1-12)
 * @access Semua user terautentikasi
 */
router.get('/', ctrl.getAllEvents);

/**
 * GET /academic-calendar/:id
 *
 * Mendapatkan detail satu event berdasarkan ID.
 *
 * @param {string} id - UUID event
 * @access Semua user terautentikasi
 */
router.get('/:id', ctrl.getEventById);

// ============================================================
// WRITE Routes (Admin Only)
// ============================================================

/**
 * POST /academic-calendar
 *
 * Membuat event kalender baru.
 *
 * @body {string} event_name - Nama event (wajib, max 255 karakter)
 * @body {string} [start_date] - Tanggal mulai (YYYY-MM-DD)
 * @body {string} [end_date] - Tanggal akhir (YYYY-MM-DD, ≥ start_date)
 * @access Hanya admin
 */
router.post('/', adminOnly, ctrl.createEvent);

/**
 * PUT /academic-calendar/:id
 *
 * Memperbarui event kalender (partial update).
 *
 * @param {string} id - UUID event
 * @body {string} [event_name] - Nama event baru
 * @body {string} [start_date] - Tanggal mulai baru
 * @body {string} [end_date] - Tanggal akhir baru
 * @access Hanya admin
 */
router.put('/:id', adminOnly, ctrl.updateEvent);

/**
 * DELETE /academic-calendar/:id
 *
 * Menghapus event kalender.
 *
 * @param {string} id - UUID event
 * @access Hanya admin
 */
router.delete('/:id', adminOnly, ctrl.deleteEvent);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;