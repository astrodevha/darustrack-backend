/**
 * controllers/teacherEvaluationController.js
 * --------------------------------------------
 * Controller untuk manajemen evaluasi siswa oleh wali kelas.
 *
 * "Evaluasi" adalah penilaian kualitatif (deskriptif) per semester,
 * berbeda dari nilai/grade yang bersifat numerik.
 *
 * Endpoints yang dilayani:
 *  - GET    /teachers/semesters/:semester_id/evaluations     → List judul evaluasi
 *  - POST   /teachers/semesters/:semester_id/evaluations     → Tambah judul evaluasi baru
 *  - GET    /teachers/evaluations/:id                        → Detail evaluasi per siswa
 *  - PUT    /teachers/evaluations/:id                        → Edit judul evaluasi
 *  - DELETE /teachers/evaluations/:id                        → Hapus evaluasi beserta studentEvaluations
 *  - PUT    /teachers/student-evaluations/:id                → Edit deskripsi evaluasi satu siswa
 *
 * @module controllers/teacherEvaluationController
 */

const { Op } = require('sequelize');
const {
  Class, AcademicYear, Semester, Student, StudentClass,
  Evaluation, StudentEvaluation,
} = require('../models');

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Memastikan bahwa semester ada dan berada di tahun ajaran aktif.
 * Mengembalikan { semester, academicYear, myClass } atau null jika tidak valid.
 *
 * @param {number} semesterId
 * @param {number} teacherId
 * @returns {Promise<{semester, academicYear, myClass}|null>}
 */
async function resolveSemesterAndClass(semesterId, teacherId) {
  const semester = await Semester.findOne({
    where: { id: semesterId },
    include: {
      model: AcademicYear,
      as:    'academic_year',
      where: { is_active: true },
    },
  });
  if (!semester) return null;

  const myClass = await Class.findOne({
    where: { teacher_id: teacherId, academic_year_id: semester.academic_year_id },
  });

  return { semester, myClass };
}

/**
 * Verifikasi bahwa evaluasi ini milik kelas yang dikelola wali kelas yang login.
 * Mengembalikan { evaluation, myClass } atau pesan error untuk dikirim ke client.
 *
 * @param {number} evaluationId
 * @param {number} teacherId
 * @returns {Promise<{evaluation, myClass}|{error: string, status: number}>}
 */
async function resolveEvaluationOwnership(evaluationId, teacherId) {
  const evaluation = await Evaluation.findByPk(evaluationId);
  if (!evaluation) return { error: 'Evaluasi tidak ditemukan', status: 404 };

  const semester = await Semester.findByPk(evaluation.semester_id);
  if (!semester)  return { error: 'Semester tidak ditemukan', status: 404 };

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

// ── List judul evaluasi per semester ─────────────────────────────────────────

/**
 * GET /teachers/semesters/:semester_id/evaluations
 */
exports.getEvaluations = async (req, res) => {
  try {
    const { semester_id } = req.params;

    const resolved = await resolveSemesterAndClass(semester_id, req.user.id);
    if (!resolved) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
    }

    const { semester, myClass } = resolved;
    if (!myClass) {
      return res.status(404).json({ message: 'Anda tidak menjadi wali kelas di tahun ajaran aktif' });
    }

    const evaluations = await Evaluation.findAll({
      where: { class_id: myClass.id, semester_id: semester.id },
      order: [['title', 'ASC']],
    });

    return res.json({ evaluations });
  } catch (error) {
    console.error('[evaluation/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil evaluasi', error: error.message });
  }
};

// ── Tambah judul evaluasi ─────────────────────────────────────────────────────

/**
 * POST /teachers/semesters/:semester_id/evaluations
 * Body: { title: string }
 *
 * Otomatis membuat StudentEvaluation (deskripsi kosong) untuk setiap siswa di kelas.
 */
exports.createEvaluation = async (req, res) => {
  try {
    const { semester_id } = req.params;
    const { title }       = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'Judul evaluasi wajib diisi' });
    }

    const resolved = await resolveSemesterAndClass(semester_id, req.user.id);
    if (!resolved) {
      return res.status(404).json({ message: 'Semester tidak ditemukan atau tidak aktif' });
    }

    const { semester, myClass } = resolved;
    if (!myClass) {
      return res.status(403).json({ message: 'Anda tidak menjadi wali kelas di tahun ajaran ini' });
    }

    // Cek duplikat judul di semester & kelas yang sama
    const duplicate = await Evaluation.findOne({
      where: { title: title.trim(), class_id: myClass.id, semester_id: semester.id },
    });
    if (duplicate) {
      return res.status(400).json({ message: 'Evaluasi dengan judul ini sudah ada di semester ini' });
    }

    // Buat evaluasi dan langsung populate StudentEvaluation untuk setiap siswa
    const evaluation = await Evaluation.create({
      title:       title.trim(),
      class_id:    myClass.id,
      semester_id: semester.id,
    });

    const studentClasses   = await StudentClass.findAll({ where: { class_id: myClass.id } });
    const studentEvalEntries = studentClasses.map((sc) => ({
      evaluation_id:    evaluation.id,
      student_class_id: sc.id,
      description:      null,
    }));

    await StudentEvaluation.bulkCreate(studentEvalEntries);

    return res.status(201).json({
      message:    'Evaluasi berhasil ditambahkan untuk semua siswa',
      evaluation,
    });
  } catch (error) {
    console.error('[evaluation/create] Error:', error);
    return res.status(500).json({ message: 'Gagal membuat evaluasi', error: error.message });
  }
};

