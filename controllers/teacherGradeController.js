/**
 * controllers/teacherGradeController.js
 *
 * Controller untuk manajemen nilai (grade) siswa oleh wali kelas.
 * Hierarki data nilai:
 *   Subject (Mata Pelajaran)
 *     └─ GradeCategory (Kategori, contoh: "Ulangan Harian", "UTS")
 *         └─ GradeDetail (Item penilaian, contoh: "UH Bab 1", tanggal)
 *             └─ StudentGrade (Nilai per siswa — field: score 0–100)
 *
 * Aturan otorisasi yang diterapkan:
 *   - Setiap wali kelas HANYA bisa mengakses/memodifikasi data kelas yang ia ampu
 *   - Kelas yang diampu HARUS berasal dari tahun ajaran yang AKTIF
 *   - Tidak ada akses lintas tahun ajaran
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /teachers/grades/subjects
 * GET    /teachers/grades/:subject_id/:semester_id/categories
 * POST   /teachers/grades/:subject_id/:semester_id/categories
 * PUT    /teachers/grades/categories/:category_id
 * DELETE /teachers/grades/categories/:category_id
 * GET    /teachers/grades/categories/:category_id/details
 * POST   /teachers/grades/categories/:category_id/details
 * PUT    /teachers/grades/details/:detail_id
 * DELETE /teachers/grades/details/:detail_id
 * GET    /teachers/grades/details/:detail_id/students
 * PATCH  /teachers/grades/students/:student_grade_id
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Helper getActiveTeacherClass WAJIB digunakan untuk semua verifikasi kepemilikan kelas.
 * - Jangan pernah menggunakan Class.findOne({ where: { teacher_id } }) tanpa filter tahun ajaran.
 * - Semua operasi yang memerlukan verifikasi kategori/detail menggunakan resolveCategoryOwnership
 *   dan resolveDetailOwnership yang sudah terpusat.
 *
 * @module teacherGradeController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op } = require('sequelize');
const {
  Class,
  AcademicYear,
  Schedule,
  Subject,
  StudentClass,
  Student,
  GradeCategory,
  GradeDetail,
  StudentGrade,
  Semester,
} = require('../models');

// ============================================================
// Constants & Helpers
// ============================================================

/** Regex validasi tanggal YYYY-MM-DD */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Memvalidasi format tanggal.
 * @param {string} date - Tanggal yang akan divalidasi
 * @returns {boolean}
 */
function isValidDate(date) {
  if (!date) return true; // null/undefined dianggap valid (opsional)
  return DATE_REGEX.test(date) && !isNaN(Date.parse(date));
}

/**
 * Mendapatkan kelas aktif yang diampu oleh wali kelas yang sedang login.
 * Filter berdasarkan teacher_id DAN academic_year_id (tahun ajaran aktif).
 *
 * [Fix H-04] Pengganti Class.findOne tanpa filter tahun ajaran.
 *
 * @param {string} teacherId - ID user wali kelas (req.user.id)
 * @returns {Promise<Class|null>}
 */
async function getActiveTeacherClass(teacherId) {
  const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
  if (!activeYear) return null;
  return Class.findOne({
    where: { teacher_id: teacherId, academic_year_id: activeYear.id },
    attributes: ['id'],
  });
}

/**
 * Resolve kategori penilaian dan verifikasi kepemilikan oleh wali kelas.
 * @param {string} categoryId - ID GradeCategory
 * @param {string} teacherId - ID wali kelas
 * @returns {Promise<{category: GradeCategory, teacherClass: Class}|{error: string, status: number}>}
 */
async function resolveCategoryOwnership(categoryId, teacherId) {
  const category = await GradeCategory.findByPk(categoryId);
  if (!category) return { error: 'Kategori tidak ditemukan', status: 404 };
  const teacherClass = await getActiveTeacherClass(teacherId);
  if (!teacherClass || teacherClass.id !== category.class_id) {
    return { error: 'Akses ditolak. Kategori ini bukan milik kelas Anda.', status: 403 };
  }
  return { category, teacherClass };
}

/**
 * Resolve item penilaian (GradeDetail) dan verifikasi kepemilikan.
 * @param {string} detailId - ID GradeDetail
 * @param {string} teacherId - ID wali kelas
 * @returns {Promise<{gradeDetail: GradeDetail, teacherClass: Class}|{error: string, status: number}>}
 */
async function resolveDetailOwnership(detailId, teacherId) {
  const gradeDetail = await GradeDetail.findOne({
    where: { id: detailId },
    include: { model: GradeCategory, as: 'grade_category', attributes: ['id', 'class_id'] },
  });
  if (!gradeDetail) return { error: 'Item penilaian tidak ditemukan', status: 404 };
  const teacherClass = await getActiveTeacherClass(teacherId);
  if (!teacherClass || gradeDetail.grade_category.class_id !== teacherClass.id) {
    return { error: 'Akses ditolak. Item penilaian ini bukan milik kelas Anda.', status: 403 };
  }
  return { gradeDetail, teacherClass };
}

