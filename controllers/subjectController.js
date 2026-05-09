/**
 * controllers/subjectController.js
 *
 * Controller untuk manajemen mata pelajaran (Subject).
 * Subject adalah master data yang digunakan dalam penjadwalan dan penilaian.
 * Subject bersifat global (tidak terikat tahun ajaran atau kelas tertentu).
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /subjects      → daftar semua mata pelajaran
 * GET    /subjects/:id  → detail satu mata pelajaran
 * POST   /subjects      → tambah mata pelajaran baru
 * PUT    /subjects/:id  → update mata pelajaran
 * DELETE /subjects/:id  → hapus mata pelajaran
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Validasi input menggunakan `fastest-validator` dengan schema yang jelas.
 * - Nama mata pelajaran bersifat unik, cek duplikat sebelum insert/update.
 * - Penghapusan mata pelajaran akan gagal jika masih digunakan di tabel lain
 *   (jadwal, kategori nilai) karena foreign key constraint.
 * - Jangan pernah menggunakan `Subject.create(req.body)` atau `update(req.body)`
 *   tanpa whitelist field.
 *
 * @module subjectController
 */

// ============================================================
// Dependencies
// ============================================================
const Validator = require('fastest-validator');
const { Subject } = require('../models');

// Instance validator (dibuat sekali, digunakan ulang)
const v = new Validator();

// ============================================================
// Helper: Validasi Input untuk create & update
// ============================================================

/**
 * Schema validasi untuk input mata pelajaran.
 * Digunakan pada create dan update (dengan optional: true pada update).
 */
const subjectValidationSchema = {
  name: { type: 'string', empty: false },
  description: { type: 'string', optional: true },
};

/**
 * Melakukan validasi data subject menggunakan fastest-validator.
 * @param {Object} data - Data yang akan divalidasi
 * @param {boolean} isUpdate - Jika true, name bersifat opsional
 * @returns {Array|null} Array error jika tidak valid, null jika valid
 */
function validateSubjectData(data, isUpdate = false) {
  const schema = isUpdate
    ? { ...subjectValidationSchema, name: { ...subjectValidationSchema.name, optional: true } }
    : subjectValidationSchema;
  const errors = v.validate(data, schema);
  return errors.length ? errors : null;
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /subjects
 *
 * Daftar semua mata pelajaran, diurutkan alfabetis berdasarkan nama.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.listSubjects = async (req, res) => {
  try {
    const subjects = await Subject.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });
    return res.json(subjects);
  } catch (error) {
    console.error('[subject/list] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar mata pelajaran' });
  }
};

/**
 * GET /subjects/:id
 *
 * Detail satu mata pelajaran berdasarkan ID.
 *
 * @param {import('express').Request} req - Params: { id }
 * @param {import('express').Response} res
 */
exports.getSubject = async (req, res) => {
  const { id } = req.params;
  try {
    const subject = await Subject.findByPk(id, {
      attributes: ['id', 'name', 'description'],
    });
    if (!subject) {
      return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan' });
    }
    return res.json(subject);
  } catch (error) {
    console.error('[subject/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data mata pelajaran' });
  }
};

/**
 * POST /subjects
 *
 * Menambahkan mata pelajaran baru.
 * Nama mata pelajaran harus unik.
 *
 * [Fix BUG #39] Whitelist field `name` dan `description`.
 *
 * @param {import('express').Request} req - Body: { name, description? }
 * @param {import('express').Response} res
 */
exports.createSubject = async (req, res) => {
  try {
    // Validasi input
    const errors = validateSubjectData(req.body, false);
    if (errors) {
      return res.status(400).json({ message: 'Data tidak valid', errors });
    }

    const { name, description } = req.body;
    const trimmedName = name.trim();

    // Cek duplikat nama (case-sensitive, sesuai collation database)
    const existing = await Subject.findOne({ where: { name: trimmedName } });
    if (existing) {
      return res.status(409).json({ message: `Mata pelajaran '${trimmedName}' sudah ada` });
    }

    // Whitelist field
    const newSubject = await Subject.create({
      name: trimmedName,
      description: description || null,
    });

    return res.status(201).json({
      message: 'Mata pelajaran berhasil ditambahkan',
      data: { id: newSubject.id, name: newSubject.name },
    });
  } catch (error) {
    console.error('[subject/create] Error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Nama mata pelajaran sudah digunakan' });
    }
    return res.status(500).json({ message: 'Gagal menambahkan mata pelajaran' });
  }
};

/**
 * PUT /subjects/:id
 *
 * Memperbarui mata pelajaran (partial update).
 * Hanya field yang dikirim (`name` dan/atau `description`) yang diubah.
 *
 * [Fix BUG #39] Whitelist field – tidak menggunakan `update(req.body)`.
 *
 * @param {import('express').Request} req - Params: { id }, Body: { name?, description? }
 * @param {import('express').Response} res
 */
exports.updateSubject = async (req, res) => {
  const { id } = req.params;
  try {
    // Validasi input (name optional karena partial update)
    const errors = validateSubjectData(req.body, true);
    if (errors) {
      return res.status(400).json({ message: 'Data tidak valid', errors });
    }

    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan' });
    }

    const { name, description } = req.body;

    // Update nama jika dikirim dan berbeda
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName !== subject.name) {
        const duplicate = await Subject.findOne({ where: { name: trimmedName } });
        if (duplicate && duplicate.id !== subject.id) {
          return res.status(409).json({ message: `Nama mata pelajaran '${trimmedName}' sudah digunakan` });
        }
        subject.name = trimmedName;
      }
    }

    // Update deskripsi jika dikirim
    if (description !== undefined) {
      subject.description = description;
    }

    await subject.save();

    return res.json({
      message: 'Mata pelajaran berhasil diperbarui',
      data: { id: subject.id, name: subject.name, description: subject.description },
    });
  } catch (error) {
    console.error('[subject/update] Error:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'Nama mata pelajaran sudah digunakan' });
    }
    return res.status(500).json({ message: 'Gagal memperbarui mata pelajaran' });
  }
};

/**
 * DELETE /subjects/:id
 *
 * Menghapus mata pelajaran.
 * Penghapusan akan gagal jika masih digunakan dalam jadwal atau kategori nilai
 * (foreign key constraint).
 *
 * @param {import('express').Request} req - Params: { id }
 * @param {import('express').Response} res
 */
exports.deleteSubject = async (req, res) => {
  const { id } = req.params;
  try {
    const subject = await Subject.findByPk(id);
    if (!subject) {
      return res.status(404).json({ message: 'Mata pelajaran tidak ditemukan' });
    }
    await subject.destroy();
    return res.json({ message: 'Mata pelajaran berhasil dihapus' });
  } catch (error) {
    console.error('[subject/delete] Error:', error);
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        message: 'Mata pelajaran tidak dapat dihapus karena masih digunakan dalam jadwal atau kategori nilai',
      });
    }
    return res.status(500).json({ message: 'Gagal menghapus mata pelajaran' });
  }
};