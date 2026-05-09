/**
 * controllers/academicYearController.js
 *
 * Controller untuk manajemen tahun ajaran oleh admin.
 *
 * ============================================================
 * BISNIS RULES
 * ============================================================
 * - Hanya satu tahun ajaran yang boleh aktif pada satu waktu
 * - Saat tahun ajaran dibuat, dua semester (Ganjil & Genap) dibuat otomatis
 * - Saat tahun ajaran diaktifkan, semua tahun ajaran lain dinonaktifkan
 * - Penghapusan tahun ajaran yang masih memiliki data terkait ditolak (FK constraint)
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /academic-years         → Daftar semua tahun ajaran + semester
 * POST   /academic-years         → Tambah tahun ajaran baru
 * PUT    /academic-years/:id     → Update tahun ajaran (nama / status aktif)
 * DELETE /academic-years/:id     → Hapus tahun ajaran
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Selalu gunakan `individualHooks: true` saat melakukan bulk update AcademicYear
 *   agar hook yang menjaga konsistensi semester selalu terpicu.
 * - Operasi yang mengubah status `is_active` HARUS dibungkus dalam transaction.
 *
 * @module academicYearController
 */

// ============================================================
// Dependencies
// ============================================================
const { AcademicYear, Semester, sequelize } = require('../models');

// ============================================================
// Helper Functions
// ============================================================

/**
 * Validasi format tahun ajaran.
 * Format yang diterima: string non-kosong, maksimal 50 karakter (contoh: "2024/2025").
 *
 * @param {string} year - Nilai tahun yang akan divalidasi
 * @returns {string|null} Tahun yang sudah di-trim, atau null jika tidak valid
 */
function validateYear(year) {
  if (!year || typeof year !== 'string') return null;
  const trimmed = year.trim();
  if (trimmed.length === 0 || trimmed.length > 50) return null;
  return trimmed;
}

/**
 * Cek apakah tahun ajaran sudah ada di database.
 * @param {string} year - Tahun ajaran yang akan dicek
 * @param {Object} transaction - Transaction object (opsional)
 * @returns {Promise<boolean>}
 */
async function isYearExists(year, transaction = null) {
  const existing = await AcademicYear.findOne({
    where: { year },
    transaction,
  });
  return !!existing;
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /academic-years
 *
 * Mengembalikan semua tahun ajaran beserta semesternya, diurutkan dari terbaru.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getAllAcademicYears = async (req, res) => {
  try {
    const academicYears = await AcademicYear.findAll({
      include: [
        {
          model: Semester,
          as: 'semester',
          attributes: ['id', 'name', 'is_active'],
        },
      ],
      order: [['year', 'DESC']],
    });

    return res.json(academicYears);
  } catch (error) {
    console.error('[academicYear/getAll] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data tahun ajaran' });
  }
};

/**
 * POST /academic-years
 *
 * Menambahkan tahun ajaran baru.
 * Jika `is_active: true`, tahun ajaran lain akan dinonaktifkan terlebih dahulu
 * dalam satu transaction yang sama.
 *
 * Semester Ganjil dan Genap dibuat secara manual di controller ini.
 * (Catatan: Model AcademicYear juga memiliki hook afterCreate yang membuat semester,
 *  pastikan tidak terjadi duplikasi – sesuaikan dengan implementasi model yang digunakan.)
 *
 * @param {import('express').Request} req - Body: { year: string, is_active?: boolean }
 * @param {import('express').Response} res
 */
exports.createAcademicYear = async (req, res) => {
  const { year, is_active = false } = req.body;

  // Validasi input
  const validatedYear = validateYear(year);
  if (!validatedYear) {
    return res.status(400).json({ message: 'Tahun ajaran wajib diisi (max 50 karakter)' });
  }

  const t = await sequelize.transaction();
  try {
    // Cek duplikasi
    const exists = await isYearExists(validatedYear, t);
    if (exists) {
      await t.rollback();
      return res.status(400).json({ message: `Tahun ajaran '${validatedYear}' sudah ada` });
    }

    // Jika akan diaktifkan, nonaktifkan semua tahun ajaran lain terlebih dahulu
    if (is_active === true) {
      await AcademicYear.update(
        { is_active: false },
        { where: { is_active: true }, transaction: t }
      );
    }

    // Buat tahun ajaran baru
    const newAcademicYear = await AcademicYear.create(
      { year: validatedYear, is_active },
      { transaction: t }
    );

    // Buat dua semester (Ganjil dan Genap)
    await Semester.bulkCreate(
      [
        {
          name: 'Ganjil',
          academic_year_id: newAcademicYear.id,
          is_active: newAcademicYear.is_active,
        },
        {
          name: 'Genap',
          academic_year_id: newAcademicYear.id,
          is_active: false,
        },
      ],
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      message: `Tahun ajaran berhasil ditambahkan${is_active ? ' dan diaktifkan' : ''}`,
      data: newAcademicYear,
    });
  } catch (error) {
    await t.rollback();
    console.error('[academicYear/create] Error:', error);
    return res.status(500).json({ message: 'Gagal menambahkan tahun ajaran' });
  }
};