// ============================================================
// 1. Mata Pelajaran
// ============================================================

/**
 * GET /teachers/grades/subjects
 * Daftar mata pelajaran unik yang dijadwalkan di kelas aktif wali kelas.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getSubjects = async (req, res) => {
  try {
    const teacherClass = await getActiveTeacherClass(req.user.id);
    if (!teacherClass) {
      return res.status(404).json({ message: 'Tidak ada kelas aktif yang Anda ampu' });
    }
    const schedules = await Schedule.findAll({
      where: { class_id: teacherClass.id },
      include: { model: Subject, as: 'subject', attributes: ['id', 'name'] },
      attributes: ['subject_id'],
      raw: true,
      nest: true,
    });
    const seen = new Set();
    const result = schedules
      .filter(s => s.subject?.id && !seen.has(s.subject.id) && seen.add(s.subject.id))
      .map(s => ({ subject_id: s.subject.id, subject_name: s.subject.name }))
      .sort((a, b) => a.subject_name.localeCompare(b.subject_name));
    return res.json(result);
  } catch (error) {
    console.error('[grade/subjects] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar mata pelajaran' });
  }
};

// ============================================================
// 2. Kategori Penilaian (GradeCategory)
// ============================================================

/**
 * GET /teachers/grades/:subject_id/:semester_id/categories
 * Daftar kategori penilaian untuk mapel dan semester tertentu di kelas aktif.
 *
 * @param {import('express').Request} req - Params: { subject_id, semester_id }
 * @param {import('express').Response} res
 */
exports.getCategories = async (req, res) => {
  try {
    const { subject_id, semester_id } = req.params;
    const semester = await Semester.findByPk(semester_id);
    if (!semester) {
      return res.status(400).json({ message: `Semester dengan ID ${semester_id} tidak ditemukan.` });
    }
    const subject = await Subject.findByPk(subject_id);
    if (!subject) {
      return res.status(400).json({ message: `Mata pelajaran dengan ID ${subject_id} tidak ditemukan.` });
    }
    const teacherClass = await getActiveTeacherClass(req.user.id);
    if (!teacherClass) {
      return res.status(403).json({ message: 'Anda tidak memiliki kelas aktif' });
    }
    const scheduleExists = await Schedule.findOne({
      where: { class_id: teacherClass.id, subject_id },
    });
    if (!scheduleExists) {
      return res.status(400).json({ message: `Mata pelajaran ${subject.name} tidak dijadwalkan di kelas Anda.` });
    }
    const categories = await GradeCategory.findAll({
      where: { class_id: teacherClass.id, subject_id, semester_id },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    return res.status(200).json({
      message: categories.length ? 'Data kategori berhasil diambil' : 'Belum ada kategori',
      data: categories,
    });
  } catch (error) {
    console.error('[grade/categories/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar kategori penilaian' });
  }
};

/**
 * POST /teachers/grades/:subject_id/:semester_id/categories
 * Buat kategori penilaian baru.
 *
 * @param {import('express').Request} req - Params: { subject_id, semester_id }, Body: { name }
 * @param {import('express').Response} res
 */
exports.createCategory = async (req, res) => {
  try {
    const { subject_id, semester_id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nama kategori wajib diisi' });
    }
    const semester = await Semester.findByPk(semester_id);
    if (!semester) {
      return res.status(400).json({ message: `Semester dengan ID ${semester_id} tidak ditemukan.` });
    }
    const subject = await Subject.findByPk(subject_id);
    if (!subject) {
      return res.status(400).json({ message: `Mata pelajaran dengan ID ${subject_id} tidak ditemukan.` });
    }
    const teacherClass = await getActiveTeacherClass(req.user.id);
    if (!teacherClass) {
      return res.status(403).json({ message: 'Anda tidak memiliki kelas aktif' });
    }
    const duplicate = await GradeCategory.findOne({
      where: { subject_id, class_id: teacherClass.id, semester_id, name: name.trim() },
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Kategori dengan nama ini sudah ada.' });
    }
    const newCategory = await GradeCategory.create({
      subject_id,
      class_id: teacherClass.id,
      semester_id,
      name: name.trim(),
    });
    return res.status(201).json({
      message: 'Kategori penilaian berhasil dibuat',
      data: newCategory,
    });
  } catch (error) {
    console.error('[grade/categories/create] Error:', error);
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ message: 'Data semester atau mata pelajaran tidak valid.' });
    }
    return res.status(500).json({ message: 'Gagal membuat kategori penilaian' });
  }
};

