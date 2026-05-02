/**
 * controllers/academicYearController.js
 * ----------------------------------------
 * Controller untuk manajemen tahun ajaran (academic year) oleh admin.
 *
 * Setiap tahun ajaran memiliki dua semester. Hanya SATU tahun ajaran
 * yang boleh aktif pada satu waktu. Saat tahun ajaran diaktifkan,
 * semua tahun ajaran lain (beserta semesternya) dinonaktifkan.
 *
 * Endpoints yang dilayani:
 *  - GET    /academic-years         → Semua tahun ajaran beserta semester
 *  - POST   /academic-years         → Tambah tahun ajaran baru
 *  - PUT    /academic-years/:id     → Update tahun ajaran (nama / status aktif)
 *  - DELETE /academic-years/:id     → Hapus tahun ajaran
 *
 * @module controllers/academicYearController
 */

const { AcademicYear, Semester } = require('../models');

// ── Get all ───────────────────────────────────────────────────────────────────

/**
 * GET /academic-years
 * Mengembalikan semua tahun ajaran beserta semesternya, diurutkan dari terbaru.
 */
exports.getAllAcademicYears = async (req, res) => {
  try {
    const academicYears = await AcademicYear.findAll({
      include: [{ model: Semester, as: 'semester', attributes: ['id', 'name', 'is_active'] }],
      order:   [['year', 'DESC']],
    });

    return res.json(academicYears);
  } catch (error) {
    console.error('[academicYear/getAll] Error:', error.message);
    return res.status(500).json({ message: 'Gagal mengambil data tahun ajaran' });
  }
};

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * POST /academic-years
 * Body: { year: string, is_active?: boolean }
 *
 * Jika `is_active: true`, semua tahun ajaran aktif lain akan dinonaktifkan
 * terlebih dahulu sebelum tahun ajaran baru diaktifkan.
 */
exports.createAcademicYear = async (req, res) => {
  try {
    const { year, is_active = false } = req.body;

    if (!year || year.trim() === '') {
      return res.status(400).json({ message: 'Tahun ajaran wajib diisi' });
    }

    // Cek duplikat
    const existing = await AcademicYear.findOne({ where: { year } });
    if (existing) {
      return res.status(400).json({ message: `Tahun ajaran '${year}' sudah ada` });
    }

    // Nonaktifkan semua tahun ajaran aktif jika baru ini akan menjadi aktif
    if (is_active) {
      const activeYears = await AcademicYear.findAll({ where: { is_active: true } });
      for (const ay of activeYears) {
        await ay.update({ is_active: false });
        await Semester.update({ is_active: false }, { where: { academic_year_id: ay.id } });
      }
    }

    const newAcademicYear = await AcademicYear.create({ year: year.trim(), is_active });

    return res.status(201).json({
      message: `Tahun ajaran berhasil ditambahkan${is_active ? ' dan diaktifkan' : ''}`,
      data:    newAcademicYear,
    });
  } catch (error) {
    console.error('[academicYear/create] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * PUT /academic-years/:id
 * Body: { year?: string, is_active?: boolean }
 *
 * Jika mengaktifkan tahun ajaran ini, semua tahun ajaran LAIN dinonaktifkan.
 * Operasi ini bersifat best-effort — jika kamu butuh atomicity penuh,
 * gunakan transaction.
 */
exports.updateAcademicYear = async (req, res) => {
  try {
    const { id }        = req.params;
    const { year, is_active } = req.body;

    const academicYear = await AcademicYear.findByPk(id);
    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }

    // Jika mengaktifkan tahun ajaran ini, nonaktifkan semua yang lain
    if (is_active) {
      await AcademicYear.update({ is_active: false }, { where: {} });
    }

    // Update nama tahun ajaran jika berubah
    if (year && academicYear.year !== year) {
      const duplicate = await AcademicYear.findOne({ where: { year } });
      if (duplicate && String(duplicate.id) !== String(id)) {
        return res.status(400).json({ message: `Tahun ajaran '${year}' sudah ada` });
      }
      academicYear.year = year;
    }

    if (typeof is_active !== 'undefined') {
      academicYear.is_active = is_active;
    }

    await academicYear.save();
    return res.json({ message: 'Tahun ajaran berhasil diperbarui', data: academicYear });
  } catch (error) {
    console.error('[academicYear/update] Error:', error.message);
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * DELETE /academic-years/:id
 *
 * PERHATIAN: Hapus tahun ajaran akan menghapus semua data terkait
 * (kelas, semester, jadwal, dll.) jika database dikonfigurasi dengan CASCADE.
 * Pastikan penghapusan ini benar-benar disengaja.
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
    console.error('[academicYear/delete] Error:', error.message);
    // Tangkap FK constraint error agar pesan lebih user-friendly
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        message: 'Tahun ajaran tidak bisa dihapus karena masih memiliki data terkait (kelas, semester, dll.)',
      });
    }
    return res.status(500).json({ message: 'Terjadi kesalahan pada server' });
  }
};
