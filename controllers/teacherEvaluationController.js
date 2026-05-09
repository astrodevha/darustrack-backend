/**
 * controllers/teacherEvaluationController.js
 *
 * Controller untuk manajemen evaluasi siswa oleh wali kelas.
 * "Evaluasi" adalah penilaian kualitatif (deskriptif) per semester,
 * berbeda dari nilai/grade yang bersifat numerik.
 *
 * Hierarki data:
 *   Evaluation (judul, misal: "Sikap Sosial")
 *     └─ StudentEvaluation (deskripsi per siswa)
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /teachers/semesters/:semester_id/evaluations     → daftar judul evaluasi
 * POST   /teachers/semesters/:semester_id/evaluations     → tambah judul evaluasi baru
 * GET    /teachers/evaluations/:id                        → detail evaluasi per siswa
 * PUT    /teachers/evaluations/:id                        → edit judul evaluasi
 * DELETE /teachers/evaluations/:id                        → hapus evaluasi
 * PUT    /teachers/student-evaluations/:id                → edit deskripsi satu siswa
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Gunakan helper resolveSemesterAndClass dan resolveEvaluationOwnership untuk validasi.
 * - Operasi create wajib menggunakan transaction.
 * - Jangan hapus validasi tahun ajaran aktif di semua endpoint.
 *
 * @module teacherEvaluationController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op } = require('sequelize');
const {
  sequelize, Class, AcademicYear, Semester, Student, StudentClass,
  Evaluation, StudentEvaluation,
} = require('../models');

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Validasi bahwa semester ada, berada di tahun ajaran aktif,
 * dan wali kelas ini mengajar di tahun ajaran tersebut.
 *
 * @param {string} semesterId - ID semester
 * @param {string} teacherId - ID user wali kelas (req.user.id)
 * @returns {Promise<{semester: Semester|null, myClass: Class|null} | {error: string, status: number}>}
 */
async function resolveSemesterAndClass(semesterId, teacherId) {
  const semester = await Semester.findOne({
    where: { id: semesterId },
    include: {
      model: AcademicYear,
      as: 'academic_year',
      where: { is_active: true },
    },
  });
  if (!semester) {
    return { error: 'Semester tidak ditemukan atau tahun ajaran tidak aktif', status: 404 };
  }

  const myClass = await Class.findOne({
    where: { teacher_id: teacherId, academic_year_id: semester.academic_year_id },
  });
  return { semester, myClass };
}

/**
 * Verifikasi bahwa evaluasi ini milik kelas wali kelas yang sedang login.
 *
 * @param {string} evaluationId - ID evaluation
 * @param {string} teacherId - ID user wali kelas
 * @returns {Promise<{evaluation: Evaluation|null, myClass: Class|null} | {error: string, status: number}>}
 */
