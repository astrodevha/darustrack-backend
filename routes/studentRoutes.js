/**
 * routes/students.js
 *
 * Router untuk manajemen data siswa oleh admin.
 * Base path: /api/students (sesuai mounting di app.js)
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
 * GET    /students          → daftar semua siswa (id, name, nisn) urut A-Z
 * POST   /students          → tambah siswa baru
 * PUT    /students/:id      → perbarui data siswa (partial update)
 * DELETE /students/:id      → hapus siswa
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Business logic ada di controllers/studentController.js
 * - Validasi input (name, nisn, birth_date) dilakukan di controller.
 * - NISN harus 8–10 digit angka dan unik.
 * - Penghapusan siswa akan gagal jika masih memiliki data terkait (FK constraint).
 *
 * @module studentsRoutes
 */

const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

/**
 * GET /api/students
 *
 * Mendapatkan daftar semua siswa (id, name, nisn), diurutkan secara alfabetis.
 *
 * @access Hanya role admin
 */
router.get('/', studentController.getAllStudents);

/**
 * POST /api/students
 *
 * Menambahkan siswa baru.
 *
 * @body {string} name - Nama lengkap siswa (wajib)
 * @body {string} nisn - NISN (8-10 digit angka, wajib, unik)
 * @body {string} birth_date - Tanggal lahir format YYYY-MM-DD (wajib)
 * @body {string} [parent_id] - ID orang tua (opsional)
 * @access Hanya role admin
 */
router.post('/', studentController.createStudent);

/**
 * PUT /api/students/:id
 *
 * Memperbarui data siswa (partial update). Hanya field yang dikirim yang diubah.
 *
 * @param {string} id - UUID siswa
 * @body {string} [name] - Nama baru
 * @body {string} [nisn] - NISN baru (8-10 digit, unik)
 * @body {string} [birth_date] - Tanggal lahir baru (YYYY-MM-DD)
 * @body {string} [parent_id] - ID orang tua baru
 * @access Hanya role admin
 */
router.put('/:id', studentController.updateStudent);

/**
 * DELETE /api/students/:id
 *
 * Menghapus siswa. Akan gagal jika masih memiliki data transaksional (kelas, nilai, kehadiran).
 *
 * @param {string} id - UUID siswa
 * @access Hanya role admin
 */
router.delete('/:id', studentController.deleteStudent);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;