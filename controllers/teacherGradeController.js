/**
 * controllers/teacherGradeController.js
 * ----------------------------------------
 * Controller untuk manajemen nilai (grade) siswa oleh wali kelas.
 *
 * Hierarki data nilai:
 *   Subject (Mata Pelajaran)
 *     └─ GradeCategory (Kategori, contoh: "Ulangan Harian", "UTS")
 *         └─ GradeDetail (Item penilaian, contoh: "UH Bab 1", tanggal)
 *             └─ StudentGrade (Nilai per siswa, field: score)
 *
 * Endpoints yang dilayani:
 *  - GET    /teachers/grades/subjects                          → Daftar mapel di kelas
 *  - GET    /teachers/grades/:subject_id/:semester_id/categories → List kategori
 *  - POST   /teachers/grades/:subject_id/:semester_id/categories → Buat kategori
 *  - PUT    /teachers/grades/categories/:category_id           → Edit kategori
 *  - DELETE /teachers/grades/categories/:category_id           → Hapus kategori + detailnya
 *  - GET    /teachers/grades/categories/:category_id/details   → List item penilaian
 *  - POST   /teachers/grades/categories/:category_id/details   → Tambah item penilaian
 *  - PUT    /teachers/grades/details/:detail_id                → Edit item penilaian
 *  - DELETE /teachers/grades/details/:detail_id                → Hapus item + nilai siswa
 *  - GET    /teachers/grades/details/:detail_id/students       → Nilai siswa per item
 *  - PATCH  /teachers/grades/students/:student_grade_id        → Update skor satu siswa
 *
 * @module controllers/teacherGradeController
 */

const { Op } = require('sequelize');
const {
  Class, AcademicYear, Schedule, Subject,
  StudentClass, Student, GradeCategory, GradeDetail, StudentGrade,
} = require('../models');

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Cari kelas yang diajar wali kelas pada tahun ajaran aktif.
 *
 * @param {number} teacherId
 * @returns {Promise<Class|null>}
 */
async function getActiveTeacherClass(teacherId) {
  const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
  if (!activeYear) return null;

  return Class.findOne({
    where:      { teacher_id: teacherId, academic_year_id: activeYear.id },
    attributes: ['id'],
  });
}

/**
 * Cari kategori dan verifikasi bahwa itu milik kelas wali kelas yang login.
 *
 * @param {number} categoryId
 * @param {number} teacherId
 * @returns {Promise<{category, teacherClass}|{error: string, status: number}>}
 */
async function resolveCategoryOwnership(categoryId, teacherId) {
  const category    = await GradeCategory.findByPk(categoryId);
  if (!category)    return { error: 'Kategori tidak ditemukan', status: 404 };

  const teacherClass = await getActiveTeacherClass(teacherId);
  if (!teacherClass || teacherClass.id !== category.class_id) {
    return { error: 'Akses ditolak', status: 403 };
  }

  return { category, teacherClass };
}

/**
 * Cari grade detail dan verifikasi kepemilikan kelas.
 *
 * @param {number} detailId
 * @param {number} teacherId
 * @returns {Promise<{gradeDetail, teacherClass}|{error: string, status: number}>}
 */
async function resolveDetailOwnership(detailId, teacherId) {
  const gradeDetail = await GradeDetail.findOne({
    where:   { id: detailId },
    include: { model: GradeCategory, as: 'grade_category' },
  });
  if (!gradeDetail) return { error: 'Detail penilaian tidak ditemukan', status: 404 };

  const teacherClass = await getActiveTeacherClass(teacherId);
  if (!teacherClass || gradeDetail.grade_category.class_id !== teacherClass.id) {
    return { error: 'Akses ditolak', status: 403 };
  }

  return { gradeDetail, teacherClass };
}

// ── Daftar mata pelajaran ─────────────────────────────────────────────────────

/**
 * GET /teachers/grades/subjects
 * Daftar mata pelajaran unik yang dijadwalkan di kelas wali kelas.
 */
exports.getSubjects = async (req, res) => {
  try {
    const teacherClass = await getActiveTeacherClass(req.user.id);
    if (!teacherClass) {
      return res.status(404).json({ message: 'Tidak ada kelas aktif yang Anda ampu' });
    }

    const schedules = await Schedule.findAll({
      where:   { class_id: teacherClass.id },
      include: { model: Subject, as: 'subject', attributes: ['id', 'name'] },
      attributes: ['subject_id'],
      raw:     true,
      nest:    true,
    });

    // De-duplikasi mata pelajaran
    const seen   = new Set();
    const result = schedules
      .filter((s) => s.subject?.id && !seen.has(s.subject.id) && seen.add(s.subject.id))
      .map((s) => ({ subject_id: s.subject.id, subject_name: s.subject.name }))
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

    return res.json(result);
  } catch (error) {
    console.error('[grade/subjects] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar mata pelajaran', error: error.message });
  }
};

