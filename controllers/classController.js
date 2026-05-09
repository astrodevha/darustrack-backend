/**
 * controllers/classController.js
 *
 * Controller untuk manajemen kelas dalam tahun ajaran.
 * Mengelola CRUD kelas, daftar kelas per tahun ajaran, kelas aktif,
 * serta kelas yang diampu oleh wali kelas yang sedang login.
 *
 * ============================================================
 * AKSES BERDASARKAN ROLE
 * ============================================================
 * - admin      : Semua operasi CRUD kelas
 * - wali_kelas : Hanya getMyClass (via /teachers/my-class)
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /academic-years/:id/classes         → Daftar kelas per tahun ajaran
 * POST   /academic-years/:id/classes         → Buat kelas baru
 * PUT    /academic-years/classes/:classId    → Update kelas
 * DELETE /academic-years/classes/:classId    → Hapus kelas
 * GET    /classes/active                     → Kelas aktif (opsional filter grade)
 * GET    /teachers/my-class                  → Kelas wali kelas yang login
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Gunakan helper extractGradeLevel untuk mendapatkan tingkat kelas dari nama.
 * - Validasi duplikat nama kelas bersifat case-insensitive.
 * - Teacher_id bersifat opsional (boleh null).
 * - Field `grade_level` dihitung ulang setiap response (tidak disimpan di DB).
 * - Jangan menambahkan field `grade_level` ke model Class tanpa migrasi.
 *
 * @module classController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op } = require('sequelize');
const { AcademicYear, Class } = require('../models');

// ============================================================
// Helper Functions
// ============================================================

/**
 * Ekstrak grade level (angka) dari nama kelas.
 * Contoh: "4A" → 4, "Kelas 6B" → 6, "Al-Fatihah" → null.
 *
 * @param {string} className
 * @returns {number|null}
 */
function extractGradeLevel(className) {
  const match = className.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Validasi nama kelas.
 * @param {string} name - Nama kelas yang akan divalidasi
 * @returns {string|null} Error message jika tidak valid, null jika valid
 */
function validateClassName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Nama kelas wajib diisi';
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return 'Nama kelas minimal 2 karakter';
  }
  if (trimmed.length > 50) {
    return 'Nama kelas maksimal 50 karakter';
  }
  return null;
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /academic-years/:id/classes
 *
 * Daftar kelas dalam tahun ajaran tertentu, urut berdasarkan nama.
 *
 * @param {import('express').Request} req - Params: { id } (academicYearId)
 * @param {import('express').Response} res
 */
exports.getClassesByAcademicYear = async (req, res) => {
  try {
    const academicYear = await AcademicYear.findByPk(req.params.id, {
      include: [
        {
          model: Class,
          as: 'class',
          attributes: ['id', 'name', 'teacher_id'],
        },
      ],
    });

    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }

    const classList = academicYear.class
      .map((cls) => ({
        id: cls.id,
        name: cls.name,
        teacher_id: cls.teacher_id,
        grade_level: extractGradeLevel(cls.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({
      id: academicYear.id,
      year: academicYear.year,
      is_active: academicYear.is_active,
      classes: classList,
    });
  } catch (error) {
    console.error('[class/getByYear] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar kelas' });
  }
};

/**
 * POST /academic-years/:id/classes
 *
 * Buat kelas baru dalam tahun ajaran.
 * [Fix M-10] Validasi input lengkap sebelum operasi DB.
 *
 * @param {import('express').Request} req - Params: { id }, Body: { name, teacher_id? }
 * @param {import('express').Response} res
 */
exports.createClass = async (req, res) => {
  const { name, teacher_id } = req.body;

  // [M-10] Validasi input
  const nameError = validateClassName(name);
  if (nameError) {
    return res.status(400).json({ message: nameError });
  }

  try {
    const academicYear = await AcademicYear.findByPk(req.params.id);
    if (!academicYear) {
      return res.status(404).json({ message: 'Tahun ajaran tidak ditemukan' });
    }

    const trimmedName = name.trim();

    // Cek duplikat nama dalam tahun ajaran yang sama (case-insensitive)
    const existingClass = await Class.findOne({
      where: {
        name: trimmedName,
        academic_year_id: req.params.id,
      },
    });
    if (existingClass) {
      return res.status(409).json({
        message: `Kelas dengan nama '${trimmedName}' sudah ada di tahun ajaran ini`,
      });
    }

    const newClass = await Class.create({
      name: trimmedName,
      teacher_id: teacher_id || null,
      academic_year_id: req.params.id,
    });

    return res.status(201).json({
      message: 'Kelas berhasil dibuat',
      data: {
        id: newClass.id,
        name: newClass.name,
        teacher_id: newClass.teacher_id,
        academic_year_id: newClass.academic_year_id,
        grade_level: extractGradeLevel(newClass.name),
      },
    });
  } catch (error) {
    console.error('[class/create] Error:', error);
    return res.status(500).json({ message: 'Gagal membuat kelas' });
  }
};

/**
 * PUT /academic-years/classes/:classId
 *
 * Update nama dan/atau wali kelas.
 * Semua field bersifat opsional (partial update).
 *
 * @param {import('express').Request} req - Params: { classId }, Body: { name?, teacher_id? }
 * @param {import('express').Response} res
 */
exports.updateClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, teacher_id } = req.body;

    if (!name && teacher_id === undefined) {
      return res.status(400).json({
        message: 'Tidak ada data yang diperbarui. Kirimkan field name atau teacher_id.',
      });
    }

    // Validasi nama jika dikirim
    if (name !== undefined) {
      const nameError = validateClassName(name);
      if (nameError) {
        return res.status(400).json({ message: nameError });
      }
    }

    const existingClass = await Class.findByPk(classId);
    if (!existingClass) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    }

    // Cek duplikat nama dalam tahun ajaran yang sama (kecuali kelas ini sendiri)
    if (name && name.trim() !== existingClass.name) {
      const duplicate = await Class.findOne({
        where: {
          name: name.trim(),
          academic_year_id: existingClass.academic_year_id,
          id: { [Op.ne]: classId },
        },
      });
      if (duplicate) {
        return res.status(409).json({
          message: `Kelas dengan nama '${name.trim()}' sudah ada di tahun ajaran ini`,
        });
      }
      existingClass.name = name.trim();
    }

    if (teacher_id !== undefined) {
      existingClass.teacher_id = teacher_id || null;
    }

    await existingClass.save();

    return res.json({
      message: 'Kelas berhasil diperbarui',
      data: {
        id: existingClass.id,
        name: existingClass.name,
        teacher_id: existingClass.teacher_id,
        grade_level: extractGradeLevel(existingClass.name),
      },
    });
  } catch (error) {
    console.error('[class/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui kelas' });
  }
};

