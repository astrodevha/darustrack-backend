/**
 * routes/subjects.js
 *
 * Router untuk manajemen mata pelajaran (Subject).
 * Base path: /api/subjects (sesuai mounting di app.js)
 *
 * ============================================================
 * AKSES & KEAMANAN
 * ============================================================
 * - READ (GET)    : semua user terautentikasi (accessValidation dipasang di app.js)
 * - WRITE (POST, PUT, DELETE) : hanya role 'admin' (melalui roleValidation)
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /subjects          → daftar semua mata pelajaran (id, name) urut A-Z
 * GET    /subjects/:id      → detail satu mata pelajaran
 * POST   /subjects          → tambah mata pelajaran baru (admin only)
 * PUT    /subjects/:id      → update mata pelajaran (admin only, partial)
 * DELETE /subjects/:id      → hapus mata pelajaran (admin only)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Semua controller dibungkus dengan `asyncHandler` untuk menangkap error async
 *   secara otomatis tanpa try/catch manual di setiap fungsi.
 * - Validasi input dilakukan di controller (fastest-validator).
 * - Penghapusan mata pelajaran akan gagal jika masih digunakan di jadwal atau
 *   kategori nilai (SequelizeForeignKeyConstraintError).
 *
 * @module subjectsRoutes
 */

const express = require('express');
const router = express.Router();
const subjectController = require('../controllers/subjectController');
const roleValidation = require('../middlewares/roleValidation');
const asyncHandler = require('../middlewares/asyncHandler');

// ============================================================
// READ ROUTES (semua user terautentikasi)
// ============================================================

/**
 * GET /api/subjects
 *
 * Mendapatkan daftar semua mata pelajaran (id, name), diurutkan alfabetis.
 *
 * @access Semua user terautentikasi
 */
router.get('/', asyncHandler(subjectController.listSubjects));

/**
 * GET /api/subjects/:id
 *
 * Mendapatkan detail satu mata pelajaran (name, description).
 *
 * @param {string} id - UUID mata pelajaran
 * @access Semua user terautentikasi
 */
router.get('/:id', asyncHandler(subjectController.getSubject));

// ============================================================
// WRITE ROUTES (hanya admin)
// ============================================================

/**
 * POST /api/subjects
 *
 * Menambahkan mata pelajaran baru.
 *
 * @body {string} name - Nama mata pelajaran (wajib, unik)
 * @body {string} [description] - Deskripsi (opsional)
 * @access Hanya admin
 */
router.post(
  '/',
  roleValidation(['admin']),
  asyncHandler(subjectController.createSubject),
);

/**
 * PUT /api/subjects/:id
 *
 * Memperbarui mata pelajaran (partial update).
 * Semua field bersifat opsional.
 *
 * @param {string} id - UUID mata pelajaran
 * @body {string} [name] - Nama baru
 * @body {string} [description] - Deskripsi baru
 * @access Hanya admin
 */
router.put(
  '/:id',
  roleValidation(['admin']),
  asyncHandler(subjectController.updateSubject),
);

/**
 * DELETE /api/subjects/:id
 *
 * Menghapus mata pelajaran.
 * Akan gagal jika masih digunakan dalam jadwal atau kategori nilai.
 *
 * @param {string} id - UUID mata pelajaran
 * @access Hanya admin
 */
router.delete(
  '/:id',
  roleValidation(['admin']),
  asyncHandler(subjectController.deleteSubject),
);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;