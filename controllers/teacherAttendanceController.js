/**
 * controllers/teacherAttendanceController.js
 *
 * Controller untuk manajemen kehadiran siswa oleh wali kelas.
 * Setiap wali kelas hanya dapat mengakses kehadiran di kelas yang menjadi
 * tanggung jawabnya pada tahun ajaran/semester aktif.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /teachers/attendances/rekap   → daftar tanggal yang sudah ada rekapnya
 * GET    /teachers/attendances?date=   → data kehadiran siswa per tanggal
 * POST   /teachers/attendances         → buat sesi kehadiran untuk tanggal baru
 * PUT    /teachers/attendances?date=   → update status kehadiran per siswa
 * DELETE /teachers/attendances?date=   → hapus seluruh kehadiran di suatu tanggal
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Gunakan helper validateDateParam() untuk semua endpoint yang menerima date.
 * - Rekap endpoint menggunakan `req.activeSemester` dari middleware loadActiveSemester.
 * - DELETE endpoint harus melewati validasi yang sama dengan GET/PUT.
 * - Whitelist status kehadiran: ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Not Set'].
 * - Batasi jumlah update per request (default 100) untuk mencegah overload.
 *
 * @module teacherAttendanceController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op } = require('sequelize');
const {
  sequelize,
  Class,
  AcademicYear,
  StudentClass,
  Student,
  Attendance,
} = require('../models');

// ============================================================
// Constants
// ============================================================

/** Status kehadiran yang diizinkan */
const VALID_ATTENDANCE_STATUS = ['Hadir', 'Izin', 'Sakit', 'Alpa', 'Not Set'];

/** Regex format tanggal YYYY-MM-DD */
const DATE_FORMAT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Batas maksimum update kehadiran per request */
const MAX_ATTENDANCE_UPDATES = 100;

// ============================================================
// Helper Functions
// ============================================================

/**
 * Mendapatkan kelas yang dikelola wali kelas pada tahun ajaran tertentu.
 *
 * @param {string} teacherId - ID user wali kelas (req.user.id)
 * @param {number} academicYearId - ID tahun ajaran aktif
 * @returns {Promise<Class|null>}
 */
async function getTeacherClass(teacherId, academicYearId) {
  return Class.findOne({
    where: { teacher_id: teacherId, academic_year_id: academicYearId },
    attributes: ['id', 'name'],
  });
}

/**
 * Validasi format dan keabsahan tanggal.
 *
 * @param {string|undefined} date - Nilai tanggal yang akan divalidasi
 * @returns {{ valid: boolean, message?: string }}
 */
function validateDateParam(date) {
  if (!date) {
    return { valid: false, message: 'Parameter tanggal wajib diisi' };
  }
  if (!DATE_FORMAT_REGEX.test(date)) {
    return { valid: false, message: 'Format tanggal tidak valid. Gunakan format YYYY-MM-DD.' };
  }
  if (isNaN(Date.parse(date))) {
    return { valid: false, message: 'Tanggal tidak valid (misal: bulan atau hari di luar jangkauan).' };
  }
  return { valid: true };
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /teachers/attendances/rekap
 *
 * Daftar tanggal unik yang sudah memiliki data kehadiran di semester aktif.
 *
 * @param {import('express').Request} req - req.activeSemester dari middleware loadActiveSemester
 * @param {import('express').Response} res
 */
exports.getAttendanceRekap = async (req, res) => {
  try {
    const activeSemester = req.activeSemester;

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Anda tidak mengelola kelas di semester aktif' });
    }

    const studentClasses = await StudentClass.findAll({
      where: { class_id: classData.id },
      attributes: ['id'],
    });

    if (!studentClasses.length) {
      return res.json({
        semester_id: activeSemester.id,
        class_id: classData.id,
        class_name: classData.name,
        total_dates: 0,
        dates: [],
      });
    }

    const studentClassIds = studentClasses.map(sc => sc.id);

    const dates = await Attendance.findAll({
      where: {
        semester_id: activeSemester.id,
        student_class_id: { [Op.in]: studentClassIds },
      },
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('date')), 'date']],
      order: [['date', 'DESC']],
      raw: true,
    });

    return res.json({
      semester_id: activeSemester.id,
      class_id: classData.id,
      class_name: classData.name,
      total_dates: dates.length,
      dates: dates.map(d => d.date),
    });
  } catch (error) {
    console.error('[attendance/rekap] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil rekap tanggal kehadiran' });
  }
};

