/**
 * routes/userRoutes.js
 *
 * Router untuk manajemen akun pengguna oleh admin.
 * Base path: /api/users (sesuai mounting di app.js)
 *
 * ============================================================
 * AKSES & KEAMANAN
 * ============================================================
 * Semua endpoint dilindungi oleh middleware yang dipasang di app.js:
 *   - accessValidation        : memverifikasi JWT access token
 *   - roleValidation(['admin']) : hanya role 'admin' yang diizinkan
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /users          → daftar semua pengguna (opsional filter role)
 * GET    /users/:id      → detail satu pengguna
 * POST   /users          → tambah pengguna baru
 * PUT    /users/:id      → perbarui data pengguna
 * DELETE /users/:id      → hapus pengguna
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Business logic ada di controllers/userController.js
 * - Validasi input menggunakan fastest-validator di controller.
 * - Password di-hash otomatis oleh model (beforeCreate/beforeUpdate).
 * - Field sensitif (password, timestamps) tidak dikembalikan ke client.
 *
 * @module userRoutes
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// ============================================================
// READ ROUTES (semua user terautentikasi, namun hanya admin yang diizinkan)
// ============================================================

/**
 * GET /api/users
 *
 * Mendapatkan daftar semua pengguna.
 * Mendukung filter berdasarkan role melalui query parameter: ?role=admin
 *
 * @query {string} [role] - Filter berdasarkan role (admin, wali_kelas, kepala_sekolah, orang_tua)
 * @access Hanya admin
 */
router.get('/', userController.getAllUsers);

/**
 * GET /api/users/:id
 *
 * Mendapatkan detail satu pengguna berdasarkan ID.
 *
 * @param {string} id - UUID pengguna
 * @access Hanya admin
 */
router.get('/:id', userController.getUserById);

// ============================================================
// WRITE ROUTES (hanya admin)
// ============================================================

/**
 * POST /api/users
 *
 * Menambahkan pengguna baru.
 *
 * @body {string} name - Nama pengguna (wajib)
 * @body {string} email - Email (wajib, unik)
 * @body {string} password - Password (minimal 6 karakter)
 * @body {string} role - Role (admin, wali_kelas, kepala_sekolah, orang_tua)
 * @body {string} [nip] - NIP (opsional, unik jika diberikan)
 * @access Hanya admin
 */
router.post('/', userController.createUser);

/**
 * PUT /api/users/:id
 *
 * Memperbarui data pengguna (partial update). Hanya field yang dikirim yang diubah.
 *
 * @param {string} id - UUID pengguna
 * @body {string} [name] - Nama baru
 * @body {string} [email] - Email baru (jika berubah, cek duplikat)
 * @body {string} [password] - Password baru (minimal 6 karakter)
 * @body {string} [role] - Role baru
 * @body {string} [nip] - NIP baru (opsional, unik)
 * @access Hanya admin
 */
router.put('/:id', userController.updateUser);

/**
 * DELETE /api/users/:id
 *
 * Menghapus pengguna secara permanen.
 * Akan gagal jika pengguna masih memiliki data terkait (FK constraint).
 *
 * @param {string} id - UUID pengguna
 * @access Hanya admin
 */
router.delete('/:id', userController.deleteUser);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;