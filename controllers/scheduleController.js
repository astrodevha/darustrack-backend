/**
 * controllers/scheduleController.js
 *
 * Controller untuk manajemen jadwal pelajaran per kelas.
 * Mengelola jadwal dalam tahun ajaran aktif, dengan validasi overlap waktu.
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /academic-years/:id/classes/:class_id/schedules?day= → jadwal satu kelas
 * POST   /academic-years/:id/classes/:class_id/schedules      → tambah jadwal
 * PUT    /schedules/:schedule_id                               → edit jadwal
 * DELETE /schedules/:schedule_id                               → hapus jadwal
 * GET    /teachers/schedules?day=                              → jadwal kelas wali kelas
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - hasTimeConflict() menggunakan strict less-than (<) untuk menghindari false positif
 *   pada jadwal yang bersentuhan (08:00–09:00 dan 09:00–10:00 = tidak konflik).
 * - Validasi waktu menggunakan regex HH:MM atau HH:MM:SS.
 * - Hari jadwal disimpan dalam Bahasa Indonesia (Senin, Selasa, ...).
 *
 * @module scheduleController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op } = require('sequelize');
const { Class, AcademicYear, Schedule, Subject } = require('../models');

// ============================================================
// Constants & Helpers
// ============================================================

/** Pemetaan nama hari dari Inggris ke Indonesia */
const DAY_MAP_EN_TO_ID = {
  Monday: 'Senin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Kamis',
  Friday: 'Jumat',
  Saturday: 'Sabtu',
  Sunday: 'Minggu',
};

/** Daftar hari valid (Bahasa Indonesia) */
const VALID_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Normalisasi nama hari ke Bahasa Indonesia.
 * @param {string} day
 * @returns {string}
 */
function normalizeDay(day) {
  return DAY_MAP_EN_TO_ID[day] || day;
}

/**
 * Validasi format waktu (HH:MM atau HH:MM:SS).
 * @param {string} time
 * @returns {boolean}
 */
function isValidTimeFormat(time) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(time);
}

/**
 * Periksa apakah ada jadwal lain yang waktunya bertabrakan di kelas dan hari yang sama.
 * [Fix M-05] Menggunakan formula interval overlap yang benar (strict less-than).
 *
 * Dua interval [s1,e1] dan [s2,e2] overlap jika dan hanya jika:
 *   s1 < e2 AND s2 < e1
 *
 * @param {string} classId    - ID kelas
 * @param {string} day        - Hari (Bahasa Indonesia)
 * @param {string} startTime  - Waktu mulai baru
 * @param {string} endTime    - Waktu selesai baru
 * @param {string|null} excludeId - ID jadwal yang dikecualikan (untuk update)
 * @returns {Promise<boolean>}
 */
async function hasTimeConflict(classId, day, startTime, endTime, excludeId = null) {
  const where = {
    class_id: classId,
    day,
    start_time: { [Op.lt]: endTime },   // existing.start < newEnd
    end_time:   { [Op.gt]: startTime }, // existing.end   > newStart
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const conflict = await Schedule.findOne({ where, attributes: ['id'] });
  return !!conflict;
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /academic-years/:id/classes/:class_id/schedules?day=Senin
 *
 * Mengambil jadwal untuk satu kelas. Opsional filter per hari.
 *
 * @param {import('express').Request} req - Params: { id, class_id }, Query: { day? }
 * @param {import('express').Response} res
 */
exports.getClassSchedules = async (req, res) => {
  try {
    const { class_id } = req.params;
    const { day } = req.query;

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }
    const classData = await Class.findOne({
      where: { id: class_id, academic_year_id: activeYear.id },
      attributes: ['id', 'name'],
    });
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran aktif' });
    }

    const where = { class_id };
    if (day) {
      const normalizedDay = normalizeDay(day);
      if (!VALID_DAYS.includes(normalizedDay)) {
        return res.status(400).json({
          message: `Hari tidak valid. Pilihan: ${VALID_DAYS.join(', ')}`,
        });
      }
      where.day = normalizedDay;
    }

    const schedules = await Schedule.findAll({
      where,
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name'] }],
      order: [['day', 'ASC'], ['start_time', 'ASC']],
    });
    return res.json(schedules);
  } catch (error) {
    console.error('[schedule/getClass] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil jadwal kelas' });
  }
};

/**
 * POST /academic-years/:id/classes/:class_id/schedules
 *
 * Menambahkan jadwal baru ke kelas. Cek overlap sebelum menyimpan.
 *
 * @param {import('express').Request} req - Params: { id, class_id }, Body: { subject_id, day, start_time, end_time }
 * @param {import('express').Response} res
 */
exports.createSchedule = async (req, res) => {
  try {
    let { subject_id, day, start_time, end_time } = req.body;
    const { class_id } = req.params;

    if (!subject_id || !day || !start_time || !end_time) {
      return res.status(400).json({ message: 'Semua field wajib diisi' });
    }
    day = normalizeDay(day);
    if (!VALID_DAYS.includes(day)) {
      return res.status(400).json({ message: `Hari tidak valid. Pilihan: ${VALID_DAYS.join(', ')}` });
    }
    if (!isValidTimeFormat(start_time) || !isValidTimeFormat(end_time)) {
      return res.status(400).json({ message: 'Format waktu tidak valid. Gunakan HH:MM atau HH:MM:SS.' });
    }
    if (start_time >= end_time) {
      return res.status(400).json({ message: 'Waktu mulai harus lebih awal dari waktu selesai' });
    }

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }
    const classData = await Class.findOne({
      where: { id: class_id, academic_year_id: activeYear.id },
      attributes: ['id'],
    });
    if (!classData) {
      return res.status(404).json({ message: 'Kelas tidak ditemukan di tahun ajaran aktif' });
    }

    const conflict = await hasTimeConflict(class_id, day, start_time, end_time);
    if (conflict) {
      return res.status(409).json({
        message: `Jadwal bertabrakan pada hari ${day} pukul ${start_time}–${end_time}. Pilih waktu lain.`,
      });
    }

    const schedule = await Schedule.create({
      class_id,
      subject_id,
      day,
      start_time,
      end_time,
    });
    return res.status(201).json({
      message: 'Jadwal berhasil ditambahkan',
      data: schedule,
    });
  } catch (error) {
    console.error('[schedule/create] Error:', error);
    return res.status(500).json({ message: 'Gagal menambahkan jadwal' });
  }
};

