/**
 * controllers/parentController.js
 *
 * Controller untuk semua operasi yang dapat dilakukan oleh orang tua.
 * Asumsi: Satu user orang_tua hanya memiliki SATU anak (relasi 1:1 via Student.parent_id).
 * Semua data ditampilkan berdasarkan tahun ajaran AKTIF.
 * Semua endpoint bersifat READ-ONLY — orang tua tidak dapat mengubah data.
 *
 * ============================================================
 * ENDPOINTS (semua GET)
 * ============================================================
 * /parents/student                       → profil anak
 * /parents/schedule?day=Senin            → jadwal pelajaran
 * /parents/attendances/:semesterId       → kehadiran per semester
 * /parents/evaluations/:semesterId       → daftar judul evaluasi
 * /parents/evaluations/:semesterId/:evaluationId → detail evaluasi
 * /parents/grades/:semesterId/subjects   → daftar mata pelajaran
 * /parents/grades/:semesterId/:subjectId/categories → kategori penilaian
 * /parents/grades/categories/:gradeCategoryId/details → detail nilai per kategori
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Semua helper yang reusable dipisahkan di bawah.
 * - Fungsi getStudentWithActiveClass digunakan di banyak endpoint,
 *   modifikasi di sini akan berdampak global.
 * - Pastikan timezone WIB digunakan untuk semua konversi tanggal ke nama hari.
 * - Jangan hapus validasi IDOR (H-03) tanpa memahami implikasinya.
 *
 * @module parentController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op } = require('sequelize');
const {
  Student,
  StudentClass,
  Class,
  AcademicYear,
  Semester,
  Schedule,
  Subject,
  Attendance,
  Evaluation,
  StudentEvaluation,
  GradeCategory,
  GradeDetail,
  StudentGrade,
} = require('../models');

// ============================================================
// Konstanta
// ============================================================
/** Timezone WIB untuk konversi nama hari (Fix L-05) */
const TIMEZONE_WIB = 'Asia/Jakarta';

// ============================================================
// Helper Functions
// ============================================================

/**
 * Konversi string tanggal ke nama hari dalam Bahasa Indonesia (WIB-aware).
 * [Fix L-05] Menambahkan timeZone: 'Asia/Jakarta' agar nama hari selalu tepat.
 *
 * @param {string} dateString - Tanggal format 'YYYY-MM-DD'
 * @returns {string} Nama hari (Senin, Selasa, ...)
 */
function dateToHariIndonesia(dateString) {
  // Tambahkan T00:00:00 agar parsing sebagai waktu lokal
  return new Date(`${dateString}T00:00:00`).toLocaleString('id-ID', {
    weekday: 'long',
    timeZone: TIMEZONE_WIB,
  });
}

/**
 * Mendapatkan siswa dan kelas aktif berdasarkan parentId.
 * Digunakan di banyak endpoint yang membutuhkan konteks anak.
 *
 * @param {string} parentId - ID user orang tua (req.user.id)
 * @param {number|null} academicYearId - Filter tahun ajaran tertentu, atau null untuk aktif
 * @returns {Promise<{student: Student|null, studentClass: StudentClass|null}>}
 */
async function getStudentWithActiveClass(parentId, academicYearId = null) {
  const student = await Student.findOne({ where: { parent_id: parentId } });
  if (!student) return { student: null, studentClass: null };

  const yearCondition = academicYearId ? { id: academicYearId } : { is_active: true };
  const activeYear = await AcademicYear.findOne({ where: yearCondition });
  if (!activeYear) return { student, studentClass: null };

  const studentClass = await StudentClass.findOne({
    where: { student_id: student.id },
    include: {
      model: Class,
      as: 'class',
      where: { academic_year_id: activeYear.id },
    },
  });
  return { student, studentClass };
}

/**
 * Mendapatkan semester aktif (is_active=true) berdasarkan ID semester.
 * Memastikan semester berada di tahun ajaran aktif via eager loading.
 *
 * @param {string} semesterId - ID semester
 * @returns {Promise<Semester|null>} Instance Semester atau null
 */