/**
 * DELETE /academic-years/classes/:classId
 *
 * Hapus kelas. Data terkait akan ter-cascade jika FK dikonfigurasi ON DELETE CASCADE.
 *
 * @param {import('express').Request} req - Params: { classId }
 * @param {import('express').Response} res
 */
exports.deleteClass = async (req, res) => {
  try {
    const existingClass = await Class.findByPk(req.params.classId);
    if (!existingClass) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    }

    await existingClass.destroy();
    return res.json({ message: 'Kelas berhasil dihapus' });
  } catch (error) {
    console.error('[class/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus kelas' });
  }
};

/**
 * GET /classes/active?grade_level=4
 *
 * Daftar kelas aktif, opsional filter berdasarkan grade level.
 * Hanya kelas dari tahun ajaran yang sedang aktif.
 *
 * @param {import('express').Request} req - Query: { grade_level? }
 * @param {import('express').Response} res
 */
exports.getActiveClasses = async (req, res) => {
  try {
    const { grade_level } = req.query;

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tidak ada tahun ajaran aktif' });
    }

    const where = { academic_year_id: activeYear.id };

    if (grade_level !== undefined) {
      const gradeStr = String(grade_level).trim();
      if (!/^\d+$/.test(gradeStr)) {
        return res.status(400).json({ message: 'grade_level harus berupa angka' });
      }
      where.name = { [Op.like]: `${gradeStr}%` };
    }

    const classes = await Class.findAll({
      where,
      attributes: ['id', 'name', 'academic_year_id', 'teacher_id'],
      order: [['name', 'ASC']],
    });

    return res.json(
      classes.map((cls) => ({
        ...cls.toJSON(),
        grade_level: extractGradeLevel(cls.name),
      }))
    );
  } catch (error) {
    console.error('[class/getActive] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil daftar kelas aktif' });
  }
};

/**
 * GET /teachers/my-class
 *
 * Kelas yang diampu wali kelas yang sedang login di tahun ajaran aktif.
 *
 * @param {import('express').Request} req - req.user.id dari accessValidation
 * @param {import('express').Response} res
 */
exports.getMyClass = async (req, res) => {
  try {
    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    const myClass = await Class.findOne({
      where: { teacher_id: req.user.id, academic_year_id: activeYear.id },
      attributes: ['id', 'name', 'academic_year_id', 'teacher_id'],
    });

    if (!myClass) {
      return res.status(404).json({ message: 'Anda tidak mengampu kelas di tahun ajaran aktif' });
    }

    return res.json({
      message: 'Kelas berhasil ditemukan',
      data: {
        ...myClass.toJSON(),
        grade_level: extractGradeLevel(myClass.name),
      },
    });
  } catch (error) {
    console.error('[class/getMyClass] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data kelas' });
  }
};