/**
 * PUT /schedules/:schedule_id
 *
 * Memperbarui jadwal yang sudah ada (partial update).
 * start_time dan end_time harus dikirim bersamaan jika ingin mengubah waktu.
 *
 * @param {import('express').Request} req - Params: { schedule_id }, Body: { subject_id?, day?, start_time?, end_time? }
 * @param {import('express').Response} res
 */
exports.updateSchedule = async (req, res) => {
  try {
    const { schedule_id } = req.params;
    const { subject_id, day, start_time, end_time } = req.body;

    if ((start_time && !end_time) || (!start_time && end_time)) {
      return res.status(400).json({ message: 'start_time dan end_time harus diisi bersamaan' });
    }
    if (start_time && end_time) {
      if (!isValidTimeFormat(start_time) || !isValidTimeFormat(end_time)) {
        return res.status(400).json({ message: 'Format waktu tidak valid' });
      }
      if (start_time >= end_time) {
        return res.status(400).json({ message: 'Waktu mulai harus lebih awal dari waktu selesai' });
      }
    }

    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }
    const schedule = await Schedule.findOne({
      where: { id: schedule_id },
      include: {
        model: Class,
        as: 'class',
        where: { academic_year_id: activeYear.id },
        attributes: ['id'],
      },
    });
    if (!schedule) {
      return res.status(404).json({ message: 'Jadwal tidak ditemukan di tahun ajaran aktif' });
    }

    if (start_time && end_time) {
      const effectiveDay = day ? normalizeDay(day) : schedule.day;
      const conflict = await hasTimeConflict(
        schedule.class_id,
        effectiveDay,
        start_time,
        end_time,
        schedule_id,
      );
      if (conflict) {
        return res.status(409).json({
          message: `Jadwal bertabrakan pada hari ${effectiveDay} pukul ${start_time}–${end_time}. Pilih waktu lain.`,
        });
      }
    }

    if (day) {
      const normalizedDay = normalizeDay(day);
      if (!VALID_DAYS.includes(normalizedDay)) {
        return res.status(400).json({ message: `Hari tidak valid. Pilihan: ${VALID_DAYS.join(', ')}` });
      }
    }

    await schedule.update({
      subject_id: subject_id || schedule.subject_id,
      day: day ? normalizeDay(day) : schedule.day,
      start_time: start_time || schedule.start_time,
      end_time: end_time || schedule.end_time,
    });
    return res.json({ message: 'Jadwal berhasil diperbarui' });
  } catch (error) {
    console.error('[schedule/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui jadwal' });
  }
};

/**
 * DELETE /schedules/:schedule_id
 *
 * Menghapus jadwal (hanya yang berada di tahun ajaran aktif).
 *
 * @param {import('express').Request} req - Params: { schedule_id }
 * @param {import('express').Response} res
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const activeYear = await AcademicYear.findOne({ where: { is_active: true } });
    if (!activeYear) {
      return res.status(404).json({ message: 'Tahun ajaran aktif tidak ditemukan' });
    }
    const schedule = await Schedule.findOne({
      where: { id: req.params.schedule_id },
      include: {
        model: Class,
        as: 'class',
        where: { academic_year_id: activeYear.id },
        attributes: ['id'],
      },
    });
    if (!schedule) {
      return res.status(404).json({ message: 'Jadwal tidak ditemukan di tahun ajaran aktif' });
    }
    await schedule.destroy();
    return res.json({ message: 'Jadwal berhasil dihapus' });
  } catch (error) {
    console.error('[schedule/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus jadwal' });
  }
};

/**
 * GET /teachers/schedules?day=
 *
 * Jadwal kelas yang diampu wali kelas yang sedang login.
 * [Fix M-08] Satu-satunya implementasi getSchedules (duplikasi di classController dihapus).
 *
 * @param {import('express').Request} req - Query: { day? }, req.user.id dari accessValidation
 * @param {import('express').Response} res
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
      attributes: ['id', 'name'],
    });
    if (!myClass) {
      return res.status(404).json({ message: 'Anda tidak mengampu kelas di tahun ajaran aktif' });
    }

    const where = { class_id: myClass.id };
    if (day) {
      const normalizedDay = normalizeDay(day);
      if (!VALID_DAYS.includes(normalizedDay)) {
        return res.status(400).json({ message: `Hari tidak valid. Pilihan: ${VALID_DAYS.join(', ')}` });
      }
      where.day = normalizedDay;
    }
    const schedules = await Schedule.findAll({
      where,
      include: [{ model: Subject, as: 'subject', attributes: ['id', 'name'] }],
      order: [['day', 'ASC'], ['start_time', 'ASC']],
    });
    return res.json(
      schedules.map(s => ({
        class_id: myClass.id,
        class_name: myClass.name,
        subject_id: s.subject_id,
        subject_name: s.subject?.name,
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
    );
  } catch (error) {
    console.error('[schedule/teacher] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil jadwal' });
  }
};