// ── Detail evaluasi per siswa ─────────────────────────────────────────────────

/**
 * GET /teachers/evaluations/:id
 * Menampilkan deskripsi evaluasi tiap siswa untuk satu judul evaluasi.
 */
exports.getEvaluationDetail = async (req, res) => {
  try {
    const resolved = await resolveEvaluationOwnership(req.params.id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }

    const { evaluation } = resolved;

    const studentEvaluations = await StudentEvaluation.findAll({
      where: { evaluation_id: evaluation.id },
      include: {
        model: StudentClass,
        as:    'student_class',
        include: {
          model:      Student,
          as:         'student',
          attributes: ['name', 'nisn'],
        },
      },
    });

    const result = studentEvaluations
      .map((se) => ({
        student_evaluation_id: se.id,
        name:                  se.student_class?.student?.name  ?? null,
        nisn:                  se.student_class?.student?.nisn  ?? null,
        description:           se.description,
      }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

    return res.json(result);
  } catch (error) {
    console.error('[evaluation/detail] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil evaluasi siswa', error: error.message });
  }
};

// ── Edit judul evaluasi ───────────────────────────────────────────────────────

/**
 * PUT /teachers/evaluations/:id
 * Body: { title: string }
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

    // Cek duplikat judul (kecuali evaluasi yang sedang diedit)
    const duplicate = await Evaluation.findOne({
      where: {
        title:       title.trim(),
        class_id:    myClass.id,
        semester_id: evaluation.semester_id,
        id:          { [Op.ne]: evaluation.id },
      },
    });
    if (duplicate) {
      return res.status(400).json({ message: 'Judul evaluasi sudah digunakan di semester dan kelas ini' });
    }

    await evaluation.update({ title: title.trim() });
    return res.json({ message: 'Evaluasi berhasil diperbarui', evaluation });
  } catch (error) {
    console.error('[evaluation/update] Error:', error);
    return res.status(500).json({ message: 'Gagal mengedit evaluasi', error: error.message });
  }
};

// ── Hapus evaluasi ────────────────────────────────────────────────────────────

/**
 * DELETE /teachers/evaluations/:id
 *
 * CATATAN (Bug yang diperbaiki):
 * Versi sebelumnya tidak melakukan cek kepemilikan sama sekali — siapapun
 * wali kelas bisa menghapus evaluasi milik kelas lain. Sekarang diperbaiki
 * dengan `resolveEvaluationOwnership` sebelum menghapus.
 */
exports.deleteEvaluation = async (req, res) => {
  try {
    const resolved = await resolveEvaluationOwnership(req.params.id, req.user.id);
    if (resolved.error) {
      return res.status(resolved.status).json({ message: resolved.error });
    }

    // Hapus StudentEvaluation terkait terlebih dahulu (jika tidak ada CASCADE di DB)
    await StudentEvaluation.destroy({ where: { evaluation_id: resolved.evaluation.id } });
    await resolved.evaluation.destroy();

    return res.json({ message: 'Evaluasi berhasil dihapus' });
  } catch (error) {
    console.error('[evaluation/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus evaluasi', error: error.message });
  }
};

// ── Edit deskripsi evaluasi satu siswa ───────────────────────────────────────

/**
 * PUT /teachers/student-evaluations/:id
 * Body: { description: string }
 */
exports.updateStudentEvaluation = async (req, res) => {
  try {
    const { description } = req.body;

    const studentEvaluation = await StudentEvaluation.findByPk(req.params.id, {
      include: { model: Evaluation, as: 'evaluation' },
    });

    if (!studentEvaluation) {
      return res.status(404).json({ message: 'Evaluasi siswa tidak ditemukan' });
    }

    // Pastikan evaluasi ini milik kelas wali kelas yang login
    const evaluation  = studentEvaluation.evaluation;
    const semester    = await Semester.findByPk(evaluation.semester_id);
    const academicYear = await AcademicYear.findOne({
      where: { id: semester.academic_year_id, is_active: true },
    });
    if (!academicYear) {
      return res.status(400).json({ message: 'Tahun ajaran tidak aktif' });
    }

    const myClass = await Class.findOne({
      where: { teacher_id: req.user.id, academic_year_id: academicYear.id },
    });
    if (!myClass || evaluation.class_id !== myClass.id) {
      return res.status(403).json({ message: 'Anda tidak berhak mengubah evaluasi ini' });
    }

    studentEvaluation.description = description;
    await studentEvaluation.save();

    return res.json({ message: 'Deskripsi evaluasi berhasil diperbarui' });
  } catch (error) {
    console.error('[studentEvaluation/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui deskripsi evaluasi', error: error.message });
  }
};
