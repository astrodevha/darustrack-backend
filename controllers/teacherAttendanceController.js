/**
 * controllers/teacherAttendanceController.js
 * --------------------------------------------
 * Controller untuk manajemen kehadiran siswa oleh wali kelas.
 *
 * Setiap wali kelas hanya dapat mengakses kehadiran di kelas yang
 * menjadi tanggung jawabnya pada tahun ajaran/semester aktif.
 *
 * Endpoints yang dilayani:
 *  - GET    /teachers/attendances/rekap   → Daftar tanggal yang sudah ada rekapnya
 *  - GET    /teachers/attendances         → Data kehadiran siswa per tanggal
 *  - POST   /teachers/attendances         → Buat sesi kehadiran untuk tanggal baru
 *  - PUT    /teachers/attendances         → Update status kehadiran per siswa
 *  - DELETE /teachers/attendances         → Hapus seluruh kehadiran di suatu tanggal
 *
 * @module controllers/teacherAttendanceController
 */

const { Op }          = require('sequelize');
const { sequelize, Class, AcademicYear, Semester, Student, StudentClass, Attendance } = require('../models');

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Cari kelas yang dikelola wali kelas pada tahun ajaran tertentu.
 * Mengembalikan null jika wali kelas tidak memiliki kelas di tahun ajaran tsb.
 *
 * @param {number} teacherId
 * @param {number} academicYearId
 * @returns {Promise<Class|null>}
 */
async function getTeacherClass(teacherId, academicYearId) {
  return Class.findOne({
    where: { teacher_id: teacherId, academic_year_id: academicYearId },
  });
}

// ── Rekap tanggal kehadiran ───────────────────────────────────────────────────

/**
 * GET /teachers/attendances/rekap
 * Daftar tanggal unik yang sudah memiliki data kehadiran di semester aktif.
 * Berguna untuk menampilkan daftar tanggal yang bisa diedit.
 *
 * @param {import('express').Request}  req - req.activeSemester diisi oleh loadActiveSemester
 * @param {import('express').Response} res
 */
exports.getAttendanceRekap = async (req, res) => {
  try {
    const activeSemester = req.activeSemester;

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Anda tidak mengelola kelas di semester aktif' });
    }

    // Kumpulkan semua student_class_id di kelas ini
    const studentClasses = await StudentClass.findAll({
      where:      { class_id: classData.id },
      attributes: ['id'],
    });

    const studentClassIds = studentClasses.map((sc) => sc.id);
    if (studentClassIds.length === 0) {
      return res.status(404).json({ message: 'Tidak ada siswa di kelas ini' });
    }

    // Ambil tanggal unik yang sudah ada data kehadirannya
    const dates = await Attendance.findAll({
      where: {
        semester_id:      activeSemester.id,
        student_class_id: { [Op.in]: studentClassIds },
      },
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('date')), 'date']],
      order:      [['date', 'DESC']],
      raw:        true,
    });

    return res.json({
      semester_id:  activeSemester.id,
      class_id:     classData.id,
      total_dates:  dates.length,
      dates:        dates.map((d) => d.date),
    });
  } catch (error) {
    console.error('[attendance/rekap] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil rekapan tanggal kehadiran', error: error.message });
  }
};

// ── Ambil kehadiran per tanggal ───────────────────────────────────────────────

/**
 * GET /teachers/attendances?date=YYYY-MM-DD
 * Data kehadiran seluruh siswa pada tanggal tertentu.
 *
 * @param {import('express').Request}  req - Query param: date (required)
 * @param {import('express').Response} res
 */
