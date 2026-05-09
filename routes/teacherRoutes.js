/**
 * routes/teachers.js
 *
 * Router untuk semua endpoint wali kelas (role: wali_kelas).
 * Base path: /api/teachers (sesuai mounting di app.js)
 *
 * ============================================================
 * KEAMANAN & AKSES
 * ============================================================
 * Semua endpoint dilindungi oleh middleware:
 *   - accessValidation          : memverifikasi JWT access token
 *   - roleValidation(['wali_kelas']) : hanya wali_kelas yang diizinkan
 *
 * ============================================================
 * STRUKTUR KONTROLLER
 * ============================================================
 * - attendanceCtrl   : kehadiran siswa
 * - evaluationCtrl   : evaluasi deskriptif siswa
 * - gradeCtrl        : nilai (grade) siswa
 * - classCtrl        : informasi kelas yang diampu
 * - scheduleCtrl     : jadwal pelajaran (satu-satunya sumber kebenaran, M-08)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan mengubah urutan route tanpa mempertimbangkan route shadowing.
 * - Pastikan semua controller yang diperlukan sudah di-import dengan benar.
 * - Untuk endpoint kehadiran, middleware loadActiveSemester harus dipasang
 *   sebelum handler karena menyediakan req.activeSemester.
 *
 * @module teachersRoutes
 */

const express = require('express');
const router = express.Router();
const loadActiveSemester = require('../middlewares/loadActiveSemester');

// ============================================================
// Controller Imports
// ============================================================
const attendanceCtrl = require('../controllers/teacherAttendanceController');
const evaluationCtrl = require('../controllers/teacherEvaluationController');
const gradeCtrl = require('../controllers/teacherGradeController');
const classCtrl = require('../controllers/classController');

/**
 * scheduleCtrl – Satu-satunya sumber kebenaran untuk jadwal wali kelas.
 * [Fix M-08] Duplikasi getSchedules di classController sudah dihapus.
 */
const scheduleCtrl = require('../controllers/scheduleController');

// ============================================================
// Kelas & Jadwal
// ============================================================

/**
 * GET /teachers/my-class
 *
 * Mendapatkan informasi kelas yang diampu oleh wali kelas yang sedang login
 * pada tahun ajaran aktif. Data yang dikembalikan: id, name, grade_level.
 *
 * @access Hanya wali_kelas
 */
router.get('/my-class', classCtrl.getMyClass);

/**
 * GET /teachers/schedules?day=Senin
 *
 * Mendapatkan jadwal pelajaran kelas yang diampu.
 * Mendukung filter opsional berdasarkan hari.
 *
 * [Fix M-08] Menggunakan scheduleCtrl.getSchedules (bukan classCtrl.getSchedules).
 *
 * @query {string} [day] - Hari dalam Bahasa Indonesia (Senin, Selasa, ...)
 * @access Hanya wali_kelas
 */
router.get('/schedules', scheduleCtrl.getSchedules);

// ============================================================
// Semester (Informasi konteks)
// ============================================================

/**
 * GET /teachers/semesters
 *
 * Mendapatkan daftar semester dari tahun ajaran aktif beserta status aktifnya.
 * Digunakan oleh frontend untuk dropdown konteks semester saat input nilai/kehadiran.
 *
 * TODO (L-02): Pindahkan handler ini ke semesterController untuk konsistensi arsitektur.
 *
 * @access Hanya wali_kelas
 */
const { AcademicYear, Semester } = require('../models');

router.get('/semesters', async (req, res) => {
  try {
    const activeYear = await AcademicYear.findOne({
      where: { is_active: true },
      include: [
        {
          model: Semester,
          as: 'semester',
          attributes: ['id', 'name', 'is_active'],
        },
      ],
    });

    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    return res.json({ semesters: activeYear.semester });
  } catch (error) {
    console.error('[teachers/semesters] Error:', error);
    // [Fix H-01] Tidak mengirim error.message ke client
    return res.status(500).json({ message: 'Gagal mengambil data semester' });
  }
});

// ============================================================
// Kehadiran (Attendance)
// ============================================================
// Semua endpoint kehadiran memerlukan `loadActiveSemester` untuk mengisi req.activeSemester.

/**
 * GET /teachers/attendances/rekap
 *
 * Mendapatkan daftar tanggal unik yang sudah memiliki data kehadiran di semester aktif.
 *
 * @access Hanya wali_kelas
 */
