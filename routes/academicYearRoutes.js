/**
 * routes/academicYearRoutes.js
 *
 * Router untuk manajemen tahun ajaran, semester, kelas, dan penempatan siswa.
 * Semua endpoint hanya dapat diakses oleh role 'admin' (middleware dipasang di app.js).
 *
 * ============================================================
 * STRUKTUR ENDPOINT
 * ============================================================
 * TAHUN AJARAN:
 *   GET    /academic-years                   → semua tahun ajaran + semester
 *   POST   /academic-years                   → buat tahun ajaran baru
 *   PUT    /academic-years/:id               → update tahun ajaran (nama/status)
 *   DELETE /academic-years/:id               → hapus tahun ajaran
 *
 * SEMESTER:
 *   PUT    /academic-years/semesters/:id     → toggle status aktif semester
 *
 * KELAS:
 *   GET    /academic-years/:id/classes       → daftar kelas per tahun ajaran
 *   POST   /academic-years/:id/classes       → buat kelas baru
 *   PUT    /academic-years/classes/:classId  → update kelas
 *   DELETE /academic-years/classes/:classId  → hapus kelas
 *
 * PENEMPATAN SISWA:
 *   GET    /academic-years/:academicYearId/classes/:classId/students        → daftar siswa di kelas
 *   POST   /academic-years/:academicYearId/classes/:classId/students        → tambah siswa ke kelas
 *   DELETE /academic-years/:academicYearId/classes/:classId/students/:studentId → hapus siswa
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan mengubah urutan route tanpa memahami konsekuensi route shadowing.
 * - Jika menambah route baru dengan pola yang mirip, letakkan di area yang sesuai.
 * - Pastikan setiap route memiliki dokumentasi JSDoc yang lengkap.
 *
 * @module academicYearRoutes
 */

const express = require('express');
const router = express.Router();

const academicYearController = require('../controllers/academicYearController');
const semesterController = require('../controllers/semesterController');
const classController = require('../controllers/classController');
const studentClassController = require('../controllers/studentClassController');

// ============================================================================
// ROUTE DENGAN PREFIX STATIS (harus didaftarkan SEBELUM route dinamis :id)
// ============================================================================

// --- Semester Routes ---------------------------------------------------------
/**
 * PUT /academic-years/semesters/:id
 *
 * Mengaktifkan atau menonaktifkan sebuah semester.
 * [Breaking Change] Path berubah dari `/semester/:id` menjadi `/semesters/:id`.
 *
 * @param {string} id - ID semester
 * @body {boolean} is_active - Status baru (true/false)
 * @access Hanya admin
 */
router.put('/semesters/:id', semesterController.updateSemesterStatus);

// --- Class Routes (prefix statis) --------------------------------------------
/**
 * PUT /academic-years/classes/:classId
 *
 * Memperbarui data kelas (nama dan/atau wali kelas).
 *
 * @param {string} classId - ID kelas
 * @body {string} [name] - Nama kelas baru
 * @body {string} [teacher_id] - ID wali kelas baru
 * @access Hanya admin
 */
router.put('/classes/:classId', classController.updateClass);

/**
 * DELETE /academic-years/classes/:classId
 *
 * Menghapus kelas beserta seluruh data terkait (CASCADE jika FK diatur).
 *
 * @param {string} classId - ID kelas
 * @access Hanya admin
 */
router.delete('/classes/:classId', classController.deleteClass);

// --- Student-Class Routes (prefix statis dengan multi segmen) ----------------
/**
 * GET /academic-years/:academicYearId/classes/:classId/students
 *
 * Mendapatkan daftar siswa yang terdaftar di suatu kelas pada tahun ajaran tertentu.
 *
 * @param {string} academicYearId - ID tahun ajaran
 * @param {string} classId - ID kelas
 * @access Hanya admin
 */
router.get(
  '/:academicYearId/classes/:classId/students',
  studentClassController.getStudentsInClass,
);

/**
 * POST /academic-years/:academicYearId/classes/:classId/students
 *
 * Menambahkan satu atau beberapa siswa ke kelas. Operasi bersifat atomik (transaction).
 *
 * @param {string} academicYearId - ID tahun ajaran
 * @param {string} classId - ID kelas
 * @body {string[]} studentIds - Array ID siswa yang akan ditambahkan
 * @access Hanya admin
 */
router.post(
  '/:academicYearId/classes/:classId/students',
  studentClassController.addStudentsToClass,
);

/**
 * DELETE /academic-years/:academicYearId/classes/:classId/students/:studentId
 *
 * Menghapus seorang siswa dari kelas (relasi StudentClass).
 * Peringatan: Akan cascade-delete attendance, nilai, evaluasi siswa di kelas ini.
 *
 * @param {string} academicYearId - ID tahun ajaran
 * @param {string} classId - ID kelas
 * @param {string} studentId - ID siswa
 * @access Hanya admin
 */
router.delete(
  '/:academicYearId/classes/:classId/students/:studentId',
  studentClassController.removeStudentFromClass,
);

// --- Class Routes (dengan parameter dinamis setelah prefix statis) ------------
/**
 * GET /academic-years/:id/classes
 *
 * Mendapatkan daftar kelas dalam suatu tahun ajaran, diurutkan berdasarkan nama.
 *
 * @param {string} id - ID tahun ajaran
 * @access Hanya admin
 */
router.get('/:id/classes', classController.getClassesByAcademicYear);

/**
 * POST /academic-years/:id/classes
 *
 * Membuat kelas baru dalam tahun ajaran tertentu.
 *
 * @param {string} id - ID tahun ajaran
 * @body {string} name - Nama kelas (wajib, min 2 karakter)
 * @body {string} [teacher_id] - ID wali kelas (opsional)
 * @access Hanya admin
 */
router.post('/:id/classes', classController.createClass);

// ============================================================================
// ROUTE DINAMIS (:id) — HARUS TERDAFTAR PALING AKHIR
// ============================================================================

/**
 * GET /academic-years
 *
 * Mendapatkan semua tahun ajaran beserta semesternya, diurutkan dari terbaru.
 *
 * @access Hanya admin
 */
router.get('/', academicYearController.getAllAcademicYears);

/**
 * POST /academic-years
 *
 * Membuat tahun ajaran baru. Secara otomatis membuat semester Ganjil & Genap.
 *
 * @body {string} year - Nama tahun ajaran (contoh: "2024/2025")
 * @body {boolean} [is_active=false] - Apakah tahun ajaran langsung diaktifkan
 * @access Hanya admin
 */
router.post('/', academicYearController.createAcademicYear);

/**
 * PUT /academic-years/:id
 *
 * Memperbarui tahun ajaran (nama dan/atau status aktif).
 * Jika diaktifkan, semua tahun ajaran lain akan dinonaktifkan (dengan transaction).
 *
 * @param {string} id - ID tahun ajaran
 * @body {string} [year] - Nama baru (opsional)
 * @body {boolean} [is_active] - Status aktif baru (opsional)
 * @access Hanya admin
 */
router.put('/:id', academicYearController.updateAcademicYear);

/**
 * DELETE /academic-years/:id
 *
 * Menghapus tahun ajaran beserta semua data terkait (CASCADE di DB).
 * Peringatan: Operasi permanen, tidak bisa dibatalkan.
 *
 * @param {string} id - ID tahun ajaran
 * @access Hanya admin
 */
router.delete('/:id', academicYearController.deleteAcademicYear);

// ============================================================================
// Ekspor Router
// ============================================================================
module.exports = router;