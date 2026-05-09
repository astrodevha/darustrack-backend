/**
 * routes/parents.js
 *
 * Router untuk endpoint orang tua (role: orang_tua).
 * Base path: /api/parents (sesuai mounting di app.js)
 *
 * ============================================================
 * KEAMANAN & AKSES
 * ============================================================
 * Semua endpoint dilindungi oleh middleware yang dipasang di app.js:
 *   - accessValidation          : memverifikasi JWT access token
 *   - roleValidation(['orang_tua']) : hanya role orang_tua yang diizinkan
 *
 * ============================================================
 * STRUKTUR DATA YANG DIAKSES
 * ============================================================
 * Orang tua hanya dapat mengakses data anaknya sendiri (1:1 melalui Student.parent_id).
 * Semua data ditampilkan berdasarkan tahun ajaran dan semester AKTIF.
 *
 * Endpoint yang tersedia:
 *   - Profil anak
 *   - Jadwal pelajaran
 *   - Kehadiran per semester
 *   - Evaluasi per semester
 *   - Nilai (kategori dan detail per mata pelajaran)
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET /parents/student                             → profil anak
 * GET /parents/schedule?day=Senin                  → jadwal pelajaran anak (filter hari)
 * GET /parents/attendances/:semesterId             → kehadiran per semester
 * GET /parents/evaluations/:semesterId             → daftar judul evaluasi per semester
 * GET /parents/evaluations/:semesterId/:evaluationId → detail deskripsi evaluasi
 * GET /parents/grades/:semesterId/subjects         → daftar mata pelajaran per semester
 * GET /parents/grades/:semesterId/:subjectId/categories → kategori penilaian
 * GET /parents/grades/categories/:gradeCategoryId/details → skor per item penilaian
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Business logic sepenuhnya ada di controllers/parentController.js.
 * - Route /grades/categories/:gradeCategoryId/details harus didaftarkan
 *   SEBELUM /grades/:semesterId/:subjectId/categories jika menggunakan
 *   parameter dinamis yang bisa bentrok. Di Express, urutan registrasi
 *   menentukan prioritas matching.
 * - Jangan menambahkan middleware role tambahan di sini karena sudah
 *   ditangani secara global di app.js.
 * - Pastikan semua parameter URL (semesterId, subjectId, gradeCategoryId)
 *   sesuai dengan tipe data UUID yang diharapkan controller.
 *
 * @module parentsRoutes
 */

const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parentController');

// ============================================================
// PROFIL & JADWAL
// ============================================================

/**
 * GET /parents/student
 *
 * Mendapatkan profil anak beserta informasi kelas aktif.
 * Data yang dikembalikan: nama, nisn, birth_date, dan kelas (termasuk wali kelas).
 *
 * @access Hanya role orang_tua (anak diambil dari relasi parent_id)
 */
router.get('/student', parentController.profile);

/**
 * GET /parents/schedule?day=Senin
 *
 * Mendapatkan jadwal pelajaran anak. Opsional filter berdasarkan hari.
 *
 * @query {string} [day] - Nama hari dalam Bahasa Indonesia (Senin, Selasa, ...)
 * @access Hanya role orang_tua
 */
router.get('/schedule', parentController.schedule);

// ============================================================
// KEHADIRAN
// ============================================================

/**
 * GET /parents/attendances/:semesterId
 *
 * Riwayat kehadiran anak per semester, diurutkan dari tanggal terbaru.
 *
 * @param {string} semesterId - ID semester (UUID)
 * @access Hanya role orang_tua
 */
router.get('/attendances/:semesterId', parentController.attendances);

// ============================================================
// EVALUASI (deskriptif, bukan nilai angka)
// ============================================================

/**
 * GET /parents/evaluations/:semesterId
 *
 * Daftar judul evaluasi yang tersedia untuk anak di semester tertentu.
 *
 * @param {string} semesterId - ID semester (UUID)
 * @access Hanya role orang_tua
 */
router.get('/evaluations/:semesterId', parentController.evaluationTitles);

/**
 * GET /parents/evaluations/:semesterId/:evaluationId
 *
 * Detail deskripsi evaluasi untuk anak pada suatu judul evaluasi.
 *
 * @param {string} semesterId - ID semester (UUID)
 * @param {string} evaluationId - ID evaluasi (UUID)
 * @access Hanya role orang_tua
 */
router.get('/evaluations/:semesterId/:evaluationId', parentController.evaluationDetail);

// ============================================================
// NILAI (GRADE)
// ============================================================

/**
 * GET /parents/grades/:semesterId/subjects
 *
 * Daftar mata pelajaran unik yang dijadwalkan untuk anak di semester tersebut.
 *
 * @param {string} semesterId - ID semester (UUID)
 * @access Hanya role orang_tua
 */
router.get('/grades/:semesterId/subjects', parentController.subjects);

/**
 * GET /parents/grades/:semesterId/:subjectId/categories
 *
 * Kategori penilaian untuk mata pelajaran dan semester tertentu
 * (contoh: "Ulangan Harian", "UTS", "UAS").
 *
 * @param {string} semesterId - ID semester (UUID)
 * @param {string} subjectId - ID mata pelajaran (UUID)
 * @access Hanya role orang_tua
 */
router.get('/grades/:semesterId/:subjectId/categories', parentController.categories);

/**
 * GET /parents/grades/categories/:gradeCategoryId/details
 *
 * Detail setiap item penilaian dalam suatu kategori beserta skor anak.
 * (Contoh: untuk kategori "Ulangan Harian", tampilkan "UH Bab 1", "UH Bab 2", dan nilai masing-masing)
 *
 * PERHATIAN: Route ini HARUS didaftarkan SEBELUM /grades/:semesterId/:subjectId/categories
 * agar parameter `:gradeCategoryId` tidak tertangkap oleh `:semesterId`.
 * Express mencocokkan route berdasarkan urutan registrasi.
 *
 * @param {string} gradeCategoryId - ID kategori nilai (UUID)
 * @access Hanya role orang_tua
 */
router.get('/grades/categories/:gradeCategoryId/details', parentController.detailScores);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;