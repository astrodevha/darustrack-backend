/**
 * controllers/parentController.js
 * --------------------------------
 * Controller untuk semua operasi yang dapat dilakukan oleh orang tua.
 *
 * Asumsi penting:
 *  - Setiap orang tua hanya punya SATU anak (relasi Student.parent_id → User.id)
 *  - Orang tua hanya bisa melihat data di tahun ajaran yang aktif
 *  - Data nilai, kehadiran, dan evaluasi dibatasi pada semester tertentu (dari param)
 *
 * Semua endpoint bersifat READ-ONLY. Orang tua tidak bisa mengubah data apapun.
 *
 * @module controllers/parentController
 */

const { Op } = require('sequelize');
const {
  Student, StudentClass, Class, AcademicYear,
  Semester, Schedule, Subject, Attendance,
  Evaluation, StudentEvaluation, GradeCategory, GradeDetail, StudentGrade,
} = require('../models');

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Cari data siswa berdasarkan parent yang sedang login, beserta kelas aktifnya.
 *
 * @param {number}  parentId
 * @param {number}  [academicYearId] - Jika tidak diberikan, cari kelas di tahun ajaran aktif
 * @returns {Promise<{student, studentClass}|null>}
 */
async function getStudentWithActiveClass(parentId, academicYearId = null) {
  const student = await Student.findOne({ where: { parent_id: parentId } });
  if (!student) return null;

  const yearWhere = academicYearId
    ? { id: academicYearId }
    : { is_active: true };

  const activeYear = await AcademicYear.findOne({ where: yearWhere });
  if (!activeYear) return { student, studentClass: null };

  const studentClass = await StudentClass.findOne({
    where:   { student_id: student.id },
    include: {
      model: Class,
      as:    'class',
      where: { academic_year_id: activeYear.id },
    },
  });

  return { student, studentClass };
}

/**
 * Validasi semester dan pastikan berada di tahun ajaran aktif.
 * Mengembalikan null jika tidak valid.
 *
 * @param {number} semesterId
 * @returns {Promise<Semester|null>}
 */
async function getActiveSemester(semesterId) {
  return Semester.findOne({
    where:   { id: semesterId },
    include: {
      model: AcademicYear,
      as:    'academic_year',
      where: { is_active: true },
    },
  });
}

// ── Profile anak ──────────────────────────────────────────────────────────────

/**
 * GET /parents/student
 * Mengembalikan profil anak dan info kelas aktifnya (nama guru, nama kelas).
 */
