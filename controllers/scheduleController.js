/**
 * controllers/scheduleController.js
 * -----------------------------------
 * Controller untuk manajemen jadwal pelajaran per kelas.
 *
 * Endpoints yang dilayani:
 *  - GET    /academic-years/:id/classes/:class_id/schedules?day= → Jadwal satu kelas
 *  - POST   /academic-years/:id/classes/:class_id/schedules      → Tambah jadwal
 *  - PUT    /schedules/:schedule_id                               → Edit jadwal
 *  - DELETE /schedules/:schedule_id                               → Hapus jadwal
 *  - GET    /teachers/schedules?day=                             → Jadwal kelas wali kelas (digunakan oleh teachers router)
 *
 * Conflict checking:
 *  Saat menambah atau mengedit jadwal, controller memeriksa apakah ada
 *  jadwal lain yang waktu-nya tumpang tindih di kelas dan hari yang sama.
 *
 * @module controllers/scheduleController
 */

const { Class, AcademicYear, Schedule, Subject } = require('../models');
const { Op } = require('sequelize');

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Map nama hari dari English ke Indonesian (untuk konsistensi data di DB).
 * Jika hari sudah dalam format Indonesia, dikembalikan apa adanya.
 *
 * @param {string} day - Nama hari (contoh: "Monday" atau "Senin")
 * @returns {string}
 */
const DAY_MAP_EN_TO_ID = {
  Monday: 'Senin', Tuesday: 'Selasa', Wednesday: 'Rabu',
  Thursday: 'Kamis', Friday: 'Jumat', Saturday: 'Sabtu', Sunday: 'Minggu',
};

function normalizeDay(day) {
  return DAY_MAP_EN_TO_ID[day] || day;
}

/**
 * Cek apakah ada jadwal lain yang waktunya bertabrakan di kelas dan hari yang sama.
 * Menggunakan logika interval overlap: [s1, e1] dan [s2, e2] overlap jika s1 < e2 && s2 < e1.
 *
 * @param {number}      classId
 * @param {string}      day
 * @param {string}      startTime
 * @param {string}      endTime
 * @param {number|null} excludeId - ID jadwal yang dikecualikan (untuk kasus edit)
 * @returns {Promise<boolean>} true jika ada konflik
 */
async function hasTimeConflict(classId, day, startTime, endTime, excludeId = null) {
  const where = {
    class_id: classId,
    day,
    [Op.or]: [
      { start_time: { [Op.between]: [startTime, endTime] } },
      { end_time:   { [Op.between]: [startTime, endTime] } },
      {
        [Op.and]: [
          { start_time: { [Op.lte]: startTime } },
          { end_time:   { [Op.gte]: endTime   } },
        ],
      },
    ],
  };

  if (excludeId) where.id = { [Op.ne]: excludeId };

  const conflict = await Schedule.findOne({ where });
  return !!conflict;
}

// ── Get schedules ─────────────────────────────────────────────────────────────

/**
 * GET /academic-years/:id/classes/:class_id/schedules?day=Senin
 * Mengambil jadwal untuk satu kelas. Filter hari opsional.
 *
 * CATATAN (Bug yang diperbaiki di versi ini):
 * Versi lama memiliki SIDE EFFECT berbahaya: fungsi GET ini diam-diam
 * MENGHAPUS jadwal dari tahun ajaran non-aktif setiap kali dipanggil.
 * Ini melanggar prinsip least surprise — GET seharusnya bersifat read-only.
 * Side effect tersebut sudah dihapus.
 */
exports.getClassSchedules = async (req, res) => {
  try {
    const { class_id } = req.params;
    const { day }      = req.query;

    // Verifikasi kelas ada di tahun ajaran aktif
    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    const classData = await Class.findOne({
      where: { id: class_id, academic_year_id: activeYear.id },
    });
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran aktif' });
    }

    const where = { class_id };
    if (day) where.day = day;

    const schedules = await Schedule.findAll({
      where,
      include: [{ model: Subject, as: 'subject', attributes: ['name'] }],
      order:   [['day', 'ASC'], ['start_time', 'ASC']],
    });

    return res.json(schedules);
  } catch (error) {
    console.error('[schedule/get] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil jadwal', error: error.message });
  }
};

// ── Create schedule ───────────────────────────────────────────────────────────

/**
 * POST /academic-years/:id/classes/:class_id/schedules
 * Body: { subject_id, day, start_time, end_time }
 */