exports.getAttendances = async (req, res) => {
  try {
    const { date }       = req.query;
    const activeSemester = req.activeSemester;

    if (!date) {
      return res.status(400).json({ message: 'Query parameter "date" wajib diisi' });
    }

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Anda tidak mengelola kelas di semester aktif' });
    }

    const attendances = await Attendance.findAll({
      where: { semester_id: activeSemester.id, date },
      include: [{
        model: StudentClass,
        as:    'student_class',
        where: { class_id: classData.id },
        include: [{
          model:      Student,
          as:         'student',
          attributes: ['id', 'name'],
        }],
      }],
      attributes: ['id', 'student_class_id', 'status', 'date'],
    });

    if (attendances.length === 0) {
      return res.status(404).json({ message: 'Belum ada data kehadiran untuk tanggal tersebut' });
    }

    // Format dan urutkan berdasarkan nama siswa
    const result = attendances
      .map((att) => ({
        attendance_id:    att.id,
        student_class_id: att.student_class_id,
        student_name:     att.student_class.student.name,
        status:           att.status,
        date:             att.date,
      }))
      .sort((a, b) => a.student_name.localeCompare(b.student_name));

    return res.json(result);
  } catch (error) {
    console.error('[attendance/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data kehadiran', error: error.message });
  }
};

// ── Buat sesi kehadiran ───────────────────────────────────────────────────────

/**
 * POST /teachers/attendances
 * Membuat record kehadiran (status "Not Set") untuk semua siswa di kelas
 * pada tanggal yang diberikan. Harus dilakukan sebelum mengisi status kehadiran.
 *
 * @param {import('express').Request}  req - Body: { date: 'YYYY-MM-DD' }
 * @param {import('express').Response} res
 */
exports.createAttendance = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { date }       = req.body;
    const activeSemester = req.activeSemester;

    if (!date) {
      await t.rollback();
      return res.status(400).json({ message: 'Field "date" wajib diisi' });
    }

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      await t.rollback();
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    const myClass = await getTeacherClass(req.user.id, activeYear.id);
    if (!myClass) {
      await t.rollback();
      return res.status(404).json({ message: 'Anda tidak mengelola kelas di tahun ajaran aktif' });
    }

    const studentClasses = await StudentClass.findAll({
      where:      { class_id: myClass.id },
      attributes: ['id'],
    });

    if (!studentClasses.length) {
      await t.rollback();
      return res.status(404).json({ message: 'Tidak ada siswa di kelas ini' });
    }

    const studentClassIds = studentClasses.map((sc) => sc.id);

    // Cek apakah kehadiran untuk tanggal ini sudah ada
    const existing = await Attendance.findOne({
      where: {
        semester_id:      activeSemester.id,
        date,
        student_class_id: { [Op.in]: studentClassIds },
      },
    });

    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: 'Kehadiran untuk tanggal ini sudah ada' });
    }

    // Buat record kehadiran default "Not Set" untuk semua siswa
    const records = studentClassIds.map((id) => ({
      student_class_id: id,
      semester_id:      activeSemester.id,
      date,
      status:           'Not Set',
    }));

    await Attendance.bulkCreate(records, { transaction: t });
    await t.commit();

    return res.status(201).json({ message: 'Sesi kehadiran berhasil dibuat untuk semua siswa' });
  } catch (error) {
    // Rollback jika terjadi error apa pun
    await t.rollback();
    console.error('[attendance/create] Error:', error);
    return res.status(500).json({ message: 'Gagal membuat sesi kehadiran', error: error.message });
  }
};

// ── Update status kehadiran ───────────────────────────────────────────────────

/**
 * PUT /teachers/attendances?date=YYYY-MM-DD
 * Update status kehadiran (Hadir/Sakit/Izin/Alpa/Not Set) per siswa.
 *
 * @param {import('express').Request}  req - Query: date. Body: { attendanceUpdates: [{student_class_id, status}] }
 * @param {import('express').Response} res
 */
