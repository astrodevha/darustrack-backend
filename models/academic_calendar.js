/**
 * models/AcademicCalendar.js
 *
 * Model untuk kalender akademik sekolah, berisi event-event penting seperti:
 * - Hari libur nasional/cuti bersama
 * - Jadwal ujian (UTS, UAS)
 * - Penerimaan raport
 * - Kegiatan sekolah lainnya
 *
 * ============================================================
 * RELASI
 * ============================================================
 * Tabel ini tidak memiliki foreign key (independen).
 * Data kalender dapat diakses oleh semua role (admin, wali_kelas,
 * kepala_sekolah, orang_tua) untuk keperluan penjadwalan.
 *
 * ============================================================
 * FIELD
 * ============================================================
 * - id          : Primary key auto-increment (integer)
 * - event_name  : Nama event (max 255 karakter)
 * - start_date  : Tanggal mulai event (DATE only, tanpa waktu)
 * - end_date    : Tanggal akhir event (bisa null untuk event satu hari)
 *
 * ============================================================
 * VALIDASI & BISNIS RULES
 * ============================================================
 * - `end_date` boleh null (event satu hari tidak perlu tanggal akhir).
 * - Jika `end_date` diisi, seharusnya >= `start_date` (validasi di controller).
 * - Event tanpa tanggal (`start_date = null`) diperbolehkan untuk event yang
 *   belum ditentukan jadwalnya, dan akan muncul di akhir daftar saat sorting.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini menggunakan charset latin1 dan collate latin1_swedish_ci
 *   (kompatibilitas dengan legacy system). Jika perlu dukungan Unicode
 *   (misal emoji atau karakter non-Latin), ubah ke utf8mb4.
 * - Timestamps tidak digunakan (tidak ada created_at/updated_at) karena
 *   data kalender bersifat statis dan jarang berubah.
 * - Jika suatu saat perlu audit log perubahan, tambahkan field `created_by`
 *   dan `updated_by` atau gunakan mekanisme log terpisah.
 * - Untuk query yang sering menggunakan filter by date, pertimbangkan
 *   menambahkan index pada kolom `start_date` dan `end_date`.
 *
 * @module AcademicCalendar
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AcademicCalendar extends Model {
    /**
     * Mendefinisikan asosiasi dengan model lain.
     * @param {Object} models - Semua model yang terdaftar
     */
    static associate(models) {
      // Tidak ada foreign key. Tabel ini independen.
    }
  }

  AcademicCalendar.init(
    {
      /**
       * id - Primary key auto-increment (integer).
       * Tidak menggunakan UUID untuk kemudahan dan ukuran data yang lebih kecil.
       */
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      /**
       * event_name - Nama event kalender (wajib, max 255 karakter).
       * Contoh: "Libur Nasional", "Ujian Tengah Semester", "Penerimaan Rapor".
       */
      event_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * start_date - Tanggal mulai event (format YYYY-MM-DD).
       * Bisa null jika event belum dijadwalkan.
       */
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      /**
       * end_date - Tanggal akhir event (format YYYY-MM-DD).
       * Bisa null jika event hanya satu hari atau tanggal belum ditentukan.
       * Jika diisi, harus >= start_date (validasi di controller).
       */
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'AcademicCalendar',
      tableName: 'academic_calendar',
      timestamps: false,                 // Tidak ada kolom created_at/updated_at
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return AcademicCalendar;
};