async function resolveEvaluationOwnership(evaluationId, teacherId) {
  const evaluation = await Evaluation.findByPk(evaluationId);
  if (!evaluation) return { error: 'Evaluasi tidak ditemukan', status: 404 };

  const semester = await Semester.findByPk(evaluation.semester_id);
  if (!semester) return { error: 'Semester evaluasi tidak ditemukan', status: 404 };

  const academicYear = await AcademicYear.findOne({
    where: { id: semester.academic_year_id, is_active: true },
  });
  if (!academicYear) return { error: 'Tahun ajaran tidak aktif', status: 400 };

  const myClass = await Class.findOne({
    where: { teacher_id: teacherId, academic_year_id: academicYear.id },
  });
  if (!myClass || evaluation.class_id !== myClass.id) {
    return { error: 'Anda tidak berhak mengakses evaluasi ini', status: 403 };
  }
  return { evaluation, myClass };
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /teachers/semesters/:semester_id/evaluations
 *
 * Daftar judul evaluasi yang sudah dibuat di semester ini.
 * [Fix BUG #32] Null check untuk tahun ajaran aktif.
 *
 * @param {import('express').Request} req - Params: semester_id
 * @param {import('express').Response} res
 */
exports.getEvaluations = async (req, res) => {
  try {
    const { semester_id } = req.params;
    const resolved = await resolveSemesterAndClass(semester_id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { semester, myClass } = resolved;
    if (!myClass) {
      return res.status(404).json({ message: 'Anda tidak menjadi wali kelas di tahun ajaran aktif' });
    }

    const evaluations = await Evaluation.findAll({
      where: { class_id: myClass.id, semester_id: semester.id },
      order: [['title', 'ASC']],
      attributes: ['id', 'title'],
    });
    return res.json({ evaluations });
  } catch (error) {
    console.error('[evaluation/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar evaluasi' });
  }
};

/**
 * POST /teachers/semesters/:semester_id/evaluations
 *
 * Tambah judul evaluasi baru dan buat StudentEvaluation (kosong) untuk tiap siswa.
 * [Fix BUG #36] Seluruh operasi dalam transaction.
 *
 * @param {import('express').Request} req - Params: semester_id, Body: { title }
 * @param {import('express').Response} res
 */
exports.createEvaluation = async (req, res) => {
  const { semester_id } = req.params;
  const { title } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ message: 'Judul evaluasi wajib diisi' });
  }

  const t = await sequelize.transaction();
  try {
    const resolved = await resolveSemesterAndClass(semester_id, req.user.id);
    if (resolved.error) {
      await t.rollback();
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { semester, myClass } = resolved;
    if (!myClass) {
      await t.rollback();
      return res.status(403).json({ message: 'Anda tidak menjadi wali kelas di tahun ajaran ini' });
    }

    // Cek duplikat judul di kelas dan semester yang sama
    const duplicate = await Evaluation.findOne({
      where: { title: title.trim(), class_id: myClass.id, semester_id: semester.id },
      transaction: t,
    });
    if (duplicate) {
      await t.rollback();
      return res.status(409).json({ message: 'Evaluasi dengan judul ini sudah ada di semester ini' });
    }

    // Buat judul evaluasi
    const evaluation = await Evaluation.create(
      { title: title.trim(), class_id: myClass.id, semester_id: semester.id },
      { transaction: t }
    );

    // Ambil semua siswa di kelas ini
    const studentClasses = await StudentClass.findAll({
      where: { class_id: myClass.id },
      attributes: ['id'],
      transaction: t,
    });
    if (!studentClasses.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Tidak ada siswa di kelas ini. Tambahkan siswa terlebih dahulu.' });
    }

    // [BUG #36] Bulk create dalam transaksi yang sama
    const studentEvalEntries = studentClasses.map(sc => ({
      evaluation_id: evaluation.id,
      student_class_id: sc.id,
      description: null,
    }));
    await StudentEvaluation.bulkCreate(studentEvalEntries, { transaction: t });
    await t.commit();

    return res.status(201).json({
      message: `Evaluasi berhasil ditambahkan untuk ${studentClasses.length} siswa`,
      evaluation: { id: evaluation.id, title: evaluation.title },
    });
  } catch (error) {
    await t.rollback();
    console.error('[evaluation/create] Error:', error);
    return res.status(500).json({ message: 'Gagal menambahkan evaluasi' });
  }
};

/**
 * GET /teachers/evaluations/:id
 *
 * Menampilkan deskripsi evaluasi per siswa untuk satu judul evaluasi.
 *
 * @param {import('express').Request} req - Params: id
 * @param {import('express').Response} res
 */
