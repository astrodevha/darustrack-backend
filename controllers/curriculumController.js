/**
 * controllers/curriculumController.js
 *
 * Controller untuk mengelola data kurikulum (satu kurikulum aktif dalam sistem).
 * Sistem hanya mendukung satu kurikulum pada satu waktu. ID kurikulum diketahui
 * dan dapat diupdate melalui endpoint.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /curriculum    → Ambil data kurikulum (tanpa ID)
 * PUT    /curriculum/:id → Update nama dan/atau deskripsi kurikulum
 *
 * ============================================================
 * VALIDASI
 * ============================================================
 * Gunakan fastest-validator untuk validasi input update.
 * - name (opsional, string, tidak boleh kosong)
 * - description (opsional, string, tidak boleh kosong)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Hanya ada satu kurikulum dalam database. Endpoint GET tidak memerlukan ID.
 * - ID untuk update diberikan melalui parameter URL (biasanya 1).
 * - Validasi ID harus berupa angka (karena primary key integer).
 * - Jika suatu saat sistem mendukung multiple curriculum, refactor endpoint GET
 *   untuk menerima parameter id.
 *
 * @module curriculumController
 */

const { Curriculum } = require('../models');
const Validator = require('fastest-validator');
const v = new Validator();

// ============================================================
// Helper Functions
// ============================================================

/**
 * Mendapatkan satu-satunya kurikulum yang tersedia (tanpa perlu ID).
 * @returns {Promise<Object|null>} Data kurikulum atau null
 */
async function getSingleCurriculum() {
  return Curriculum.findOne({
    attributes: ['id', 'name', 'description'],
  });
}

/**
 * Memvalidasi input untuk update kurikulum.
 * @param {Object} data - Data yang akan divalidasi { name?, description? }
 * @returns {Array|null} Array error jika gagal, null jika valid
 */
function validateCurriculumUpdate(data) {
  const schema = {
    name: { type: 'string', optional: true, empty: false },
    description: { type: 'string', optional: true, empty: false },
  };
  const validationResult = v.validate(data, schema);
  return validationResult.length ? validationResult : null;
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /curriculum
 *
 * Mengambil data kurikulum (satu-satunya yang tersedia).
 * Jika belum ada kurikulum, kembalikan objek kosong.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getCurriculum = async (req, res) => {
  try {
    const curriculum = await getSingleCurriculum();
    // Kembalikan objek kosong jika belum ada (bukan error)
    return res.json(curriculum || {});
  } catch (error) {
    console.error('[curriculum/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data kurikulum' });
  }
};

/**
 * PUT /curriculum/:id
 *
 * Memperbarui nama dan/atau deskripsi kurikulum berdasarkan ID.
 * Hanya field yang dikirim yang diupdate (partial update).
 *
 * @param {import('express').Request} req - Params: { id }, Body: { name?, description? }
 * @param {import('express').Response} res
 */
exports.updateCurriculum = async (req, res) => {
  const { id } = req.params;

  // Validasi ID harus angka bulat positif
  const numericId = parseInt(id, 10);
  if (isNaN(numericId) || numericId <= 0) {
    return res.status(400).json({ message: 'ID kurikulum tidak valid' });
  }

  try {
    const curriculum = await Curriculum.findByPk(numericId);
    if (!curriculum) {
      return res.status(404).json({ message: 'Kurikulum tidak ditemukan' });
    }

    const validationErrors = validateCurriculumUpdate(req.body);
    if (validationErrors) {
      return res.status(400).json({ message: 'Validasi gagal', errors: validationErrors });
    }

    // Hanya update field yang dikirim
    const { name, description } = req.body;
    if (name !== undefined) curriculum.name = name;
    if (description !== undefined) curriculum.description = description;
    await curriculum.save();

    return res.status(200).json({
      message: 'Kurikulum berhasil diperbarui',
      data: {
        id: curriculum.id,
        name: curriculum.name,
        description: curriculum.description,
      },
    });
  } catch (error) {
    console.error('[curriculum/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui kurikulum' });
  }
};