router.get('/attendances/rekap', loadActiveSemester, attendanceCtrl.getAttendanceRekap);

/**
 * GET /teachers/attendances
 *
 * Mendapatkan data kehadiran seluruh siswa pada tanggal tertentu.
 *
 * @query {string} date - Tanggal dalam format YYYY-MM-DD
 * @access Hanya wali_kelas
 */
router.get('/attendances', loadActiveSemester, attendanceCtrl.getAttendances);

/**
 * POST /teachers/attendances
 *
 * Membuat sesi kehadiran (status default 'Not Set') untuk semua siswa di kelas
 * pada tanggal yang diberikan.
 *
 * @body {string} date - Tanggal dalam format YYYY-MM-DD
 * @access Hanya wali_kelas
 */
router.post('/attendances', loadActiveSemester, attendanceCtrl.createAttendance);

/**
 * PUT /teachers/attendances
 *
 * Memperbarui status kehadiran beberapa siswa sekaligus pada tanggal tertentu.
 *
 * @query {string} date - Tanggal dalam format YYYY-MM-DD
 * @body {Array} attendanceUpdates - Array object { student_class_id, status }
 * @access Hanya wali_kelas
 */
router.put('/attendances', loadActiveSemester, attendanceCtrl.updateAttendances);

/**
 * DELETE /teachers/attendances
 *
 * Menghapus seluruh data kehadiran pada tanggal tertentu untuk kelas wali kelas.
 *
 * @query {string} date - Tanggal dalam format YYYY-MM-DD
 * @access Hanya wali_kelas
 */
router.delete('/attendances', loadActiveSemester, attendanceCtrl.deleteAttendance);

// ============================================================
// Evaluasi (Deskriptif)
// ============================================================

/**
 * GET /teachers/semesters/:semester_id/evaluations
 *
 * Mendapatkan daftar judul evaluasi yang telah dibuat untuk kelas wali kelas di semester tertentu.
 *
 * @param {string} semester_id - ID semester (UUID)
 * @access Hanya wali_kelas
 */
router.get('/semesters/:semester_id/evaluations', evaluationCtrl.getEvaluations);

/**
 * POST /teachers/semesters/:semester_id/evaluations
 *
 * Membuat judul evaluasi baru dan secara otomatis membuat entri StudentEvaluation
 * untuk semua siswa di kelas. Operasi bersifat atomik (transaction).
 *
 * @param {string} semester_id - ID semester (UUID)
 * @body {string} title - Judul evaluasi
 * @access Hanya wali_kelas
 */
router.post('/semesters/:semester_id/evaluations', evaluationCtrl.createEvaluation);

/**
 * GET /teachers/evaluations/:id
 *
 * Mendapatkan detail evaluasi: deskripsi untuk setiap siswa di kelas.
 *
 * @param {string} id - ID evaluasi (UUID)
 * @access Hanya wali_kelas
 */
router.get('/evaluations/:id', evaluationCtrl.getEvaluationDetail);

/**
 * PUT /teachers/evaluations/:id
 *
 * Memperbarui judul evaluasi.
 *
 * @param {string} id - ID evaluasi (UUID)
 * @body {string} title - Judul baru
 * @access Hanya wali_kelas
 */
router.put('/evaluations/:id', evaluationCtrl.updateEvaluation);

/**
 * DELETE /teachers/evaluations/:id
 *
 * Menghapus evaluasi beserta semua StudentEvaluation terkait.
 *
 * @param {string} id - ID evaluasi (UUID)
 * @access Hanya wali_kelas
 */
router.delete('/evaluations/:id', evaluationCtrl.deleteEvaluation);

/**
 * PUT /teachers/student-evaluations/:id
 *
 * Memperbarui deskripsi evaluasi untuk satu siswa.
 *
 * @param {string} id - ID StudentEvaluation (UUID)
 * @body {string} description - Deskripsi baru
 * @access Hanya wali_kelas
 */
router.put('/student-evaluations/:id', evaluationCtrl.updateStudentEvaluation);

// ============================================================
// Nilai (Grades)
// ============================================================
// Perhatikan urutan: route literal (statis) harus sebelum route dengan parameter.

/**
 * GET /teachers/grades/subjects
 *
 * Mendapatkan daftar mata pelajaran unik yang dijadwalkan di kelas wali kelas.
 *
 * @access Hanya wali_kelas
 */