/**
 * PUT /academic-years/:id
 *
 * Update nama tahun ajaran atau status aktifnya.
 *
 * Jika `is_active` diubah menjadi `true`:
 *   1. Semua tahun ajaran lain dinonaktifkan (beserta semesternya via hook)
 *   2. Tahun ajaran ini diaktifkan (beserta semester Ganjil-nya via hook)
 *
 * Semua operasi ini dibungkus dalam satu transaction untuk atomicity.
 *
 * [BUG #27] individualHooks: true memastikan hook beforeUpdate terpicu.
 * [BUG #30] Semua operasi status dalam satu transaction.
 *
 * @param {import('express').Request} req - Params: id. Body: { year?, is_active? }
 * @param {import('express').Response} res
 */
exports.updateAcademicYear = async (req, res) => {
  const { id } = req.params;
  const { year, is_active } = req.body;

  const t = await sequelize.transaction();
  try {
    const academicYear = await AcademicYear.findByPk(id, { transaction: t });
    if (!academicYear) {
      await t.rollback();
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }

    // Update nama jika dikirim dan berbeda
    if (year !== undefined) {
      const validatedYear = validateYear(year);
      if (!validatedYear) {
        await t.rollback();
        return res.status(400).json({ message: 'Format tahun ajaran tidak valid (max 50 karakter)' });
      }
      if (validatedYear !== academicYear.year) {
        const duplicate = await isYearExists(validatedYear, t);
        if (duplicate) {
          await t.rollback();
          return res.status(400).json({ message: `Tahun ajaran '${validatedYear}' sudah ada` });
        }
        academicYear.year = validatedYear;
      }
    }

    // Update status aktif jika dikirim dan berbeda
    if (typeof is_active !== 'undefined' && is_active !== academicYear.is_active) {
      if (is_active === true) {
        // Nonaktifkan semua tahun ajaran lain (termasuk semesternya via hook)
        await AcademicYear.update(
          { is_active: false },
          {
            where: { is_active: true },
            individualHooks: true, // ← Kunci agar hook beforeUpdate terpicu per instance
            transaction: t,
          }
        );
      }
      academicYear.is_active = is_active;
    }

    // Simpan instance (akan memicu beforeUpdate hook)
    await academicYear.save({ transaction: t });

    await t.commit();

    return res.json({
      message: 'Tahun ajaran berhasil diperbarui',
      data: academicYear,
    });
  } catch (error) {
    await t.rollback();
    console.error('[academicYear/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui tahun ajaran' });
  }
};

/**
 * DELETE /academic-years/:id
 *
 * Menghapus tahun ajaran beserta semua data terkait (via CASCADE di database).
 *
 * PERINGATAN: Operasi ini bersifat permanen dan menghapus semua data dalam
 * tahun ajaran ini termasuk kelas, semester, jadwal, nilai, kehadiran, dan evaluasi.
 * Pastikan ini benar-benar disengaja sebelum dipanggil.
 *
 * @param {import('express').Request} req - Params: id
 * @param {import('express').Response} res
 */
exports.deleteAcademicYear = async (req, res) => {
  try {
    const academicYear = await AcademicYear.findByPk(req.params.id);
    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }

    await academicYear.destroy();
    return res.json({ message: 'Tahun ajaran berhasil dihapus' });
  } catch (error) {
    console.error('[academicYear/delete] Error:', error);

    // Tangani foreign key constraint (masih ada data terkait)
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        message:
          'Tahun ajaran tidak dapat dihapus karena masih memiliki data terkait ' +
          '(kelas, semester, jadwal, dll.). Hapus data terkait terlebih dahulu.',
      });
    }

    return res.status(500).json({ message: 'Gagal menghapus tahun ajaran' });
  }
};