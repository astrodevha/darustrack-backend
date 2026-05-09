/**
 * routes/headmasterRoutes.js
 *
 * Router untuk semua endpoint kepala sekolah (role: kepala_sekolah).
 * Base path: /api/headmaster (sesuai mounting di app.js)
 *
 * ============================================================
 * AKSES
 * ============================================================
 * Semua endpoint dilindungi oleh middleware:
 *   - accessValidation   : memverifikasi JWT access token
 *   - roleValidation(['kepala_sekolah']) : hanya role kepala_sekolah yang diizinkan
 *
 * Kepala sekolah memiliki akses READ-ONLY ke ringkasan performa kelas.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET /headmaster/classes          → ringkasan semua kelas di semester aktif
 * GET /headmaster/classes/:classId → detail performa satu kelas
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan mengubah nama variabel `classSummaryController` tanpa menguji ulang.
 * - Pastikan middleware roleValidation(['kepala_sekolah']) sudah terpasang di app.js.
 * - Jika ada kebutuhan endpoint baru untuk kepala sekolah, tambahkan di sini
 *   dengan pola yang sama.
 *
 * @module headmasterRoutes
 */

const express = require('express');
const router = express.Router();

const classSummaryController = require('../controllers/classSummaryController');

/**
 * GET /headmaster/classes
 *
 * Mendapatkan ringkasan performa semua kelas di tahun ajaran dan semester aktif.
 * Data yang dikembalikan per kelas:
 *   - total_students       : jumlah siswa terdaftar
 *   - average_score        : rata-rata nilai keseluruhan
 *   - attendance_percentage: persentase kehadiran
 *
 * @access Hanya role kepala_sekolah
 */
router.get('/classes', classSummaryController.getAllClassesSummary);

/**
 * GET /headmaster/classes/:classId
 *
 * Mendapatkan detail performa satu kelas, termasuk:
 *   - average_score_per_subject : rata-rata nilai per mata pelajaran
 *   - overall_average_score     : rata-rata nilai keseluruhan
 *   - attendance_percentage     : persentase kehadiran
 *   - student_rankings          : ranking siswa (competition ranking)
 *
 * @param {string} classId - ID kelas (UUID)
 * @access Hanya role kepala_sekolah
 */
router.get('/classes/:classId', classSummaryController.getDetailClassesSummary);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;