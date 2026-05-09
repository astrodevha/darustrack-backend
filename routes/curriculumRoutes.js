/**
 * routes/curriculumRoutes.js
 *
 * Router untuk mengelola data kurikulum (satu kurikulum aktif dalam sistem).
 * Base path: /api/curriculum (sesuai mounting di app.js)
 *
 * ============================================================
 * KEAMANAN & AKSES
 * ============================================================
 * - GET /    → membaca data kurikulum (semua user terautentikasi)
 * - PUT /:id → memperbarui kurikulum (hanya role 'admin')
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET  /curriculum          → ambil data kurikulum (tanpa perlu ID)
 * PUT  /curriculum/:id      → perbarui nama dan/atau deskripsi kurikulum
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - ID kurikulum biasanya adalah 1 (karena hanya satu entri).
 * - Pastikan middleware `roleValidation(['admin'])` dipasang di app.js
 *   sebelum router ini untuk endpoint PUT.
 * - Endpoint GET bersifat publik setelah autentikasi (role apapun bisa melihat).
 *
 * @module curriculumRoutes
 */

const express = require('express');
const router = express.Router();
const curriculumController = require('../controllers/curriculumController');
const roleValidation = require('../middlewares/roleValidation');

// ============================================================
// READ – Semua user terautentikasi
// ============================================================

/**
 * GET /api/curriculum
 *
 * Mengambil data kurikulum yang tersedia (hanya satu entri).
 * Jika belum ada kurikulum, kembalikan objek kosong (bukan error).
 *
 * @access Semua user terautentikasi (tidak ada pengecekan role)
 */
router.get('/', curriculumController.getCurriculum);

// ============================================================
// WRITE – Hanya admin
// ============================================================

/**
 * PUT /api/curriculum/:id
 *
 * Memperbarui nama dan/atau deskripsi kurikulum.
 * Hanya field yang dikirim yang akan diupdate (partial update).
 *
 * @param {string} id - ID kurikulum (biasanya 1, karena hanya satu)
 * @body {string} [name] - Nama kurikulum baru (opsional)
 * @body {string} [description] - Deskripsi baru (opsional)
 * @access Hanya admin (roleValidation(['admin']))
 */
router.put('/:id', roleValidation(['admin']), curriculumController.updateCurriculum);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;