exports.profile = async (req, res) => {
  try {
    const student = await Student.findOne({
      where:      { parent_id: req.user.id },
      attributes: ['name', 'nisn', 'birth_date'],
      include: {
        model:      StudentClass,
        as:         'student_class',
        attributes: ['id'],
        include: {
          model:      Class,
          as:         'class',
          attributes: ['name'],
          include: [
            {
              model:      AcademicYear,
              as:         'academic_year',
              where:      { is_active: true },
              required:   true,  // Filter hanya kelas di tahun ajaran aktif
              attributes: [],    // Tidak perlu tampil di response
            },
            {
              model:      require('../models').User,
              as:         'teacher',
              attributes: ['name'],
            },
          ],
        },
      },
    });

    if (!student || !student.student_class?.length) {
      return res.status(404).json({ message: 'Data anak tidak ditemukan atau belum memiliki kelas aktif' });
    }

    const activeStudentClasses = student.student_class.filter((sc) => sc.class?.name);
    if (!activeStudentClasses.length) {
      return res.status(404).json({ message: 'Anak tidak terdaftar di kelas tahun ajaran aktif' });
    }

    return res.json({
      name:          student.name,
      nisn:          student.nisn,
      birth_date:    student.birth_date,
      student_class: activeStudentClasses,
    });
  } catch (error) {
    console.error('[parent/profile] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Jadwal pelajaran ──────────────────────────────────────────────────────────

/**
 * GET /parents/schedule?day=Senin
 * Jadwal pelajaran anak berdasarkan hari (opsional).
 */
exports.schedule = async (req, res) => {
  try {
    const { day } = req.query;

    const student = await Student.findOne({
      where:   { parent_id: req.user.id },
      include: {
        model:      StudentClass,
        as:         'student_class',
        include: {
          model:      Class,
          as:         'class',
          include: {
            model:      AcademicYear,
            as:         'academic_year',
            where:      { is_active: true },
            attributes: ['id'],
          },
          attributes: ['id'],
        },
        attributes: ['class_id'],
      },
    });

    if (!student) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }

    // Temukan student_class yang berada di tahun ajaran aktif
    const activeStudentClass = student.student_class.find((sc) => sc.class?.academic_year);
    if (!activeStudentClass) {
      return res.status(404).json({ message: 'Anak tidak terdaftar di kelas tahun ajaran aktif' });
    }

    const whereCondition = { class_id: activeStudentClass.class.id };
    if (day) whereCondition.day = { [Op.eq]: day };

    const schedules = await Schedule.findAll({
      where:      whereCondition,
      include:    [{ model: Subject, as: 'subject', attributes: ['name'] }],
      attributes: ['day', 'start_time', 'end_time'],
      order:      [['day', 'ASC'], ['start_time', 'ASC']],
    });

    return res.json(schedules);
  } catch (error) {
    console.error('[parent/schedule] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Kehadiran ─────────────────────────────────────────────────────────────────

/**
 * GET /parents/attendances/:semesterId
 * Riwayat kehadiran anak per semester, urut dari terbaru.
 */
exports.attendances = async (req, res) => {
  try {
    const semester = await getActiveSemester(req.params.semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak berada di tahun ajaran aktif' });
    }

    const result = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!result?.student) {
      return res.status(404).json({ message: 'Data siswa tidak ditemukan' });
    }
    if (!result.studentClass) {
      return res.status(404).json({ message: 'Kelas siswa di tahun ajaran ini tidak ditemukan' });
    }

    const attendances = await Attendance.findAll({
      where: { student_class_id: result.studentClass.id, semester_id: semester.id },
      order: [['date', 'DESC']],
    });

    if (!attendances.length) {
      return res.status(404).json({ message: 'Belum ada data kehadiran di semester ini' });
    }

    return res.json(attendances.map((a) => ({
      date:   a.date,
      day:    new Date(a.date).toLocaleString('id-ID', { weekday: 'long' }),
      status: a.status,
    })));
  } catch (error) {
    console.error('[parent/attendances] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Evaluasi ──────────────────────────────────────────────────────────────────

/**
 * GET /parents/evaluations/:semesterId
 * Daftar judul evaluasi yang sudah dibuat wali kelas di semester ini.
 */
exports.evaluationTitles = async (req, res) => {
  try {
    const semester = await getActiveSemester(req.params.semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
    }

    const result = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!result?.student || !result.studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }

    const evaluations = await Evaluation.findAll({
      where: { class_id: result.studentClass.class_id, semester_id: semester.id },
      order: [['title', 'ASC']],
    });

    if (!evaluations.length) {
      return res.status(404).json({ message: 'Belum ada evaluasi di semester ini' });
    }

    return res.json(evaluations.map((e) => ({
      id:           e.id,
      title:        e.title,
      semester_id:  semester.id,
      semester_name: semester.name,
    })));
  } catch (error) {
    console.error('[parent/evaluationTitles] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/evaluations/:semesterId/:evaluationId
 * Detail deskripsi evaluasi untuk anak di semester ini.
 */
exports.evaluationDetail = async (req, res) => {
  try {
    const { semesterId, evaluationId } = req.params;

    const semester = await getActiveSemester(semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak valid atau tidak aktif' });
    }

    const result = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!result?.student || !result.studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }

    const studentEvaluation = await StudentEvaluation.findOne({
      where:   { student_class_id: result.studentClass.id, evaluation_id: evaluationId },
      include: {
        model:      Evaluation,
        as:         'evaluation',
        attributes: ['id', 'title'],
      },
    });

    if (!studentEvaluation) {
      return res.status(404).json({ message: 'Evaluasi tidak ditemukan untuk anak di semester ini' });
    }

    return res.json({
      id:          studentEvaluation.evaluation.id,
      title:       studentEvaluation.evaluation.title,
      description: studentEvaluation.description,
    });
  } catch (error) {
    console.error('[parent/evaluationDetail] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Nilai ─────────────────────────────────────────────────────────────────────

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

    const result = await getStudentWithActiveClass(req.user.id, semester.academic_year_id);
    if (!result?.student || !result.studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }

    const schedules = await Schedule.findAll({
      where:   { class_id: result.studentClass.class_id },
      include: { model: Subject, as: 'subject', attributes: ['id', 'name'] },
    });

    // De-duplikasi mata pelajaran
    const uniqueSubjects = {};
    for (const s of schedules) {
      if (s.subject && !uniqueSubjects[s.subject.id]) {
        uniqueSubjects[s.subject.id] = s.subject;
      }
    }

    return res.json(
      Object.values(uniqueSubjects).sort((a, b) => a.name.localeCompare(b.name)),
    );
  } catch (error) {
    console.error('[parent/subjects] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/grades/:semesterId/:subjectId/categories
 * Kategori penilaian (contoh: UH, UTS, UAS) per mapel dan semester.
 */
exports.categories = async (req, res) => {
  try {
    const { semesterId, subjectId } = req.params;

    const semester = await getActiveSemester(semesterId);
    if (!semester) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
    }

    const result = await getStudentWithActiveClass(req.user.id, semester.academic_year.id);
    if (!result?.student || !result.studentClass) {
      return res.status(404).json({ message: 'Data siswa atau kelas tidak ditemukan' });
    }

    const categories = await GradeCategory.findAll({
      where: {
        class_id:    result.studentClass.class_id,
        semester_id: semesterId,
        subject_id:  subjectId,
      },
      order:      [['name', 'ASC']],
      attributes: ['id', 'name'],
    });

    return res.json(categories);
  } catch (error) {
    console.error('[parent/categories] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

/**
 * GET /parents/grades/categories/:gradeCategoryId/details
 * Detail item penilaian beserta skor anak dalam kategori tersebut.
 */
exports.detailScores = async (req, res) => {
  try {
    const student = await Student.findOne({ where: { parent_id: req.user.id } });
    if (!student) return res.status(404).json({ message: 'Data siswa tidak ditemukan' });

    const category = await GradeCategory.findByPk(req.params.gradeCategoryId);
    if (!category) return res.status(404).json({ message: 'Kategori nilai tidak ditemukan' });

    // Cari student_class yang sesuai dengan kelas di kategori ini
    const studentClass = await StudentClass.findOne({
      where: { student_id: student.id, class_id: category.class_id },
    });
    if (!studentClass) {
      return res.status(404).json({ message: 'Anak tidak terdaftar di kelas ini' });
    }

    const details = await GradeDetail.findAll({
      where:   { grade_category_id: category.id },
      include: {
        model:    StudentGrade,
        as:       'student_grade',
        where:    { student_class_id: studentClass.id },
        required: false, // Tetap tampilkan item penilaian walau belum ada nilai
      },
    });

    const result = details
      .map((d) => ({
        title: d.name,
        date:  d.date,
        day:   new Date(d.date).toLocaleString('id-ID', { weekday: 'long' }),
        score: d.student_grade.length > 0 ? d.student_grade[0].score : null,
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)); // Terbaru duluan

    return res.json(result);
  } catch (error) {
    console.error('[parent/detailScores] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
