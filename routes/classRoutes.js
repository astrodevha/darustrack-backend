/**
 * routes/classes.js
 *
 * Router untuk endpoint yang berkaitan dengan kelas dan jadwal pelajaran.
 * Base path: /api/classes (atau sesuai mounting di app.js)
 *
 * ============================================================
 * AKSES BERDASUKAN ROLE
 * ============================================================
 * - GET /         → Daftar kelas aktif (semua user terautentikasi)
 * - GET /:class_id/schedule → Jadwal satu kelas (semua user terautentikasi)
 * - POST /:class_id/schedule → Tambah jadwal (admin / wali_kelas dengan otorisasi)
 * - PUT /schedule/:schedule_id → Update jadwal (admin / wali_kelas pemilik)
 * - DELETE /schedule/:schedule_id → Hapus jadwal (admin / wali_kelas pemilik)
 *
 * Catatan: Otorisasi spesifik (misal: wali_kelas hanya untuk kelasnya) dilakukan
 * di controller (scheduleController, classController). Middleware `accessValidation`
 * dan `roleValidation` diasumsikan sudah dipasang di level atas (app.js) untuk
 * semua route yang membutuhkan autentikasi.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /                           → daftar kelas aktif (filter grade_level opsional)
 * GET    /:class_id/schedule         → jadwal kelas tertentu (opsional filter hari)
 * POST   /:class_id/schedule         → tambah jadwal baru
 * PUT    /schedule/:schedule_id      → update jadwal
 * DELETE /schedule/:schedule_id      → hapus jadwal
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Pastikan route yang lebih spesifik (seperti `/:class_id/schedule`) didaftarkan
 *   sebelum route dengan parameter yang bisa bentrok.
 * - Otorisasi berbasis kepemilikan kelas (misal: wali_kelas hanya boleh mengelola
 *   jadwal kelasnya sendiri) ditangani di controller menggunakan query ke database.
 * - Jangan menambahkan middleware roleValidation di sini jika sudah dipasang global.
 *
 * @module routes/classes
 */

const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const scheduleController = require('../controllers/scheduleController');

// ============================================================
// CLASS ROUTES
// ============================================================

/**
 * GET /api/classes
 *
 * Mendapatkan daftar kelas aktif (dari tahun ajaran yang sedang aktif).
 * Mendukung filter optional berdasarkan grade level (tingkatan kelas).
 *
 * @query {number} [grade_level] - Filter kelas berdasarkan tingkat (contoh: 4, 5, 6)
 * @access Semua user terautentikasi
 */
router.get('/', classController.getActiveClasses);

// ============================================================
// SCHEDULE ROUTES (nested di bawah kelas)
// ============================================================

/**
 * GET /api/classes/:class_id/schedule
 *
 * Mendapatkan jadwal pelajaran untuk satu kelas tertentu.
 * Mendukung filter optional berdasarkan hari.
 *
 * @param {string} class_id - ID kelas (UUID)
 * @query {string} [day] - Filter berdasarkan hari (Senin, Selasa, ...)
 * @access Semua user terautentikasi
 */
router.get('/:class_id/schedule', scheduleController.getClassSchedules);

/**
 * POST /api/classes/:class_id/schedule
 *
 * Menambahkan jadwal baru ke kelas tertentu.
 *
 * @param {string} class_id - ID kelas (UUID)
 * @body {string} subject_id - ID mata pelajaran
 * @body {string} day - Hari (Senin, Selasa, ...)
 * @body {string} start_time - Waktu mulai (HH:MM atau HH:MM:SS)
 * @body {string} end_time - Waktu selesai (HH:MM atau HH:MM:SS)
 * @access Admin atau wali_kelas yang mengampu kelas ini (dicek di controller)
 */
router.post('/:class_id/schedule', scheduleController.createSchedule);

/**
 * PUT /api/classes/schedule/:schedule_id
 *
 * Memperbarui jadwal yang sudah ada (partial update).
 *
 * @param {string} schedule_id - ID jadwal (UUID)
 * @body {string} [subject_id] - ID mata pelajaran baru
 * @body {string} [day] - Hari baru
 * @body {string} [start_time] - Waktu mulai baru
 * @body {string} [end_time] - Waktu selesai baru
 * @access Admin atau wali_kelas pemilik jadwal (dicek di controller)
 */
router.put('/schedule/:schedule_id', scheduleController.updateSchedule);

/**
 * DELETE /api/classes/schedule/:schedule_id
 *
 * Menghapus jadwal.
 *
 * @param {string} schedule_id - ID jadwal (UUID)
 * @access Admin atau wali_kelas pemilik jadwal (dicek di controller)
 */
router.delete('/schedule/:schedule_id', scheduleController.deleteSchedule);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;