// ── Kategori penilaian ────────────────────────────────────────────────────────

/**
 * GET /teachers/grades/:subject_id/:semester_id/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const teacherClass = await getActiveTeacherClass(req.user.id);
    if (!teacherClass) return res.status(403).json({ message: 'Anda tidak memiliki kelas aktif' });

    const categories = await GradeCategory.findAll({
      where: {
        class_id:    teacherClass.id,
        subject_id:  req.params.subject_id,
        semester_id: req.params.semester_id,
      },
      attributes: ['id', 'name'],
    });

    return res.json(categories);
  } catch (error) {
    console.error('[grade/categories/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil kategori', error: error.message });
  }
};

/**
 * POST /teachers/grades/:subject_id/:semester_id/categories
 * Body: { name: string }
 */
exports.createCategory = async (req, res) => {
  try {
    const { subject_id, semester_id } = req.params;
    const { name }                    = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Nama kategori wajib diisi' });
    }

    const teacherClass = await getActiveTeacherClass(req.user.id);
    if (!teacherClass) return res.status(403).json({ message: 'Anda tidak memiliki kelas aktif' });

    const duplicate = await GradeCategory.findOne({
      where: { subject_id, class_id: teacherClass.id, semester_id, name: name.trim() },
    });
    if (duplicate) return res.status(400).json({ message: 'Kategori dengan nama ini sudah ada' });

    const newCategory = await GradeCategory.create({
      subject_id, class_id: teacherClass.id, semester_id, name: name.trim(),
    });

    return res.status(201).json(newCategory);
  } catch (error) {
    console.error('[grade/categories/create] Error:', error);
    return res.status(500).json({ message: 'Gagal membuat kategori', error: error.message });
  }
};

/**
 * PUT /teachers/grades/categories/:category_id
 * Body: { name: string }
 */
exports.updateCategory = async (req, res) => {
  try {
    const { name }    = req.body;
    const resolved    = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const { category, teacherClass } = resolved;

    const duplicate = await GradeCategory.findOne({
      where: {
        name,
        class_id:   teacherClass.id,
        subject_id: category.subject_id,
        id:         { [Op.ne]: category.id },
      },
    });
    if (duplicate) return res.status(400).json({ message: 'Nama kategori sudah digunakan' });

    await category.update({ name });
    return res.json({ message: 'Kategori berhasil diperbarui' });
  } catch (error) {
    console.error('[grade/categories/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui kategori', error: error.message });
  }
};

/**
 * DELETE /teachers/grades/categories/:category_id
 * Menghapus kategori beserta semua GradeDetail dan StudentGrade di dalamnya.
 */
exports.deleteCategory = async (req, res) => {
  try {
    const resolved = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const { category } = resolved;

    // Hapus GradeDetail (dan StudentGrade lewat CASCADE atau secara eksplisit)
    await GradeDetail.destroy({ where: { grade_category_id: category.id } });
    await category.destroy();

    return res.json({ message: 'Kategori berhasil dihapus' });
  } catch (error) {
    console.error('[grade/categories/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus kategori', error: error.message });
  }
};

// ── Detail penilaian (item dalam kategori) ────────────────────────────────────

/**
 * GET /teachers/grades/categories/:category_id/details
 */
exports.getDetails = async (req, res) => {
  try {
    const resolved = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const details = await GradeDetail.findAll({
      where: { grade_category_id: req.params.category_id },
      order: [['name', 'ASC']],
    });

    return res.json(details);
  } catch (error) {
    console.error('[grade/details/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil detail penilaian', error: error.message });
  }
};

/**
 * POST /teachers/grades/categories/:category_id/details
 * Body: { name: string, date: 'YYYY-MM-DD' }
 *
 * Otomatis membuat StudentGrade (score = null) untuk setiap siswa di kelas.
 */
exports.createDetail = async (req, res) => {
  try {
    const { name, date } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Nama detail penilaian wajib diisi' });
    }

    const resolved = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const { category, teacherClass } = resolved;

    const duplicate = await GradeDetail.findOne({
      where: { grade_category_id: category.id, name: name.trim() },
    });
    if (duplicate) return res.status(400).json({ message: 'Detail dengan nama ini sudah ada' });

    const newDetail = await GradeDetail.create({
      grade_category_id: category.id,
      name:              name.trim(),
      date,
    });

    // Buat StudentGrade (score null) untuk semua siswa di kelas
    const studentClasses = await StudentClass.findAll({
      where:      { class_id: teacherClass.id },
      attributes: ['id'],
    });
    const gradeEntries = studentClasses.map((sc) => ({
      student_class_id: sc.id,
      grade_detail_id:  newDetail.id,
      score:            null,
    }));
    await StudentGrade.bulkCreate(gradeEntries);

    return res.status(201).json({ message: 'Item penilaian berhasil ditambahkan', detail: newDetail });
  } catch (error) {
    console.error('[grade/details/create] Error:', error);
    return res.status(500).json({ message: 'Gagal membuat item penilaian', error: error.message });
  }
};

