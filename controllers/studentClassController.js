/**
 * controllers/studentClassController.js
 *
 * Controller untuk manajemen penempatan siswa ke kelas (StudentClass).
 * StudentClass adalah tabel junction antara Student dan Class yang mencatat
 * siswa mana yang terdaftar di kelas mana pada tahun ajaran tertentu.
 * Satu siswa hanya boleh terdaftar di SATU kelas per tahun ajaran.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /:academicYearId/classes/:classId/students          → daftar siswa di kelas
 * POST   /:academicYearId/classes/:classId/students          → tambah siswa ke kelas
 * DELETE /:academicYearId/classes/:classId/students/:studentId → hapus siswa dari kelas
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Satu siswa hanya boleh terdaftar di satu kelas dalam satu tahun ajaran.
 * - Penambahan siswa ke kelas bersifat all-or-nothing (atomic).
 * - Penghapusan siswa dari kelas akan cascade-delete Attendance, StudentGrade,
 *   dan StudentEvaluation yang terkait (jika FK menggunakan ON DELETE CASCADE).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - JANGAN hapus transaction pada addStudentsToClass — sangat kritis untuk
 *   integritas data.
 * - Pastikan model Student, Class, AcademicYear sudah terdefinisi dengan baik.
 * - Urutan siswa pada response getStudentsInClass diurutkan berdasarkan nama.
 *
 * @module studentClassController
 */

// ============================================================
// Dependencies
// ============================================================
const { AcademicYear, Class, StudentClass, Student, sequelize } = require('../models');

// ============================================================
// Helper Functions (Private)
// ============================================================

/**
 * Memvalidasi keberadaan tahun ajaran dan kelas dalam satu query.
 * Digunakan untuk menghindari duplikasi kode di beberapa endpoint.
 *
 * @param {string} academicYearId - ID tahun ajaran
 * @param {string} classId - ID kelas
 * @param {Object} [options] - Opsi tambahan (transaction)
 * @returns {Promise<{academicYear: AcademicYear|null, classData: Class|null}>}
 */
async function validateAcademicYearAndClass(academicYearId, classId, options = {}) {
  const academicYear = await AcademicYear.findByPk(academicYearId, options);
  if (!academicYear) return { academicYear: null, classData: null };

  const classData = await Class.findOne({
    where: { id: classId, academic_year_id: academicYearId },
    ...options,
  });
  return { academicYear, classData };
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /:academicYearId/classes/:classId/students
 *
 * Mengembalikan daftar siswa yang terdaftar di kelas tertentu,
 * diurutkan berdasarkan nama (A-Z).
 *
 * @param {import('express').Request} req - Params: { academicYearId, classId }
 * @param {import('express').Response} res
 */
exports.getStudentsInClass = async (req, res) => {
  try {
    const { academicYearId, classId } = req.params;

    const { academicYear, classData } = await validateAcademicYearAndClass(academicYearId, classId);
    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran ini' });
    }

    // Ambil data StudentClass beserta relasi Student
    const studentClassRecords = await StudentClass.findAll({
      where: { class_id: classId },
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'name', 'nisn', 'birth_date', 'parent_id'],
        },
      ],
      order: [[{ model: Student, as: 'student' }, 'name', 'ASC']],
    });

    const students = studentClassRecords.map((sc) => sc.student).filter(Boolean);

    return res.json({
      class_id: classData.id,
      class_name: classData.name,
      students,
    });
  } catch (error) {
    console.error('[studentClass/getStudents] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data siswa di kelas' });
  }
};

/**
 * POST /:academicYearId/classes/:classId/students
 *
 * Mendaftarkan satu atau beberapa siswa ke kelas.
 * [Fix Bug #4] Seluruh proses dibungkus dalam transaction untuk atomicity.
 *
 * Aturan validasi:
 * - Semua studentId harus valid (ada di tabel students)
 * - Tidak ada siswa yang sudah terdaftar di kelas lain dalam tahun ajaran yang sama
 * - Operasi all-or-nothing: jika satu siswa gagal, semua dibatalkan
 *
 * @param {import('express').Request} req - Params: { academicYearId, classId }, Body: { studentIds: string[] }
 * @param {import('express').Response} res
 */
