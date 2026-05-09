/**
 * controllers/studentController.js
 *
 * Controller untuk manajemen data siswa oleh admin.
 * Semua endpoint hanya bisa diakses oleh role `admin`.
 * Middleware `accessValidation` dan `roleValidation(['admin'])` sudah dipasang.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /students           → daftar semua siswa (id, name, nisn)
 * POST   /students           → tambah siswa baru
 * PUT    /students/:id       → update data siswa
 * DELETE /students/:id       → hapus siswa
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Validasi NISN menggunakan regex /^\d{8,10}$/ (standar Kemendikbud 10 digit,
 *   namun fleksibel untuk data legacy 8-9 digit). Sesuaikan dengan kebijakan sekolah.
 * - Parent_id bersifat opsional (siswa bisa diinput sebelum akun orang tua dibuat).
 * - Pada update, hanya field yang dikirim yang akan diubah (partial update).
 * - Hapus siswa akan gagal jika memiliki data transaksional (StudentClass, Attendance)
 *   kecuali FK menggunakan ON DELETE CASCADE.
 *
 * @module studentController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op } = require('sequelize');
const { Student } = require('../models');

// ============================================================
// Helper: Validasi Data Siswa
// ============================================================

/**
 * Validasi data siswa untuk operasi create atau update.
 *
 * Aturan validasi:
 *   name       : wajib (untuk create), string, min 2 karakter
 *   nisn       : wajib (untuk create), 8–10 digit angka
 *   birth_date : wajib, format YYYY-MM-DD, tidak di masa depan
 *   parent_id  : opsional (tidak divalidasi)
 *
 * @param {Object} data - { name, nisn, birth_date }
 * @param {boolean} isUpdate - true untuk partial update (field boleh undefined)
 * @returns {{ valid: boolean, message?: string }}
 */
function validateStudentData(data, isUpdate = false) {
  const { name, nisn, birth_date } = data;

  // Nama
  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      return { valid: false, message: 'Nama siswa wajib diisi' };
    }
    if (name.trim().length < 2) {
      return { valid: false, message: 'Nama siswa minimal 2 karakter' };
    }
  }

  // NISN (8–10 digit)
  if (!isUpdate || nisn !== undefined) {
    if (!nisn || typeof nisn !== 'string' || !nisn.trim()) {
      return { valid: false, message: 'NISN wajib diisi' };
    }
    const nisnRegex = /^\d{8,10}$/;
    if (!nisnRegex.test(nisn.trim())) {
      return { valid: false, message: 'NISN harus berupa 8 hingga 10 digit angka' };
    }
  }

  // Tanggal lahir
  if (!isUpdate || birth_date !== undefined) {
    if (!birth_date) {
      return { valid: false, message: 'Tanggal lahir wajib diisi' };
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birth_date) || isNaN(Date.parse(birth_date))) {
      return { valid: false, message: 'Format tanggal lahir tidak valid. Gunakan format YYYY-MM-DD.' };
    }
    if (new Date(birth_date) > new Date()) {
      return { valid: false, message: 'Tanggal lahir tidak boleh di masa depan' };
    }
  }

  return { valid: true };
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /students
 *
 * Mendapatkan daftar semua siswa (id, name, nisn) urut berdasarkan nama A-Z.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.findAll({
      attributes: ['id', 'name', 'nisn'],
      order: [['name', 'ASC']],
      raw: true,
    });
    return res.json(students);
  } catch (error) {
    console.error('[student/getAll] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data siswa' });
  }
};

/**
 * POST /students
 *
 * Menambahkan siswa baru.
 * [Fix H-06] Validasi lengkap + whitelist field.
 *
 * @param {import('express').Request} req - Body: { name, nisn, birth_date, parent_id? }
 * @param {import('express').Response} res
 */
exports.createStudent = async (req, res) => {
  const { name, nisn, birth_date, parent_id } = req.body;

  // Validasi
  const validation = validateStudentData({ name, nisn, birth_date }, false);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    // Cek duplikat NISN
    const existing = await Student.findOne({
      where: { nisn: nisn.trim() },
      attributes: ['id'],
      raw: true,
    });
    if (existing) {
      return res.status(409).json({ message: 'Siswa dengan NISN ini sudah terdaftar' });
    }

    // Whitelist field (hanya yang diizinkan)
    const newStudent = await Student.create({
      name: name.trim(),
      nisn: nisn.trim(),
      birth_date,
      parent_id: parent_id || null,
    });

    return res.status(201).json({
      message: 'Siswa berhasil ditambahkan',
      data: {
        id: newStudent.id,
        name: newStudent.name,
        nisn: newStudent.nisn,
        birth_date: newStudent.birth_date,
        parent_id: newStudent.parent_id,
      },
    });
  } catch (error) {
    console.error('[student/create] Error:', error);
    return res.status(500).json({ message: 'Gagal menambahkan siswa' });
  }
};

/**
 * PUT /students/:id
 *
 * Memperbarui data siswa (partial update).
 * Hanya field yang dikirim yang akan diubah.
 * [Fix H-06] Validasi partial + whitelist update field.
 *
 * @param {import('express').Request} req - Params: { id }, Body: { name?, nisn?, birth_date?, parent_id? }
 * @param {import('express').Response} res
 */
exports.updateStudent = async (req, res) => {
  const { id } = req.params;
  const { name, nisn, birth_date, parent_id } = req.body;

  if (!name && !nisn && !birth_date && parent_id === undefined) {
    return res.status(400).json({
      message: 'Tidak ada data yang diperbarui. Kirimkan setidaknya satu field.',
    });
  }

  // Validasi partial (hanya field yang dikirim)
  const validation = validateStudentData({ name, nisn, birth_date }, true);
  if (!validation.valid) {
    return res.status(400).json({ message: validation.message });
  }

  try {
    const student = await Student.findByPk(id);
    if (!student) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }

    // Cek duplikat NISN jika NISN berubah
    if (nisn && nisn.trim() !== student.nisn) {
      const duplicate = await Student.findOne({
        where: {
          nisn: nisn.trim(),
          id: { [Op.ne]: id },
        },
        attributes: ['id'],
      });
      if (duplicate) {
        return res.status(409).json({ message: 'NISN sudah digunakan oleh siswa lain' });
      }
    }

    // Bangun objek update hanya dari field yang dikirim
    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (nisn) updateFields.nisn = nisn.trim();
    if (birth_date) updateFields.birth_date = birth_date;
    if (parent_id !== undefined) updateFields.parent_id = parent_id || null;

    await student.update(updateFields);

    return res.json({ message: 'Data siswa berhasil diperbarui' });
  } catch (error) {
    console.error('[student/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui data siswa' });
  }
};

/**
 * DELETE /students/:id
 *
 * Menghapus siswa.
 * Peringatan: Penghapusan akan gagal jika siswa memiliki data transaksional
 * (StudentClass, Attendance, StudentGrade) tanpa ON DELETE CASCADE.
 *
 * @param {import('express').Request} req - Params: { id }
 * @param {import('express').Response} res
 */
exports.deleteStudent = async (req, res) => {
  try {
    const deleted = await Student.destroy({ where: { id: req.params.id } });
    if (!deleted) {
      return res.status(404).json({ message: 'Siswa tidak ditemukan' });
    }
    return res.json({ message: 'Siswa berhasil dihapus' });
  } catch (error) {
    console.error('[student/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus siswa' });
  }
};