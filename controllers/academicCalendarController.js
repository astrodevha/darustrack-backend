/**
 * controllers/academicCalendarController.js
 *
 * Controller untuk manajemen kalender akademik sekolah.
 * Kalender akademik berisi agenda dan event penting (libur, ujian, raport, dll).
 *
 * ============================================================
 * AKSES BERDASARKAN ROLE
 * ============================================================
 * - admin          : CRUD penuh (tambah, lihat, ubah, hapus)
 * - wali_kelas     : READ only
 * - kepala_sekolah : READ only
 * - orang_tua      : READ only
 *
 * ============================================================
 * ENDPOINTS
 * ============================================================
 * GET    /academic-calendar              → daftar semua event (filter year/month)
 * GET    /academic-calendar/upcoming     → event yang akan datang (limit)
 * GET    /academic-calendar/:id          → detail event
 * POST   /academic-calendar              → tambah event (admin only)
 * PUT    /academic-calendar/:id          → update event (admin only)
 * DELETE /academic-calendar/:id          → hapus event (admin only)
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Filter year/month menggunakan `start_date` (bisa NULL). Event tanpa tanggal
 *   tidak akan masuk filter tahun/bulan, hanya muncul di daftar semua event.
 * - Urutan default: event dengan start_date NULL ditempatkan di akhir.
 * - Limit pada upcoming dibatasi maksimal 50 untuk mencegah overload.
 * - Validasi tanggal menggunakan regex YYYY-MM-DD dan perbandingan Date object.
 *
 * @module academicCalendarController
 */

// ============================================================
// Dependencies
// ============================================================
const { Op, literal } = require('sequelize');
const { AcademicCalendar } = require('../models');

// ============================================================
// Helper: Validasi & parsing filter tanggal
// ============================================================

/**
 * Memvalidasi dan mengubah parameter year dan month menjadi where clause.
 *
 * @param {string|null} yearStr - Parameter year dari query (string)
 * @param {string|null} monthStr - Parameter month dari query (string)
 * @returns {Object} where clause yang sudah difilter
 * @throws {Error} Jika validasi gagal (dilempar ke controller untuk response)
 */
function buildDateFilterWhere(yearStr, monthStr) {
  const where = {};

  if (yearStr) {
    const year = parseInt(yearStr, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      throw new Error('Parameter year tidak valid. Gunakan rentang 2000–2100.');
    }
    where.start_date = {
      [Op.between]: [`${year}-01-01`, `${year}-12-31`],
    };
  }

  if (monthStr) {
    const month = parseInt(monthStr, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      throw new Error('Parameter month tidak valid. Gunakan angka 1–12.');
    }

    const filterYear = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear();
    const paddedMonth = String(month).padStart(2, '0');
    const lastDay = new Date(filterYear, month, 0).getDate();

    where.start_date = {
      [Op.between]: [
        `${filterYear}-${paddedMonth}-01`,
        `${filterYear}-${paddedMonth}-${lastDay}`,
      ],
    };
  }

  return where;
}

/**
 * Validasi format tanggal YYYY-MM-DD.
 *
 * @param {string} dateStr - String tanggal yang akan divalidasi
 * @returns {boolean} true jika format valid dan tanggal sah
 */
function isValidDateString(dateStr) {
  if (!dateStr) return true; // null/undefined dianggap valid (opsional)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateStr) && !isNaN(Date.parse(dateStr));
}

// ============================================================
// Controllers
// ============================================================

/**
 * GET /academic-calendar
 *
 * Mengembalikan semua event kalender, diurutkan dari start_date terdekat.
 * Event tanpa start_date (NULL) ditampilkan paling akhir.
 *
 * @query {string} [year] - Filter berdasarkan tahun (contoh: 2025)
 * @query {string} [month] - Filter berdasarkan bulan (1-12)
 */
exports.getAllEvents = async (req, res) => {
  try {
    const { year, month } = req.query;
    let whereClause = {};

    if (year || month) {
      try {
        whereClause = buildDateFilterWhere(year, month);
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
    }

    const events = await AcademicCalendar.findAll({
      where: whereClause,
      order: [
        /**
         * [Fix L-07] Gunakan literal yang sudah di-require di atas.
         * start_date IS NULL → 1 (true) jika NULL, 0 (false) jika tidak NULL.
         * ORDER BY ... ASC membuat baris dengan nilai 0 (ada tanggal) muncul lebih dulu.
         */
        [literal('start_date IS NULL'), 'ASC'],
        ['start_date', 'ASC'],
      ],
    });

    return res.json({
      total: events.length,
      events,
    });
  } catch (error) {
    console.error('[academicCalendar/getAll] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil data kalender akademik' });
  }
};

/**
 * GET /academic-calendar/upcoming
 *
 * Event yang akan datang (start_date >= hari ini), max sesuai parameter `limit`.
 * Berguna untuk widget "agenda mendatang" di dashboard semua role.
 *
 * @query {number} [limit=10] - Jumlah maksimal event (maks 50)
 */
exports.getUpcomingEvents = async (req, res) => {
  try {
    let rawLimit = parseInt(req.query.limit || '10', 10);
    if (isNaN(rawLimit) || rawLimit < 1) {
      return res.status(400).json({ message: 'Parameter limit harus berupa angka positif' });
    }
    const limit = Math.min(rawLimit, 50);

    const today = new Date().toISOString().split('T')[0];

    const events = await AcademicCalendar.findAll({
      where: {
        [Op.or]: [
          { start_date: { [Op.gte]: today } }, // Event yang belum mulai
          { end_date: { [Op.gte]: today } },   // Event yang sedang berlangsung
          { start_date: null },                // Event tanpa tanggal (selalu tampil)
        ],
      },
      order: [
        [literal('start_date IS NULL'), 'ASC'],
        ['start_date', 'ASC'],
      ],
      limit,
    });

    return res.json({
      today,
      limit,
      total: events.length,
      events,
    });
  } catch (error) {
    console.error('[academicCalendar/upcoming] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil event mendatang' });
  }
};