exports.updateAttendances = async (req, res) => {
  try {
    const { date }              = req.query;
    const { attendanceUpdates } = req.body;
    const activeSemester        = req.activeSemester;

    // ── Validasi input ──────────────────────────────────────────────────────
    if (!date) {
      return res.status(400).json({ message: 'Query parameter "date" wajib diisi' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date) || isNaN(Date.parse(date))) {
      return res.status(400).json({ message: 'Format tanggal tidak valid (gunakan YYYY-MM-DD)' });
    }

    if (!Array.isArray(attendanceUpdates) || attendanceUpdates.length === 0) {
      return res.status(400).json({ message: 'Body "attendanceUpdates" harus berupa array yang tidak kosong' });
    }

    // ── Cari kelas wali kelas ───────────────────────────────────────────────
    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan untuk wali kelas ini' });
    }

    // Validasi bahwa semua student_class_id yang dikirim memang ada di kelas ini
    const studentClasses = await StudentClass.findAll({
      where:      { class_id: classData.id },
      attributes: ['id'],
    });
    const validIds  = new Set(studentClasses.map((sc) => sc.id));
    const invalidIds = attendanceUpdates.filter((u) => !validIds.has(u.student_class_id));

    if (invalidIds.length > 0) {
      return res.status(400).json({
        message: 'Beberapa student_class_id tidak valid atau bukan milik kelas Anda',
        invalid: invalidIds,
      });
    }

    // ── Ambil semua record kehadiran sekaligus (1 query, hindari N+1) ───────
    const existingAttendances = await Attendance.findAll({
      where: {
        student_class_id: { [Op.in]: [...validIds] },
        semester_id:      activeSemester.id,
        date,
      },
    });

    const attendanceByStudentClassId = {};
    for (const att of existingAttendances) {
      attendanceByStudentClassId[att.student_class_id] = att;
    }

    // ── Update masing-masing record ─────────────────────────────────────────
    const updatePromises = [];
    const notFound       = [];

    for (const update of attendanceUpdates) {
      const att = attendanceByStudentClassId[update.student_class_id];
      if (att) {
        att.status = update.status;
        updatePromises.push(att.save());
      } else {
        notFound.push(update.student_class_id);
      }
    }

    await Promise.all(updatePromises);

    const updatedCount = updatePromises.length;

    // Semua tidak ditemukan → kemungkinan tanggal belum dibuat
    if (updatedCount === 0) {
      return res.status(400).json({
        message:                  'Tanggal kehadiran belum dibuat. Buat sesi kehadiran terlebih dahulu.',
        notFoundStudentClassIds:  notFound,
      });
    }

    const statusCode = notFound.length > 0 ? 206 : 200;
    return res.status(statusCode).json({
      message: notFound.length > 0
        ? `${updatedCount} berhasil diperbarui, ${notFound.length} tidak ditemukan`
        : `${updatedCount} data kehadiran berhasil diperbarui`,
      ...(notFound.length > 0 && { notFoundStudentClassIds: notFound }),
    });
  } catch (error) {
    console.error('[attendance/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui kehadiran', error: error.message });
  }
};

// ── Hapus kehadiran per tanggal ───────────────────────────────────────────────

/**
 * DELETE /teachers/attendances?date=YYYY-MM-DD
 * Menghapus seluruh record kehadiran pada tanggal tertentu untuk kelas ini.
 *
 * @param {import('express').Request}  req - Query: date (required)
 * @param {import('express').Response} res
 */
exports.deleteAttendance = async (req, res) => {
  try {
    const { date }       = req.query;
    const activeSemester = req.activeSemester;

    if (!date) {
      return res.status(400).json({ message: 'Query parameter "date" wajib diisi' });
    }

    const classData = await getTeacherClass(req.user.id, activeSemester.academic_year_id);
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan' });
    }

    const studentClasses = await StudentClass.findAll({
      where:      { class_id: classData.id },
      attributes: ['id'],
    });
    const ids = studentClasses.map((sc) => sc.id);

    const deleted = await Attendance.destroy({
      where: {
        student_class_id: { [Op.in]: ids },
        semester_id:      activeSemester.id,
        date,
      },
    });

    if (deleted === 0) {
      return res.status(404).json({ message: 'Tidak ada data kehadiran untuk tanggal tersebut' });
    }

    return res.json({ message: `${deleted} data kehadiran berhasil dihapus` });
  } catch (error) {
    console.error('[attendance/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus kehadiran', error: error.message });
  }
};
