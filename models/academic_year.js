/**
 * models/academicYear.js
 *
 * Model untuk tahun ajaran sekolah.
 * Menyimpan informasi tahun ajaran seperti "2024/2025" dan status aktif.
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - AcademicYear.hasMany(Semester) as 'semester'
 * - AcademicYear.hasMany(Class)   as 'class'
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Hanya satu tahun ajaran yang boleh aktif pada satu waktu (is_active = true).
 *   (Dijamin oleh controller dengan transaction saat mengaktifkan tahun ajaran baru).
 * - Saat tahun ajaran dibuat, dua semester (Ganjil & Genap) dibuat otomatis
 *   melalui hook atau controller.
 * - Tahun ajaran yang aktif menentukan semua data yang ditampilkan di sistem
 *   (kelas, semester, penjadwalan, nilai, kehadiran, dll.).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Kolom `year` menggunakan tipe STRING(9) untuk format "YYYY/YYYY" (contoh: 2024/2025).
 * - `is_active` menggunakan BOOLEAN (TINYINT(1) di MySQL).
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at) karena data
 *   tahun ajaran bersifat statis dan jarang berubah. Jika diperlukan audit trail,
 *   tambahkan migration untuk menambah kolom timestamps.
 * - Pastikan controller yang memproses aktivasi tahun ajaran menggunakan
 *   transaction untuk menjaga konsistensi.
 *
 * @module AcademicYear
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AcademicYear extends Model {
    /**
     * Mendefinisikan asosiasi dengan model lain.
     * @param {Object} models - Semua model yang terdaftar
     */
    static associate(models) {
      // Satu tahun ajaran memiliki banyak semester
      AcademicYear.hasMany(models.Semester, {
        foreignKey: 'academic_year_id',
        as: 'semester',
      });
      // Satu tahun ajaran memiliki banyak kelas
      AcademicYear.hasMany(models.Class, {
        foreignKey: 'academic_year_id',
        as: 'class',
      });
    }
  }

  AcademicYear.init(
    {
      /**
       * id - Primary key auto-increment (integer).
       * Cukup menggunakan integer karena jumlah tahun ajaran terbatas.
       */
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      /**
       * year - Nama tahun ajaran dalam format "YYYY/YYYY".
       * Contoh: "2024/2025". Harus unik.
       */
      year: {
        type: DataTypes.STRING(9),
        allowNull: false,
        unique: true,
      },
      /**
       * is_active - Status aktif tahun ajaran (boolean).
       * true  : tahun ajaran sedang berlangsung (aktif)
       * false : tahun ajaran sudah selesai / belum dimulai
       *
       * Hanya satu tahun ajaran yang boleh memiliki is_active = true dalam satu waktu.
       * Kontroller bertanggung jawab memastikan hal ini saat melakukan update/create.
       */
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'AcademicYear',
      tableName: 'academic_years',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return AcademicYear;
};