/**
 * PUT /teachers/grades/categories/:category_id
 * Update nama kategori.
 *
 * @param {import('express').Request} req - Params: { category_id }, Body: { name }
 * @param {import('express').Response} res
 */
exports.updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nama kategori wajib diisi' });
    }
    const resolved = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { category, teacherClass } = resolved;
    const duplicate = await GradeCategory.findOne({
      where: {
        name: name.trim(),
        class_id: teacherClass.id,
        subject_id: category.subject_id,
        id: { [Op.ne]: category.id },
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Nama kategori sudah digunakan di mapel ini' });
    }
    await category.update({ name: name.trim() });
    return res.json({ message: 'Kategori penilaian berhasil diperbarui' });
  } catch (error) {
    console.error('[grade/categories/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui kategori penilaian' });
  }
};

/**
 * DELETE /teachers/grades/categories/:category_id
 * Hapus kategori beserta seluruh GradeDetail dan StudentGrade di dalamnya.
 *
 * @param {import('express').Request} req - Params: { category_id }
 * @param {import('express').Response} res
 */
exports.deleteCategory = async (req, res) => {
  try {
    const resolved = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { category } = resolved;
    const details = await GradeDetail.findAll({
      where: { grade_category_id: category.id },
      attributes: ['id'],
    });
    if (details.length) {
      const detailIds = details.map(d => d.id);
      await StudentGrade.destroy({ where: { grade_detail_id: { [Op.in]: detailIds } } });
      await GradeDetail.destroy({ where: { grade_category_id: category.id } });
    }
    await category.destroy();
    return res.json({ message: 'Kategori penilaian beserta seluruh isinya berhasil dihapus' });
  } catch (error) {
    console.error('[grade/categories/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus kategori penilaian' });
  }
};

// ============================================================
// 3. Item Penilaian (GradeDetail)
// ============================================================

/**
 * GET /teachers/grades/categories/:category_id/details
 * Daftar item penilaian dalam satu kategori.
 *
 * @param {import('express').Request} req - Params: { category_id }
 * @param {import('express').Response} res
 */
exports.getDetails = async (req, res) => {
  try {
    const resolved = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const details = await GradeDetail.findAll({
      where: { grade_category_id: req.params.category_id },
      order: [['name', 'ASC']],
      attributes: ['id', 'name', 'date'],
    });
    return res.json(details);
  } catch (error) {
    console.error('[grade/details/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar item penilaian' });
  }
};

/**
 * POST /teachers/grades/categories/:category_id/details
 * Tambah item penilaian baru. Secara otomatis membuat StudentGrade untuk semua siswa.
 *
 * @param {import('express').Request} req - Params: { category_id }, Body: { name, date? }
 * @param {import('express').Response} res
 */
