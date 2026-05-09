/**
 * routes/semesterRoutes.js
 *
 * Router untuk endpoint yang berkaitan dengan semester.
 * Base path: /api/semesters (sesuai mounting di app.js)
 *
 * ============================================================
 * AKSES
 * ============================================================
 * Semua endpoint memerlukan autentikasi (accessValidation) dan
 * dapat diakses oleh semua role yang sudah login (admin, wali_kelas,
 * orang_tua, kepala_sekolah). Tidak ada role restriction khusus.
 *
 * ============================================================
 * ENDPOINT
 * ============================================================
 * GET / → daftar semua semester yang berada di tahun ajaran AKTIF
 *         (beserta data tahun ajaran terkait)
 *
 * ============================================================
 * PENGGUNAAN
 * ============================================================
 * Endpoint ini digunakan oleh berbagai controller yang membutuhkan
 * informasi semester aktif, seperti:
 *   - parents (kehadiran, evaluasi, nilai)
 *   - wali_kelas (input kehadiran, nilai)
 *   - kepala_sekolah (ringkasan performa)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Semester yang dikembalikan hanya dari tahun ajaran dengan is_active = true.
 * - Urutan default berdasarkan nama semester (ASC) → "Ganjil" sebelum "Genap".
 * - Jika ada kebutuhan endpoint lain (misal: detail semester by ID),
 *   tambahkan di sini dengan pola serupa.
 *
 * @module semesterRoutes
 */

const express = require('express');
const router = express.Router();
const semesterController = require('../controllers/semesterController');

/**
 * GET /api/semesters
 *
 * Mendapatkan daftar semua semester dari tahun ajaran aktif.
 * Data yang dikembalikan meliputi:
 *   - id, name, is_active (dari semester)
 *   - academic_year (id, year, is_active) → memastikan tahun ajaran juga aktif
 *
 * @access Semua user terautentikasi (tidak ada pengecekan role spesifik)
 */
router.get('/', semesterController.getActiveSemesters);

module.exports = router;