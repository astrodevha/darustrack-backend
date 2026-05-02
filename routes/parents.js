/**
 * routes/parents.js
 * ------------------
 * Router untuk endpoint orang tua (role: orang_tua).
 *
 * File ini hanya mendefinisikan mapping URL → controller.
 * Semua business logic ada di `controllers/parentController.js`.
 *
 * Semua route di sini sudah dilindungi oleh `accessValidation` dan
 * `roleValidation(['orang_tua'])` yang dipasang di app.js.
 *
 * Struktur data yang bisa diakses orang tua:
 *  - Profil anak
 *  - Jadwal pelajaran
 *  - Kehadiran per semester
 *  - Evaluasi per semester
 *  - Nilai (categories, detail) per semester dan mapel
 *
 * @module routes/parents
 */

const express  = require('express');
const router   = express.Router();
const ctrl     = require('../controllers/parentController');

// ── Profil & Jadwal ───────────────────────────────────────────────────────────

/** GET /parents/student — Profil anak beserta info kelas aktif */
router.get('/student', ctrl.profile);

/** GET /parents/schedule?day= — Jadwal pelajaran anak (filter hari opsional) */
router.get('/schedule', ctrl.schedule);

// ── Kehadiran ─────────────────────────────────────────────────────────────────

/** GET /parents/attendances/:semesterId — Riwayat kehadiran per semester */
router.get('/attendances/:semesterId', ctrl.attendances);

// ── Evaluasi ──────────────────────────────────────────────────────────────────

/** GET /parents/evaluations/:semesterId — Daftar judul evaluasi per semester */
router.get('/evaluations/:semesterId', ctrl.evaluationTitles);

/** GET /parents/evaluations/:semesterId/:evaluationId — Detail deskripsi evaluasi */
router.get('/evaluations/:semesterId/:evaluationId', ctrl.evaluationDetail);

// ── Nilai ─────────────────────────────────────────────────────────────────────

/** GET /parents/grades/:semesterId/subjects — Daftar mata pelajaran per semester */
router.get('/grades/:semesterId/subjects', ctrl.subjects);

/** GET /parents/grades/:semesterId/:subjectId/categories — Kategori penilaian */
router.get('/grades/:semesterId/:subjectId/categories', ctrl.categories);

/**
 * GET /parents/grades/categories/:gradeCategoryId/details
 * Detail dan skor per item penilaian dalam satu kategori.
 *
 * CATATAN: Route ini harus didaftarkan SEBELUM /grades/:semesterId/:subjectId/categories
 * dalam versi apapun yang menggunakan parameter dinamis di posisi yang sama.
 * Di Express, urutan registrasi menentukan prioritas matching.
 */
router.get('/grades/categories/:gradeCategoryId/details', ctrl.detailScores);

module.exports = router;
