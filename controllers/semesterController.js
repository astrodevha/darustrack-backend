/**
 * controllers/semesterController.js
 *
 * Controller untuk manajemen semester dalam konteks tahun ajaran aktif.
 * Semester dibuat OTOMATIS oleh hook afterCreate pada model AcademicYear
 * (dua semester: Ganjil & Genap) setiap kali tahun ajaran baru dibuat.
 *
 * ============================================================
 * BISNIS RULES
 * ============================================================
 * - Hanya satu semester yang boleh aktif dalam satu tahun ajaran
 * - Hanya semester dari tahun ajaran AKTIF yang bisa diubah statusnya
 * - Mengaktifkan semester X otomatis menonaktifkan semester lain di tahun ajaran yg sama
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET  /semesters                     → semua semester dari tahun ajaran aktif
 * PUT  /academic-years/semesters/:id  → toggle status aktif semester
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Jangan menghapus transaction pada updateSemesterStatus — ini penting untuk
 *   konsistensi data (menghindari 0 semester aktif atau 2 semester aktif).
 * - Jika model Semester memiliki hook audit log, pastikan individualHooks: true
 *   tetap dipertahankan.
 * - Urutan semester default berdasarkan nama (ASC) → "Ganjil" sebelum "Genap".
 *
 * @module semesterController
 */

// ============================================================
// Dependencies
// ============================================================
const { Semester, AcademicYear, sequelize } = require('../models');

// ============================================================
// HELPERS (tidak ada yang perlu di-export)
// ============================================================

/**
 * Memvalidasi dan mengambil semester beserta tahun ajarannya dalam satu query.
 * @param {string} id - ID semester
 * @param {Object} transaction - Sequelize transaction object
 * @returns {Promise<{semester: Semester|null, academicYear: AcademicYear|null}>}
 */
async function getSemesterWithAcademicYear(id, transaction) {
  const semester = await Semester.findByPk(id, { transaction });
  if (!semester) return { semester: null, academicYear: null };
  const academicYear = await AcademicYear.findByPk(semester.academic_year_id, { transaction });
  return { semester, academicYear };
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /semesters
 *
 * Mengembalikan semua semester yang berada di tahun ajaran AKTIF,
 * beserta data tahun ajaran tersemat (id, year, is_active).
 *
 * Digunakan oleh semua role (wali kelas, orang tua, kepala sekolah)
 * untuk mendapatkan konteks semester saat mengakses nilai atau kehadiran.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getActiveSemesters = async (req, res) => {
  try {
    const semesters = await Semester.findAll({
      attributes: ['id', 'name', 'is_active'],
      include: {
        model: AcademicYear,
        as: 'academic_year',
        attributes: ['id', 'year', 'is_active'],
        where: { is_active: true }, // hanya semester dari tahun ajaran aktif
      },
      order: [['name', 'ASC']], // Ganjil sebelum Genap (urutan alfabetis)
    });
    return res.json(semesters);
  } catch (error) {
    console.error('[semester/getActive] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar semester' });
  }
};

/**
 * PUT /academic-years/semesters/:id
 *
 * Mengaktifkan atau menonaktifkan sebuah semester.
 * [Fix M-02] Seluruh operasi dibungkus dalam transaction dan bulk update
 * menggunakan individualHooks: true untuk menjamin konsistensi dan trigger hooks.
 *
 * Alur eksekusi:
 *   1. Validasi input `is_active` (boolean)
 *   2. Cari semester berdasarkan :id (dalam transaction)
 *   3. Pastikan semester berada di tahun ajaran AKTIF
 *   4. Jika akan mengaktifkan: nonaktifkan semua semester lain di tahun ajaran yang sama
 *      (dengan individualHooks: true + dalam transaction yang sama)
 *   5. Aktifkan/nonaktifkan semester target
 *   6. Commit transaction (rollback jika error)
 *
 * @param {import('express').Request} req - Params: { id }, Body: { is_active: boolean }
 * @param {import('express').Response} res
 */
exports.updateSemesterStatus = async (req, res) => {
  const { is_active } = req.body;
  const { id } = req.params;

  // Validasi input
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({
      message: 'Field is_active wajib diisi dan harus berupa boolean (true/false)',
    });
  }

  // Mulai transaction untuk atomicity
  const t = await sequelize.transaction();

  try {
    // Cari semester sekaligus tahun ajarannya (dalam transaction)
    const semester = await Semester.findByPk(id, { transaction: t });
    if (!semester) {
      await t.rollback();
      return res.status(404).json({ message: 'Semester tidak ditemukan' });
    }

    const academicYear = await AcademicYear.findByPk(semester.academic_year_id, { transaction: t });
    if (!academicYear) {
      await t.rollback();
      return res.status(404).json({ message: 'Tahun ajaran untuk semester ini tidak ditemukan' });
    }

    // Hanya semester dari tahun ajaran AKTIF yang boleh diubah statusnya
    if (!academicYear.is_active) {
      await t.rollback();
      return res.status(400).json({
        message: `Semester ini berasal dari tahun ajaran '${academicYear.year}' yang tidak aktif. ` +
                 'Hanya semester dari tahun ajaran aktif yang dapat diubah statusnya.',
      });
    }

    // Jika mengaktifkan semester ini, nonaktifkan semua semester lain di tahun ajaran yang sama
    if (is_active === true) {
      /**
       * [Fix M-02] Bulk update dengan individualHooks: true.
       * - Tanpa opsi ini, hooks model (beforeUpdate/afterUpdate) tidak dijalankan.
       * - Dengan opsi ini, setiap instance yang diupdate akan memicu hooks satu per satu.
       */
      await Semester.update(
        { is_active: false },
        {
          where: { academic_year_id: academicYear.id },
          individualHooks: true,   // ← penting untuk audit log / event
          transaction: t,
        }
      );
    }

    // Update status semester target
    semester.is_active = is_active;
    await semester.save({ transaction: t });

    // Commit semua perubahan
    await t.commit();

    return res.json({
      message: `Semester '${semester.name}' berhasil ${is_active ? 'diaktifkan' : 'dinonaktifkan'}`,
      data: {
        id: semester.id,
        name: semester.name,
        is_active: semester.is_active,
      },
    });
  } catch (error) {
    // Rollback semua perubahan jika terjadi error
    await t.rollback();
    console.error('[semester/updateStatus] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui status semester' });
  }
};