/**
 * GET /academic-calendar/:id
 *
 * Detail satu event berdasarkan ID.
 *
 * @param {string} id - UUID event
 */
exports.getEventById = async (req, res) => {
  try {
    const event = await AcademicCalendar.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event tidak ditemukan' });
    }
    return res.json(event);
  } catch (error) {
    console.error('[academicCalendar/getById] Error:', error);
    return res.status(500).json({ message: 'Gagal mengambil detail event' });
  }
};

/**
 * POST /academic-calendar
 *
 * Membuat event kalender baru. Hanya admin.
 *
 * @body {string} event_name - Nama event (wajib, max 255)
 * @body {string} [start_date] - Tanggal mulai format YYYY-MM-DD
 * @body {string} [end_date] - Tanggal akhir format YYYY-MM-DD (≥ start_date jika ada)
 */
exports.createEvent = async (req, res) => {
  try {
    const { event_name, start_date, end_date } = req.body;

    // Validasi nama event
    if (!event_name || typeof event_name !== 'string' || !event_name.trim()) {
      return res.status(400).json({ message: 'Nama event wajib diisi' });
    }
    if (event_name.trim().length > 255) {
      return res.status(400).json({ message: 'Nama event maksimal 255 karakter' });
    }

    // Validasi format tanggal
    if (start_date && !isValidDateString(start_date)) {
      return res.status(400).json({ message: 'Format start_date tidak valid. Gunakan format YYYY-MM-DD.' });
    }
    if (end_date && !isValidDateString(end_date)) {
      return res.status(400).json({ message: 'Format end_date tidak valid. Gunakan format YYYY-MM-DD.' });
    }

    // Validasi urutan tanggal
    if (start_date && end_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        message: 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai',
      });
    }

    const event = await AcademicCalendar.create({
      event_name: event_name.trim(),
      start_date: start_date || null,
      end_date: end_date || null,
    });

    return res.status(201).json({
      message: 'Event kalender berhasil ditambahkan',
      data: event,
    });
  } catch (error) {
    console.error('[academicCalendar/create] Error:', error);
    return res.status(500).json({ message: 'Gagal menambahkan event kalender' });
  }
};

/**
 * PUT /academic-calendar/:id
 *
 * Update event kalender. Partial update (hanya field yang dikirim).
 * Hanya admin.
 *
 * @param {string} id - UUID event
 * @body {string} [event_name] - Nama event baru
 * @body {string} [start_date] - Tanggal mulai baru
 * @body {string} [end_date] - Tanggal akhir baru
 */
exports.updateEvent = async (req, res) => {
  try {
    const event = await AcademicCalendar.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event tidak ditemukan' });
    }

    const { event_name, start_date, end_date } = req.body;

    if (event_name === undefined && start_date === undefined && end_date === undefined) {
      return res.status(400).json({
        message: 'Tidak ada data yang diperbarui. Kirimkan setidaknya satu field.',
      });
    }

    // Validasi nama jika diubah
    if (event_name !== undefined) {
      if (!event_name || !event_name.trim()) {
        return res.status(400).json({ message: 'Nama event tidak boleh kosong' });
      }
      if (event_name.trim().length > 255) {
        return res.status(400).json({ message: 'Nama event maksimal 255 karakter' });
      }
    }

    // Validasi format tanggal
    if (start_date && !isValidDateString(start_date)) {
      return res.status(400).json({ message: 'Format start_date tidak valid. Gunakan format YYYY-MM-DD.' });
    }
    if (end_date && !isValidDateString(end_date)) {
      return res.status(400).json({ message: 'Format end_date tidak valid. Gunakan format YYYY-MM-DD.' });
    }

    // Tentukan nilai final untuk validasi urutan
    const finalStartDate = start_date !== undefined ? start_date : event.start_date;
    const finalEndDate = end_date !== undefined ? end_date : event.end_date;
    if (finalStartDate && finalEndDate && new Date(finalEndDate) < new Date(finalStartDate)) {
      return res.status(400).json({
        message: 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai',
      });
    }

    // Update field
    if (event_name !== undefined) event.event_name = event_name.trim();
    if (start_date !== undefined) event.start_date = start_date || null;
    if (end_date !== undefined) event.end_date = end_date || null;

    await event.save();

    return res.json({
      message: 'Event kalender berhasil diperbarui',
      data: event,
    });
  } catch (error) {
    console.error('[academicCalendar/update] Error:', error);
    return res.status(500).json({ message: 'Gagal memperbarui event kalender' });
  }
};

/**
 * DELETE /academic-calendar/:id
 *
 * Hapus event kalender. Hanya admin.
 *
 * @param {string} id - UUID event
 */
exports.deleteEvent = async (req, res) => {
  try {
    const event = await AcademicCalendar.findByPk(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event tidak ditemukan' });
    }
    await event.destroy();
    return res.json({ message: 'Event kalender berhasil dihapus' });
  } catch (error) {
    console.error('[academicCalendar/delete] Error:', error);
    return res.status(500).json({ message: 'Gagal menghapus event kalender' });
  }
};