/**
 * GET /teachers/attendances
 *
 * Data kehadiran seluruh siswa pada tanggal tertentu.
 *
 * @param {import('express').Request} req - Query: { date }
 * @param {import('express').Response} res
 */
exports.getAttendances = async (req, res) => {
  try {
    const { date } = req.query;
    const activeSemester = req.activeSemester;

    const validation = validateDateParam(date);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Anda tidak mengelola kelas di semester aktif' });
    }

    const attendances = await Attendance.findAll({
      where: { semester_id: activeSemester.id, date },
      include: [{
        model: StudentClass,
        as: 'student_class',
        where: { class_id: classData.id },
        include: [{
          model: Student,
          as: 'student',
          attributes: ['id', 'name'],
        }],
      }],
      attributes: ['id', 'student_class_id', 'status', 'date'],
    });

    if (!attendances.length) {
      return res.status(404).json({ message: 'Belum ada data kehadiran untuk tanggal tersebut' });
    }

    const result = attendances
      .map(att => ({
        attendance_id: att.id,
        student_class_id: att.student_class_id,
        student_name: att.student_class?.student?.name ?? null,
        status: att.status,
        date: att.date,
      }))
      .sort((a, b) => (a.student_name ?? '').localeCompare(b.student_name ?? ''));

    return res.json(result);
  } catch (error) {
    console.error('[attendance/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data kehadiran' });
  }
};

/**
 * POST /teachers/attendances
 *
 * Membuat sesi kehadiran (status 'Not Set') untuk semua siswa di kelas pada tanggal yang diberikan.
 *
 * @param {import('express').Request} req - Body: { date }
 * @param {import('express').Response} res
 */
exports.createAttendance = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { date } = req.body;
    const activeSemester = req.activeSemester;

    const validation = validateDateParam(date);
    if (!validation.valid) {
      await t.rollback();
      return res.status(400).json({ message: validation.message });
    }

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      await t.rollback();
      return res.status(404).json({ message: 'Anda tidak mengelola kelas di semester aktif' });
    }

    const studentClasses = await StudentClass.findAll({
      where: { class_id: classData.id },
      attributes: ['id'],
      transaction: t,
    });

    if (!studentClasses.length) {
      await t.rollback();
      return res.status(404).json({ message: 'Tidak ada siswa terdaftar di kelas ini' });
    }

    const studentClassIds = studentClasses.map(sc => sc.id);

    const existing = await Attendance.findOne({
      where: {
        semester_id: activeSemester.id,
        date,
        student_class_id: { [Op.in]: studentClassIds },
      },
      transaction: t,
    });

    if (existing) {
      await t.rollback();
      return res.status(409).json({
        message: `Sesi kehadiran untuk tanggal ${date} sudah ada. Gunakan PUT untuk mengubah status kehadiran.`,
      });
    }

    const records = studentClassIds.map(id => ({
      student_class_id: id,
      semester_id: activeSemester.id,
      date,
      status: 'Not Set',
    }));

    await Attendance.bulkCreate(records, { transaction: t });
    await t.commit();

    return res.status(201).json({
      message: `Sesi kehadiran berhasil dibuat untuk ${studentClassIds.length} siswa`,
      date,
      total_students: studentClassIds.length,
    });
  } catch (error) {
    await t.rollback();
    console.error('[attendance/create] Error:', error);
    return res.status(500).json({ message: 'Gagal membuat sesi kehadiran' });
  }
};

/**
 * PUT /teachers/attendances
 *
 * Update status kehadiran (Hadir/Sakit/Izin/Alpa/Not Set) per siswa.
 * Menggunakan bulk fetch + parallel update untuk efisiensi.
 *
 * @param {import('express').Request} req - Query: { date }, Body: { attendanceUpdates: [{ student_class_id, status }] }
 * @param {import('express').Response} res
 */