exports.addStudentsToClass = async (req, res) => {
  const { academicYearId, classId } = req.params;
  const { studentIds } = req.body;

  // Validasi awal (sebelum transaksi)
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({
      message: 'studentIds wajib berupa array yang tidak kosong',
    });
  }

  /** [Bug #4] Transaction untuk atomicity */
  const t = await sequelize.transaction();

  try {
    // 1. Validasi tahun ajaran dan kelas (dalam transaction)
    const { academicYear, classData } = await validateAcademicYearAndClass(
      academicYearId,
      classId,
      { transaction: t }
    );
    if (!academicYear) {
      await t.rollback();
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }
    if (!classData) {
      await t.rollback();
      return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran ini' });
    }

    // 2. Validasi semua studentId ada di database
    const students = await Student.findAll({
      where: { id: studentIds },
      attributes: ['id', 'name'],
      transaction: t,
    });
    if (students.length !== studentIds.length) {
      const foundIds = students.map((s) => s.id);
      const invalidIds = studentIds.filter((id) => !foundIds.includes(id));
      await t.rollback();
      return res.status(400).json({
        message: 'Beberapa ID siswa tidak ditemukan',
        invalidIds,
      });
    }

    // 3. Cek apakah ada siswa yang sudah terdaftar di kelas manapun dalam tahun ajaran ini
    const allClassesInYear = await Class.findAll({
      where: { academic_year_id: academicYearId },
      attributes: ['id'],
      transaction: t,
    });
    const allClassIds = allClassesInYear.map((c) => c.id);

    const alreadyAssigned = await StudentClass.findAll({
      where: {
        student_id: studentIds,
        class_id: allClassIds,
      },
      include: [
        {
          model: Student,
          as: 'student',
          attributes: ['id', 'name'],
        },
      ],
      transaction: t,
    });

    if (alreadyAssigned.length > 0) {
      await t.rollback();
      return res.status(400).json({
        message: 'Beberapa siswa sudah terdaftar di kelas lain dalam tahun ajaran ini',
        conflicts: alreadyAssigned.map((sc) => ({
          student_id: sc.student_id,
          student_name: sc.student?.name ?? null,
          class_id: sc.class_id,
        })),
      });
    }

    // 4. Bulk insert dalam transaction
    const records = studentIds.map((studentId) => ({
      student_id: studentId,
      class_id: classId,
    }));
    await StudentClass.bulkCreate(records, { transaction: t });

    // 5. Commit transaction
    await t.commit();

    return res.status(201).json({
      message: `${studentIds.length} siswa berhasil ditambahkan ke kelas`,
      added_count: studentIds.length,
    });
  } catch (error) {
    await t.rollback();
    console.error('[studentClass/addStudents] Error:', error);
    return res.status(500).json({ message: 'Gagal menambahkan siswa ke kelas' });
  }
};

/**
 * DELETE /:academicYearId/classes/:classId/students/:studentId
 *
 * Menghapus siswa dari kelas.
 *
 * PERINGATAN: Operasi ini akan cascade-delete semua record terkait:
 *   - Attendance (data kehadiran siswa di kelas ini)
 *   - StudentGrade (nilai siswa di kelas ini)
 *   - StudentEvaluation (evaluasi siswa di kelas ini)
 * Pastikan penghapusan benar-benar disengaja.
 *
 * @param {import('express').Request} req - Params: { academicYearId, classId, studentId }
 * @param {import('express').Response} res
 */
exports.removeStudentFromClass = async (req, res) => {
  const { academicYearId, classId, studentId } = req.params;

  try {
    // Validasi tahun ajaran dan kelas
    const { academicYear, classData } = await validateAcademicYearAndClass(academicYearId, classId);
    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran ini' });
    }

    // Cari record StudentClass
    const studentClassRecord = await StudentClass.findOne({
      where: { student_id: studentId, class_id: classId },
    });
    if (!studentClassRecord) {
      return res.status(404).json({ message: 'Siswa tidak terdaftar di kelas ini' });
    }

    // Hapus — CASCADE di database akan menghapus data terkait
    await studentClassRecord.destroy();

    return res.json({ message: 'Siswa berhasil dihapus dari kelas' });
  } catch (error) {
    console.error('[studentClass/removeStudent] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus siswa dari kelas' });
  }
};