exports.createSchedule = async (req, res) => {
  try {
    let { subject_id, day, start_time, end_time } = req.body;
    const { class_id } = req.params;

    // Normalisasi nama hari ke Bahasa Indonesia
    day = normalizeDay(day);

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    const classData = await Class.findOne({
      where: { id: class_id, academic_year_id: activeYear.id },
    });
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran aktif' });
    }

    // Cek apakah ada jadwal yang bentrok
    const conflict = await hasTimeConflict(class_id, day, start_time, end_time);
    if (conflict) {
      return res.status(400).json({
        message: 'Terdapat jadwal lain yang bentrok pada hari dan jam tersebut',
      });
    }

    const schedule = await Schedule.create({ class_id, subject_id, day, start_time, end_time });
    return res.status(201).json({ message: 'Jadwal berhasil ditambahkan', schedule });
  } catch (error) {
    console.error('[schedule/create] Error:', error);
    return res.status(500).json({ message: 'Gagal menambahkan jadwal', error: error.message });
  }
};

// ── Update schedule ───────────────────────────────────────────────────────────

/**
 * PUT /schedules/:schedule_id
 * Body: { subject_id?, day?, start_time?, end_time? }
 * Semua field bersifat opsional — hanya field yang dikirim yang diupdate.
 */
exports.updateSchedule = async (req, res) => {
  try {
    const { schedule_id }                  = req.params;
    const { subject_id, day, start_time, end_time } = req.body;

    // Jika salah satu dari start/end diubah, keduanya harus disertakan
    if ((start_time && !end_time) || (!start_time && end_time)) {
      return res.status(400).json({
        message: 'start_time dan end_time harus diisi bersamaan jika salah satunya diubah',
      });
    }

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    // Cari jadwal dan pastikan kelasnya ada di tahun ajaran aktif
    const schedule = await Schedule.findOne({
      where:   { id: schedule_id },
      include: {
        model: Class,
        as:    'class',
        where: { academic_year_id: activeYear.id },
      },
    });
    if (!schedule) {
      return res.status(404).json({ message: 'Jadwal tidak ditemukan di tahun ajaran aktif' });
    }

    // Cek bentrok waktu jika ada perubahan waktu atau hari
    if (start_time && end_time) {
      const conflict = await hasTimeConflict(
        schedule.class_id,
        day || schedule.day,
        start_time,
        end_time,
        schedule_id,
      );
      if (conflict) {
        return res.status(400).json({
          message: 'Terdapat jadwal lain yang bentrok pada hari dan jam tersebut',
        });
      }
    }

    await schedule.update({
      subject_id: subject_id  || schedule.subject_id,
      day:        day         || schedule.day,
      start_time: start_time  || schedule.start_time,
      end_time:   end_time    || schedule.end_time,
    });

    return res.json({ message: 'Jadwal berhasil diperbarui' });
  } catch (error) {
    console.error('[schedule/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui jadwal', error: error.message });
  }
};

// ── Delete schedule ───────────────────────────────────────────────────────────

/**
 * DELETE /schedules/:schedule_id
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    // Pastikan jadwal ini milik kelas di tahun ajaran aktif
    const schedule = await Schedule.findOne({
      where:   { id: req.params.schedule_id },
      include: {
        model: Class,
        as:    'class',
        where: { academic_year_id: activeYear.id },
      },
    });
    if (!schedule) {
      return res.status(404).json({ message: 'Jadwal tidak ditemukan di tahun ajaran aktif' });
    }

    await schedule.destroy();
    return res.json({ message: 'Jadwal berhasil dihapus' });
  } catch (error) {
    console.error('[schedule/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus jadwal', error: error.message });
  }
};

// ── Get schedules (untuk wali kelas) ─────────────────────────────────────────

/**
 * GET /teachers/schedules?day=
 * Jadwal kelas yang diampu wali kelas yang sedang login.
 * Dipanggil dari routes/teachers.js.
 */
exports.getSchedules = async (req, res) => {
  try {
    const { day } = req.query;

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }

    const myClass = await Class.findOne({
      where: { teacher_id: req.user.id, academic_year_id: activeYear.id },
    });
    if (!myClass) {
      return res.status(404).json({ message: 'Anda tidak mengampu kelas di tahun ajaran aktif' });
    }

    const where = { class_id: myClass.id };
    if (day) where.day = day;

    const schedules = await Schedule.findAll({
      where,
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name'] }],
      order:   [['day', 'ASC'], ['start_time', 'ASC']],
    });

    const result = schedules.map((s) => ({
      class_id:     myClass.id,
      class_name:   myClass.name,
      subject_id:   s.subject_id,
      subject_name: s.subject.name,
      day:          s.day,
      start_time:   s.start_time,
      end_time:     s.end_time,
    }));

    return res.json(result);
  } catch (error) {
    console.error('[schedule/teacher] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil jadwal', error: error.message });
  }
};
