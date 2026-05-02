/**
 * routes/teachers.js
 * -------------------
 * Router untuk endpoint wali kelas (role: wali_kelas).
 *
 * File ini hanya mendefinisikan mapping URL → controller.
 * Semua business logic ada di controller yang terpisah:
 *  - teacherAttendanceController  : manajemen kehadiran
 *  - teacherEvaluationController  : manajemen evaluasi
 *  - teacherGradeController       : manajemen nilai
 *  - classController              : data kelas wali kelas
 *  - scheduleController           : jadwal kelas
 *
 * Semua route di sini sudah dilindungi oleh `accessValidation` dan
 * `roleValidation(['wali_kelas'])` yang dipasang di app.js.
 *
 * @module routes/teachers
 */

const express              = require('express');
const router               = express.Router();
const loadActiveSemester   = require('../middlewares/loadActiveSemester');

// ── Controller imports ────────────────────────────────────────────────────────
const attendanceCtrl  = require('../controllers/teacherAttendanceController');
const evaluationCtrl  = require('../controllers/teacherEvaluationController');
const gradeCtrl       = require('../controllers/teacherGradeController');
const classCtrl       = require('../controllers/classController');
const scheduleCtrl    = require('../controllers/scheduleController');

// ────────────────────────────────────────────────────────────────────────────
// Kelas & Jadwal
// ────────────────────────────────────────────────────────────────────────────

/** GET /teachers/my-class — Kelas yang dikelola wali kelas */
router.get('/my-class', classCtrl.getMyClass);

/** GET /teachers/schedules?day= — Jadwal kelas di tahun ajaran aktif */
router.get('/schedules', scheduleCtrl.getSchedules);

// ────────────────────────────────────────────────────────────────────────────
// Semester
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /teachers/semesters
 * Semester yang ada di tahun ajaran aktif (untuk wali kelas memilih semester saat input).
 */
const { AcademicYear, Semester } = require('../models');

router.get('/semesters', async (req, res) => {
  try {
    const activeYear = await AcademicYear.findOne({
      where:   { is_active: true },
      include: [{ model: Semester, as: 'semester' }],
    });

    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    return res.json({ semesters: activeYear.semester });
  } catch (error) {
    console.error('[teachers/semesters] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data semester', error: error.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Kehadiran
// (loadActiveSemester dijalankan dulu untuk semua endpoint attendance)
// ────────────────────────────────────────────────────────────────────────────

/** GET  /teachers/attendances/rekap — Daftar tanggal yang sudah ada kehadirannya */
router.get('/attendances/rekap', loadActiveSemester, attendanceCtrl.getAttendanceRekap);

/** GET  /teachers/attendances?date=YYYY-MM-DD — Data kehadiran per tanggal */
router.get('/attendances', loadActiveSemester, attendanceCtrl.getAttendances);

/** POST /teachers/attendances — Buat sesi kehadiran untuk tanggal baru */
router.post('/attendances', loadActiveSemester, attendanceCtrl.createAttendance);

/** PUT  /teachers/attendances?date=YYYY-MM-DD — Update status kehadiran */
router.put('/attendances', loadActiveSemester, attendanceCtrl.updateAttendances);

/** DELETE /teachers/attendances?date=YYYY-MM-DD — Hapus kehadiran satu tanggal */
router.delete('/attendances', loadActiveSemester, attendanceCtrl.deleteAttendance);

// ────────────────────────────────────────────────────────────────────────────
// Evaluasi
// ────────────────────────────────────────────────────────────────────────────

/** GET  /teachers/semesters/:semester_id/evaluations — List judul evaluasi */
router.get('/semesters/:semester_id/evaluations', evaluationCtrl.getEvaluations);

/** POST /teachers/semesters/:semester_id/evaluations — Tambah judul evaluasi */
router.post('/semesters/:semester_id/evaluations', evaluationCtrl.createEvaluation);

/** GET  /teachers/evaluations/:id — Detail evaluasi (deskripsi per siswa) */
router.get('/evaluations/:id', evaluationCtrl.getEvaluationDetail);

/** PUT  /teachers/evaluations/:id — Edit judul evaluasi */
router.put('/evaluations/:id', evaluationCtrl.updateEvaluation);

/** DELETE /teachers/evaluations/:id — Hapus evaluasi (dengan auth check) */
router.delete('/evaluations/:id', evaluationCtrl.deleteEvaluation);

/** PUT  /teachers/student-evaluations/:id — Edit deskripsi evaluasi satu siswa */
router.put('/student-evaluations/:id', evaluationCtrl.updateStudentEvaluation);

// ────────────────────────────────────────────────────────────────────────────
// Nilai (Grades)
// PERHATIAN: Urutan route penting! Route yang lebih spesifik (string literal)
// harus didaftarkan SEBELUM route dengan parameter dinamis (:param).
// ────────────────────────────────────────────────────────────────────────────

/** GET /teachers/grades/subjects — Daftar mapel di kelas */
router.get('/grades/subjects', gradeCtrl.getSubjects);

/** GET    /teachers/grades/categories/:category_id/details — List item penilaian */
router.get('/grades/categories/:category_id/details', gradeCtrl.getDetails);

/** POST   /teachers/grades/categories/:category_id/details — Tambah item penilaian */
router.post('/grades/categories/:category_id/details', gradeCtrl.createDetail);

/** PUT    /teachers/grades/categories/:category_id — Edit kategori */
router.put('/grades/categories/:category_id', gradeCtrl.updateCategory);

/** DELETE /teachers/grades/categories/:category_id — Hapus kategori */
router.delete('/grades/categories/:category_id', gradeCtrl.deleteCategory);

/** GET    /teachers/grades/details/:detail_id/students — Nilai siswa per item */
router.get('/grades/details/:detail_id/students', gradeCtrl.getStudentGrades);

/** PUT    /teachers/grades/details/:detail_id — Edit item penilaian */
router.put('/grades/details/:detail_id', gradeCtrl.updateDetail);

/** DELETE /teachers/grades/details/:detail_id — Hapus item penilaian */
router.delete('/grades/details/:detail_id', gradeCtrl.deleteDetail);

/** GET  /teachers/grades/:subject_id/:semester_id/categories — List kategori */
router.get('/grades/:subject_id/:semester_id/categories', gradeCtrl.getCategories);

/** POST /teachers/grades/:subject_id/:semester_id/categories — Buat kategori */
router.post('/grades/:subject_id/:semester_id/categories', gradeCtrl.createCategory);

/** PATCH /teachers/grades/students/:student_grade_id — Update skor satu siswa */
router.patch('/grades/students/:student_grade_id', gradeCtrl.updateStudentScore);

module.exports = router;