router.get('/grades/subjects', gradeCtrl.getSubjects);

/**
 * GET /teachers/grades/categories/:category_id/details
 *
 * Mendapatkan daftar item penilaian (GradeDetail) dalam suatu kategori.
 *
 * @param {string} category_id - ID GradeCategory (UUID)
 * @access Hanya wali_kelas
 */
router.get('/grades/categories/:category_id/details', gradeCtrl.getDetails);

/**
 * POST /teachers/grades/categories/:category_id/details
 *
 * Menambahkan item penilaian baru ke kategori. Secara otomatis membuat entri
 * StudentGrade (score null) untuk semua siswa di kelas.
 *
 * @param {string} category_id - ID GradeCategory (UUID)
 * @body {string} name - Nama item penilaian
 * @body {string} [date] - Tanggal pelaksanaan (YYYY-MM-DD)
 * @access Hanya wali_kelas
 */
router.post('/grades/categories/:category_id/details', gradeCtrl.createDetail);

/**
 * PUT /teachers/grades/categories/:category_id
 *
 * Memperbarui nama kategori penilaian.
 *
 * @param {string} category_id - ID GradeCategory (UUID)
 * @body {string} name - Nama baru
 * @access Hanya wali_kelas
 */
router.put('/grades/categories/:category_id', gradeCtrl.updateCategory);

/**
 * DELETE /teachers/grades/categories/:category_id
 *
 * Menghapus kategori penilaian beserta semua GradeDetail dan StudentGrade terkait.
 *
 * @param {string} category_id - ID GradeCategory (UUID)
 * @access Hanya wali_kelas
 */
router.delete('/grades/categories/:category_id', gradeCtrl.deleteCategory);

/**
 * GET /teachers/grades/details/:detail_id/students
 *
 * Mendapatkan daftar siswa beserta skor mereka untuk suatu item penilaian.
 *
 * @param {string} detail_id - ID GradeDetail (UUID)
 * @access Hanya wali_kelas
 */
router.get('/grades/details/:detail_id/students', gradeCtrl.getStudentGrades);

/**
 * PUT /teachers/grades/details/:detail_id
 *
 * Memperbarui nama dan/atau tanggal item penilaian.
 *
 * @param {string} detail_id - ID GradeDetail (UUID)
 * @body {string} [name] - Nama baru
 * @body {string} [date] - Tanggal baru (YYYY-MM-DD)
 * @access Hanya wali_kelas
 */
router.put('/grades/details/:detail_id', gradeCtrl.updateDetail);

/**
 * DELETE /teachers/grades/details/:detail_id
 *
 * Menghapus item penilaian beserta semua nilai siswa terkait.
 *
 * @param {string} detail_id - ID GradeDetail (UUID)
 * @access Hanya wali_kelas
 */
router.delete('/grades/details/:detail_id', gradeCtrl.deleteDetail);

/**
 * GET /teachers/grades/:subject_id/:semester_id/categories
 *
 * Mendapatkan daftar kategori penilaian untuk mata pelajaran dan semester tertentu.
 *
 * @param {string} subject_id - ID mata pelajaran (UUID)
 * @param {string} semester_id - ID semester (UUID)
 * @access Hanya wali_kelas
 */
router.get('/grades/:subject_id/:semester_id/categories', gradeCtrl.getCategories);

/**
 * POST /teachers/grades/:subject_id/:semester_id/categories
 *
 * Membuat kategori penilaian baru untuk mata pelajaran dan semester tertentu.
 *
 * @param {string} subject_id - ID mata pelajaran (UUID)
 * @param {string} semester_id - ID semester (UUID)
 * @body {string} name - Nama kategori
 * @access Hanya wali_kelas
 */
router.post('/grades/:subject_id/:semester_id/categories', gradeCtrl.createCategory);

/**
 * PATCH /teachers/grades/students/:student_grade_id
 *
 * Memperbarui skor satu siswa untuk satu item penilaian.
 *
 * @param {string} student_grade_id - ID StudentGrade (UUID)
 * @body {number} score - Nilai antara 0 dan 100
 * @access Hanya wali_kelas
 */
router.patch('/grades/students/:student_grade_id', gradeCtrl.updateStudentScore);

// ============================================================
// Ekspor Router
// ============================================================
module.exports = router;