exports.createDetail = async (req, res) => {
  try {
    const { name, date } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Nama item penilaian wajib diisi' });
    }
    if (date && !isValidDate(date)) {
      return res.status(400).json({ message: 'Format tanggal tidak valid. Gunakan YYYY-MM-DD.' });
    }
    const resolved = await resolveCategoryOwnership(req.params.category_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { category, teacherClass } = resolved;
    const duplicate = await GradeDetail.findOne({
      where: { grade_category_id: category.id, name: name.trim() },
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Item penilaian dengan nama ini sudah ada di kategori ini' });
    }
    const newDetail = await GradeDetail.create({
      grade_category_id: category.id,
      name: name.trim(),
      date: date || null,
    });
    const studentClasses = await StudentClass.findAll({
      where: { class_id: teacherClass.id },
      attributes: ['id'],
      raw: true,
    });
    if (studentClasses.length) {
      await StudentGrade.bulkCreate(
        studentClasses.map(sc => ({
          student_class_id: sc.id,
          grade_detail_id: newDetail.id,
          score: null,
        }))
      );
    }
    return res.status(201).json({
      message: 'Item penilaian berhasil ditambahkan',
      data: newDetail,
    });
  } catch (error) {
    console.error('[grade/details/create] Error:', error);
    return res.status(500).json({ message: 'Gagal membuat item penilaian' });
  }
};

/**
 * PUT /teachers/grades/details/:detail_id
 * Update nama dan/atau tanggal item penilaian.
 *
 * @param {import('express').Request} req - Params: { detail_id }, Body: { name?, date? }
 * @param {import('express').Response} res
 */
exports.updateDetail = async (req, res) => {
  try {
    const { name, date } = req.body;
    if (!name && !date) {
      return res.status(400).json({ message: 'Tidak ada data yang diperbarui. Kirimkan name atau date.' });
    }
    if (date && !isValidDate(date)) {
      return res.status(400).json({ message: 'Format tanggal tidak valid. Gunakan YYYY-MM-DD.' });
    }
    const resolved = await resolveDetailOwnership(req.params.detail_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { gradeDetail } = resolved;
    if (name && name.trim() !== gradeDetail.name) {
      const duplicate = await GradeDetail.findOne({
        where: {
          grade_category_id: gradeDetail.grade_category_id,
          name: name.trim(),
          id: { [Op.ne]: gradeDetail.id },
        },
      });
      if (duplicate) {
        return res.status(409).json({ message: 'Nama item penilaian sudah digunakan di kategori ini' });
      }
    }
    await gradeDetail.update({
      name: name ? name.trim() : gradeDetail.name,
      date: date !== undefined ? date : gradeDetail.date,
    });
    return res.json({ message: 'Item penilaian berhasil diperbarui' });
  } catch (error) {
    console.error('[grade/details/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui item penilaian' });
  }
};

/**
 * DELETE /teachers/grades/details/:detail_id
 * Hapus item penilaian beserta seluruh nilai siswa di dalamnya.
 *
 * @param {import('express').Request} req - Params: { detail_id }
 * @param {import('express').Response} res
 */
exports.deleteDetail = async (req, res) => {
  try {
    const resolved = await resolveDetailOwnership(req.params.detail_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { gradeDetail } = resolved;
    await StudentGrade.destroy({ where: { grade_detail_id: gradeDetail.id } });
    await gradeDetail.destroy();
    return res.json({ message: 'Item penilaian beserta seluruh nilai siswa berhasil dihapus' });
  } catch (error) {
    console.error('[grade/details/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus item penilaian' });
  }
};

// ============================================================
// 4. Nilai Siswa (StudentGrade)
// ============================================================

/**
 * GET /teachers/grades/details/:detail_id/students
 * Semua siswa beserta skor mereka untuk satu item penilaian.
 *
 * @param {import('express').Request} req - Params: { detail_id }
 * @param {import('express').Response} res
 */
exports.getStudentGrades = async (req, res) => {
  try {
    const resolved = await resolveDetailOwnership(req.params.detail_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const studentGrades = await StudentGrade.findAll({
      where: { grade_detail_id: req.params.detail_id },
      include: [{
        model: StudentClass,
        as: 'student_class',
        include: { model: Student, as: 'student', attributes: ['id', 'name'] },
      }],
      order: [[{ model: StudentClass, as: 'student_class' }, { model: Student, as: 'student' }, 'name', 'ASC']],
    });
    return res.json(
      studentGrades.map(entry => ({
        student_grade_id: entry.id,
        student_id: entry.student_class?.student?.id ?? null,
        student_name: entry.student_class?.student?.name ?? null,
        score: entry.score,
      }))
    );
  } catch (error) {
    console.error('[grade/students/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar nilai siswa' });
  }
};

/**
 * PATCH /teachers/grades/students/:student_grade_id
 * Update skor satu siswa untuk satu item penilaian.
 *
 * [Fix H-04] Memastikan otorisasi dengan getActiveTeacherClass (tahun ajaran aktif).
 *
 * @param {import('express').Request} req - Params: { student_grade_id }, Body: { score }
 * @param {import('express').Response} res
 */
exports.updateStudentScore = async (req, res) => {
  try {
    const { score } = req.body;
    if (score === undefined || score === null) {
      return res.status(400).json({ message: 'Field score wajib diisi' });
    }
    const numericScore = Number(score);
    if (isNaN(numericScore)) {
      return res.status(400).json({ message: 'Skor harus berupa angka' });
    }
    if (numericScore < 0 || numericScore > 100) {
      return res.status(400).json({ message: 'Skor harus berada di antara 0 dan 100' });
    }

    const studentGrade = await StudentGrade.findOne({
      where: { id: req.params.student_grade_id },
      include: [{
        model: GradeDetail,
        as: 'grade_detail',
        include: {
          model: GradeCategory,
          as: 'grade_category',
          attributes: ['id', 'class_id'],
        },
      }],
    });
    if (!studentGrade) {
      return res.status(404).json({ message: 'Data nilai siswa tidak ditemukan' });
    }

    // [Fix H-04] Gunakan getActiveTeacherClass, bukan Class.findOne tanpa filter tahun ajaran
    const teacherClass = await getActiveTeacherClass(req.user.id);
    const gradeClassId = studentGrade.grade_detail?.grade_category?.class_id;
    if (!teacherClass || gradeClassId !== teacherClass.id) {
      return res.status(403).json({
        message: 'Akses ditolak. Nilai ini bukan milik kelas yang Anda ampu di tahun ajaran aktif.',
      });
    }

    studentGrade.score = numericScore;
    await studentGrade.save();
    return res.json({ message: 'Skor siswa berhasil diperbarui' });
  } catch (error) {
    console.error('[grade/students/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui skor siswa' });
  }
};