exports.updateAttendances = async (req, res) => {
  try {
    const { date } = req.query;
    const { attendanceUpdates } = req.body;
    const activeSemester = req.activeSemester;

    const dateValidation = validateDateParam(date);
    if (!dateValidation.valid) {
      return res.status(400).json({ message: dateValidation.message });
    }

    if (!Array.isArray(attendanceUpdates) || attendanceUpdates.length === 0) {
      return res.status(400).json({
        message: 'Field "attendanceUpdates" harus berupa array yang tidak kosong',
      });
    }
    if (attendanceUpdates.length > MAX_ATTENDANCE_UPDATES) {
      return res.status(400).json({
        message: `Maksimal ${MAX_ATTENDANCE_UPDATES} update kehadiran per request`,
      });
    }

    const invalidItems = attendanceUpdates.filter(u => !VALID_ATTENDANCE_STATUS.includes(u.status));
    if (invalidItems.length > 0) {
      return res.status(400).json({
        message: `Status tidak valid. Nilai yang diizinkan: ${VALID_ATTENDANCE_STATUS.join(', ')}`,
        invalid: invalidItems.map(u => ({ student_class_id: u.student_class_id, status: u.status })),
      });
    }

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan untuk wali kelas ini' });
    }

    const studentClasses = await StudentClass.findAll({
      where: { class_id: classData.id },
      attributes: ['id'],
    });
    const validIdSet = new Set(studentClasses.map(sc => sc.id));

    const unauthorizedItems = attendanceUpdates.filter(u => !validIdSet.has(u.student_class_id));
    if (unauthorizedItems.length > 0) {
      return res.status(403).json({
        message: 'Beberapa student_class_id tidak valid atau bukan milik kelas Anda',
        invalid: unauthorizedItems.map(u => u.student_class_id),
      });
    }

    const requestedIds = attendanceUpdates.map(u => u.student_class_id);
    const existingAttendances = await Attendance.findAll({
      where: {
        student_class_id: { [Op.in]: requestedIds },
        semester_id: activeSemester.id,
        date,
      },
    });

    const attendanceMap = {};
    for (const att of existingAttendances) {
      attendanceMap[att.student_class_id] = att;
    }

    const updatePromises = [];
    const notFound = [];

    for (const update of attendanceUpdates) {
      const att = attendanceMap[update.student_class_id];
      if (att) {
        att.status = update.status;
        updatePromises.push(att.save());
      } else {
        notFound.push(update.student_class_id);
      }
    }

    await Promise.all(updatePromises);
    const updatedCount = updatePromises.length;

    if (updatedCount === 0) {
      return res.status(404).json({
        message: `Belum ada sesi kehadiran untuk tanggal ${date}. Buat sesi terlebih dahulu via POST /teachers/attendances.`,
        notFoundStudentClassIds: notFound,
      });
    }

    const statusCode = notFound.length > 0 ? 206 : 200;
    return res.status(statusCode).json({
      message: notFound.length > 0
        ? `${updatedCount} kehadiran berhasil diperbarui, ${notFound.length} tidak ditemukan`
        : `${updatedCount} data kehadiran berhasil diperbarui`,
      ...(notFound.length > 0 && { notFoundStudentClassIds: notFound }),
    });
  } catch (error) {
    console.error('[attendance/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui data kehadiran' });
  }
};

/**
 * DELETE /teachers/attendances
 *
 * Menghapus seluruh record kehadiran pada tanggal tertentu untuk kelas ini.
 * [Fix M-06] Validasi format tanggal yang konsisten dengan GET dan PUT.
 *
 * @param {import('express').Request} req - Query: { date }
 * @param {import('express').Response} res
 */
exports.deleteAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    const activeSemester = req.activeSemester;

    const validation = validateDateParam(date);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan untuk wali kelas ini' });
    }

    const studentClasses = await StudentClass.findAll({
      where: { class_id: classData.id },
      attributes: ['id'],
    });

    if (!studentClasses.length) {
      return res.status(404).json({ message: 'Tidak ada siswa terdaftar di kelas ini' });
    }

    const ids = studentClasses.map(sc => sc.id);

    const deleted = await Attendance.destroy({
      where: {
        student_class_id: { [Op.in]: ids },
        semester_id: activeSemester.id,
        date,
      },
    });

    if (deleted === 0) {
      return res.status(404).json({
        message: `Tidak ada data kehadiran untuk tanggal ${date}`,
      });
    }

    return res.json({
      message: `${deleted} data kehadiran untuk tanggal ${date} berhasil dihapus`,
      deleted_count: deleted,
      date,
    });
  } catch (error) {
    console.error('[attendance/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus data kehadiran' });
  }
};