/**
 * PUT /teachers/grades/details/:detail_id
 * Body: { name?: string, date?: string }
 */
exports.updateDetail = async (req, res) => {
  try {
    const { name, date } = req.body;
    const resolved       = await resolveDetailOwnership(req.params.detail_id, req.user.id);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const { gradeDetail } = resolved;

    // Cek duplikat nama jika nama diubah
    if (name && name !== gradeDetail.name) {
      const duplicate = await GradeDetail.findOne({
        where: {
          grade_category_id: gradeDetail.grade_category_id,
          name,
          id: { [Op.ne]: gradeDetail.id },
        },
      });
      if (duplicate) return res.status(400).json({ message: 'Nama item penilaian sudah ada' });
    }

    await gradeDetail.update({
      name: name ?? gradeDetail.name,
      date: date ?? gradeDetail.date,
    });

    return res.json({ message: 'Item penilaian berhasil diperbarui' });
  } catch (error) {
    console.error('[grade/details/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui item penilaian', error: error.message });
  }
};

/**
 * DELETE /teachers/grades/details/:detail_id
 * Menghapus item penilaian beserta semua StudentGrade-nya.
 */
exports.deleteDetail = async (req, res) => {
  try {
    const resolved = await resolveDetailOwnership(req.params.detail_id, req.user.id);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const { gradeDetail } = resolved;
    await StudentGrade.destroy({ where: { grade_detail_id: gradeDetail.id } });
    await gradeDetail.destroy();

    return res.json({ message: 'Item penilaian berhasil dihapus' });
  } catch (error) {
    console.error('[grade/details/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus item penilaian', error: error.message });
  }
};

// ── Nilai siswa ───────────────────────────────────────────────────────────────

/**
 * GET /teachers/grades/details/:detail_id/students
 * Semua siswa beserta skornya untuk satu item penilaian, urut berdasarkan nama.
 */
exports.getStudentGrades = async (req, res) => {
  try {
    const resolved = await resolveDetailOwnership(req.params.detail_id, req.user.id);
    if (resolved.error) return res.status(resolved.status).json({ message: resolved.error });

    const studentGrades = await StudentGrade.findAll({
      where:   { grade_detail_id: req.params.detail_id },
      include: [{
        model: StudentClass,
        as:    'student_class',
        include: {
          model:      Student,
          as:         'student',
          attributes: ['id', 'name'],
        },
      }],
      order: [[{ model: StudentClass, as: 'student_class' }, { model: Student, as: 'student' }, 'name', 'ASC']],
    });

    const result = studentGrades.map((entry) => ({
      student_grade_id: entry.id,
      student_id:       entry.student_class?.student?.id   ?? null,
      student_name:     entry.student_class?.student?.name ?? null,
      score:            entry.score,
    }));

    return res.json(result);
  } catch (error) {
    console.error('[grade/students/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil nilai siswa', error: error.message });
  }
};

/**
 * PATCH /teachers/grades/students/:student_grade_id
 * Body: { score: number }
 * Update skor satu siswa untuk satu item penilaian.
 */
exports.updateStudentScore = async (req, res) => {
  try {
    const { score } = req.body;

    // Validasi score: harus angka dan dalam range yang masuk akal
    if (score === undefined || score === null || isNaN(Number(score))) {
      return res.status(400).json({ message: 'Skor tidak valid' });
    }
    if (Number(score) < 0 || Number(score) > 100) {
      return res.status(400).json({ message: 'Skor harus berada di antara 0 dan 100' });
    }

    // Ambil StudentGrade beserta hierarki kelas untuk otorisasi
    const studentGrade = await StudentGrade.findOne({
      where:   { id: req.params.student_grade_id },
      include: [{
        model: GradeDetail,
        as:    'grade_detail',
        include: {
          model: GradeCategory,
          as:    'grade_category',
          include: { model: Class, as: 'class' },
        },
      }],
    });

    if (!studentGrade) {
      return res.status(404).json({ message: 'Data nilai siswa tidak ditemukan' });
    }

    // Verifikasi bahwa nilai ini milik kelas yang diampu wali kelas yang login
    const teacherClass = await Class.findOne({ where: { teacher_id: req.user.id } });
    if (!teacherClass || studentGrade.grade_detail.grade_category.class.id !== teacherClass.id) {
      return res.status(403).json({ message: 'Akses ditolak' });
    }

    studentGrade.score = Number(score);
    await studentGrade.save();

    return res.json({ message: 'Skor berhasil diperbarui' });
  } catch (error) {
    console.error('[grade/students/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui skor', error: error.message });
  }
};