async function getActiveSemester(semesterId) {
  return Semester.findOne({
    where: { id: semesterId },
    include: {
      model: AcademicYear,
      as: 'academic_year',
      where: { is_active: true },
    },
  });
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /parents/student
 * Profil anak beserta kelas aktif.
 */
exports.profile = async (req, res) => {
  try {
    const student = await Student.findOne({
      where: { parent_id: req.user.id },
      attributes: ['name', 'nisn', 'birth_date'],
      include: {
        model: StudentClass,
        as: 'student_class',
        attributes: ['id'],
        include: {
          model: Class,
          as: 'class',
          attributes: ['name'],
          include: [
            { model: AcademicYear, as: 'academic_year', where: { is_active: true }, required: true, attributes: [] },
            { model: require('../models').User, as: 'teacher', attributes: ['name'] },
          ],
        },
      },
    });

    if (!student || !student.student_class?.length) {
      return res.status(404).json({ message: 'Data anak tidak ditemukan atau belum memiliki kelas aktif' });
    }
    const activeStudentClasses = student.student_class.filter(sc => sc.class?.name);
    if (!activeStudentClasses.length) {
      return res.status(404).json({ message: 'Anak tidak terdaftar di kelas tahun ajaran aktif' });
    }
    return res.json({
      name: student.name,
      nisn: student.nisn,
      birth_date: student.birth_date,
      student_class: activeStudentClasses,
    });
  } catch (error) {
    console.error('[parent/profile] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/schedule?day=Senin
 * Jadwal pelajaran anak, bisa difilter per hari.
 */
exports.schedule = async (req, res) => {
  try {
    const { day } = req.query;
    const student = await Student.findOne({
      where: { parent_id: req.user.id },
      include: {
        model: StudentClass,
        as: 'student_class',
        include: {
          model: Class,
          as: 'class',
          include: { model: AcademicYear, as: 'academic_year', where: { is_active: true }, attributes: ['id'] },
          attributes: ['id'],
        },
        attributes: ['class_id'],
      },
    });
    if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    const activeStudentClass = student.student_class.find(sc => sc.class?.academic_year);
    if (!activeStudentClass) {
      return res.status(404).json({ message: 'Anak tidak terdaftar di kelas tahun ajaran aktif' });
    }
    const whereCondition = { class_id: activeStudentClass.class.id };
    if (day) whereCondition.day = { [Op.eq]: day };
    const schedules = await Schedule.findAll({
      where: whereCondition,
      include: [{ model: Subject, as: 'subject', attributes: ['name'] }],
      attributes: ['day', 'start_time', 'end_time'],
      order: [['day', 'ASC'], ['start_time', 'ASC']],
    });
    return res.json(schedules);
  } catch (error) {
    console.error('[parent/schedule] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/attendances/:semesterId
 * Riwayat kehadiran anak per semester, diurutkan dari terbaru.
 */
exports.attendances = async (req, res) => {
  try {
    const semester = await getActiveSemester(req.params.semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak berada di tahun ajaran aktif' });
    }
    const { student, studentClass } = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    if (!studentClass) {
      return res.status(404).json({ message: 'Kelas siswa di tahun ajaran ini tidak ditemukan' });
    }
    const attendances = await Attendance.findAll({
      where: { student_class_id: studentClass.id, semester_id: semester.id },
      order: [['date', 'DESC']],
    });
    if (!attendances.length) {
      return res.status(404).json({ message: 'Belum ada data kehadiran di semester ini' });
    }
    return res.json(attendances.map(a => ({
      date: a.date,
      day: dateToHariIndonesia(a.date),
      status: a.status,
    })));
  } catch (error) {
    console.error('[parent/attendances] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/evaluations/:semesterId
 * Daftar judul evaluasi yang tersedia untuk anak di semester ini.
 */
exports.evaluationTitles = async (req, res) => {
  try {
    const semester = await getActiveSemester(req.params.semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
    }
    const { student, studentClass } = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!student || !studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }
    const evaluations = await Evaluation.findAll({
      where: { class_id: studentClass.class_id, semester_id: semester.id },
      order: [['title', 'ASC']],
    });
    if (!evaluations.length) {
      return res.status(404).json({ message: 'Belum ada evaluasi di semester ini' });
    }
    return res.json(evaluations.map(e => ({
      id: e.id,
      title: e.title,
      semester_id: semester.id,
      semester_name: semester.name,
    })));
  } catch (error) {
    console.error('[parent/evaluationTitles] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/evaluations/:semesterId/:evaluationId
 * Detail deskripsi evaluasi anak.
 */
exports.evaluationDetail = async (req, res) => {
  try {
    const { semesterId, evaluationId } = req.params;
    const semester = await getActiveSemester(semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak valid atau tidak aktif' });
    }
    const { student, studentClass } = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!student || !studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }
    const studentEvaluation = await StudentEvaluation.findOne({
      where: { student_class_id: studentClass.id, evaluation_id: evaluationId },
      include: { model: Evaluation, as: 'evaluation', attributes: ['id', 'title'] },
    });
    if (!studentEvaluation) {
      return res.status(404).json({ message: 'Evaluasi tidak ditemukan untuk anak di semester ini' });
    }
    return res.json({
      id: studentEvaluation.evaluation.id,
      title: studentEvaluation.evaluation.title,
      description: studentEvaluation.description,
    });
  } catch (error) {
    console.error('[parent/evaluationDetail] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/grades/:semesterId/subjects
 * Daftar mata pelajaran unik berdasarkan jadwal kelas anak.
 */
exports.subjects = async (req, res) => {
  try {
    const semester = await getActiveSemester(req.params.semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
    }
    const { student, studentClass } = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!student || !studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }
    const schedules = await Schedule.findAll({
      where: { class_id: studentClass.class_id },
      include: { model: Subject, as: 'subject', attributes: ['id', 'name'] },
    });
    const uniqueSubjects = {};
    for (const s of schedules) {
      if (s.subject && !uniqueSubjects[s.subject.id]) {
        uniqueSubjects[s.subject.id] = s.subject;
      }
    }
    return res.json(Object.values(uniqueSubjects).sort((a, b) => a.name.localeCompare(b.name)));
  } catch (error) {
    console.error('[parent/subjects] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/grades/:semesterId/:subjectId/categories
 * Kategori penilaian per mapel dan semester.
 * [Fix H-05] Gunakan FK langsung semester.academic_year_id.
 */
exports.categories = async (req, res) => {
  try {
    const { semesterId, subjectId } = req.params;
    const semester = await getActiveSemester(semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
    }
    // [H-05] Gunakan academic_year_id langsung (bukan semester.academic_year.id)
    const { student, studentClass } = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!student || !studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }
    const categories = await GradeCategory.findAll({
      where: {
        class_id: studentClass.class_id,
        semester_id: semesterId,
        subject_id: subjectId,
      },
      order: [['name', 'ASC']],
      attributes: ['id', 'name'],
    });
    return res.json(categories);
  } catch (error) {
    console.error('[parent/categories] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/grades/categories/:gradeCategoryId/details
 * Detail item penilaian dan skor anak dalam kategori tersebut.
 * [Fix H-03] Validasi IDOR dengan memastikan kategori berasal dari tahun ajaran aktif.
 */
exports.detailScores = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    if (!student) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // [H-03] GradeCategory wajib memiliki relasi ke Class → AcademicYear dengan is_active=true
    const category = await GradeCategory.findOne({
      where: { id: req.params.gradeCategoryId },
      include: {
        model: Class,
        as: 'class',
        required: true,
        include: {
          model: AcademicYear,
          as: 'academic_year',
          required: true,
          where: { is_active: true },
        },
      },
    });
    if (!category) {
      // Tidak ditemukan karena kategori tidak ada ATAU tahun ajaran tidak aktif
      return res.status(404).json({ message: 'Kategori nilai tidak ditemukan' });
    }

    // Pastikan anak terdaftar di kelas tersebut
    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id, class_id: category.class_id },
    });
    if (!studentClass) {
      return res.status(403).json({ message: 'Akses ditolak. Anak Anda tidak terdaftar di kelas ini.' });
    }

    const details = await GradeDetail.findAll({
      where: { grade_category_id: category.id },
      include: {
        model: StudentGrade,
        as: 'student_grade',
        where: { student_class_id: studentClass.id },
        required: false, // LEFT JOIN agar item tanpa nilai tetap muncul
      },
    });
    const result = details.map(d => ({
      title: d.name,
      date: d.date,
      day: d.date ? dateToHariIndonesia(d.date) : null,
      score: d.student_grade.length > 0 ? d.student_grade[0].score : null,
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.json(result);
  } catch (error) {
    console.error('[parent/detailScores] Error:', error);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};