exports.getEvaluationDetail = async (req, res) => {
  try {
    const resolved = await resolveEvaluationOwnership(req.params.id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const studentEvaluations = await StudentEvaluation.findAll({
      where: { evaluation_id: resolved.evaluation.id },
      include: [{
        model: StudentClass,
        as: 'student_class',
        include: [{
          model: Student,
          as: 'student',
          attributes: ['name', 'nisn'],
        }],
      }],
    });
    const result = studentEvaluations
      .map(se => ({
        student_evaluation_id: se.id,
        name: se.student_class?.student?.name ?? null,
        nisn: se.student_class?.student?.nisn ?? null,
        description: se.description,
      }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
    return res.json(result);
  } catch (error) {
    console.error('[evaluation/detail] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil detail evaluasi' });
  }
};

/**
 * PUT /teachers/evaluations/:id
 *
 * Edit judul evaluasi.
 *
 * @param {import('express').Request} req - Params: id, Body: { title }
 * @param {import('express').Response} res
 */
exports.updateEvaluation = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'Judul evaluasi wajib diisi' });
    }
    const resolved = await resolveEvaluationOwnership(req.params.id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { evaluation, myClass } = resolved;
    // Cek duplikat (kecuali evaluasi ini sendiri)
    const duplicate = await Evaluation.findOne({
      where: {
        title: title.trim(),
        class_id: myClass.id,
        semester_id: evaluation.semester_id,
        id: { [Op.ne]: evaluation.id },
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: 'Judul evaluasi sudah digunakan di semester dan kelas ini' });
    }
    await evaluation.update({ title: title.trim() });
    return res.json({ message: 'Evaluasi berhasil diperbarui', evaluation });
  } catch (error) {
    console.error('[evaluation/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui evaluasi' });
  }
};

/**
 * DELETE /teachers/evaluations/:id
 *
 * Hapus evaluasi beserta semua StudentEvaluation-nya.
 * Ownership check via resolveEvaluationOwnership.
 *
 * @param {import('express').Request} req - Params: id
 * @param {import('express').Response} res
 */
exports.deleteEvaluation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const resolved = await resolveEvaluationOwnership(req.params.id, req.user.id);
    if (resolved.error) {
      await t.rollback();
      return res.status(resolved.status).json({ message: resolved.error });
    }
    const { evaluation } = resolved;
    // Hapus StudentEvaluation terlebih dahulu (jika tidak ada CASCADE di DB)
    await StudentEvaluation.destroy({
      where: { evaluation_id: evaluation.id },
      transaction: t,
    });
    await evaluation.destroy({ transaction: t });
    await t.commit();
    return res.json({ message: 'Evaluasi berhasil dihapus' });
  } catch (error) {
    await t.rollback();
    console.error('[evaluation/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus evaluasi' });
  }
};

/**
 * PUT /teachers/student-evaluations/:id
 *
 * Edit deskripsi evaluasi untuk satu siswa.
 *
 * @param {import('express').Request} req - Params: id, Body: { description }
 * @param {import('express').Response} res
 */
exports.updateStudentEvaluation = async (req, res) => {
  try {
    const { description } = req.body;
    const studentEval = await StudentEvaluation.findByPk(req.params.id, {
      include: { model: Evaluation, as: 'evaluation' },
    });
    if (!studentEval) {
      return res.status(404).json({ message: 'Evaluasi siswa tidak ditemukan' });
    }
    // Verifikasi kepemilikan
    const semester = await Semester.findByPk(studentEval.evaluation.semester_id);
    const activeYear = await AcademicYear.findOne({
      where: { id: semester?.academic_year_id, is_active: true },
    });
    if (!activeYear) {
      return res.status(400).json({ message: 'Tahun ajaran tidak aktif' });
    }
    const myClass = await Class.findOne({
      where: { teacher_id: req.user.id, academic_year_id: activeYear.id },
    });
    if (!myClass || studentEval.evaluation.class_id !== myClass.id) {
      return res.status(403).json({ message: 'Anda tidak berhak mengubah evaluasi ini' });
    }
    studentEval.description = description;
    await studentEval.save();
    return res.json({ message: 'Deskripsi evaluasi berhasil diperbarui' });
  } catch (error) {
    console.error('[studentEvaluation/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui deskripsi evaluasi' });
  }
};