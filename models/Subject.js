/**
 * models/subject.js
 *
 * Model untuk mata pelajaran (Subject) yang diajarkan di sekolah.
 * Subject adalah master data yang bersifat global (tidak terikat tahun ajaran atau kelas),
 * digunakan dalam penjadwalan (Schedule) dan penilaian (GradeCategory).
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - Subject.hasMany(Schedule)       as 'schedule'        → jadwal pelajaran
 * - Subject.hasMany(GradeCategory)  as 'grade_category' → kategori penilaian
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Nama mata pelajaran harus unik (unique constraint) di seluruh sistem.
 * - Deskripsi mata pelajaran bersifat opsional (bisa null).
 * - Subject dapat digunakan di berbagai tahun ajaran dan kelas tanpa duplikasi data.
 * - Jika mata pelajaran dihapus, semua jadwal dan kategori nilai yang terkait
 *   akan ikut terhapus jika foreign key menggunakan ON DELETE CASCADE
 *   (pastikan di migration sesuai kebutuhan bisnis).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   audit perubahan data mata pelajaran, tambahkan kolom timestamps via migration.
 * - Pastikan index pada kolom `name` sudah UNIQUE (dari constraint).
 * - Jika diperlukan field tambahan (misal: `code` untuk kode singkat mata pelajaran),
 *   tambahkan melalui migration dan sesuaikan controller.
 *
 * @module Subject
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Subject extends Model {
    static associate(models) {
      // Relasi ke jadwal pelajaran (one-to-many)
      Subject.hasMany(models.Schedule, { foreignKey: 'subject_id', as: 'schedule' });
      // Relasi ke kategori penilaian (one-to-many)
      Subject.hasMany(models.GradeCategory, { foreignKey: 'subject_id', as: 'grade_category' });
    }
  }

  Subject.init(
    {
      /**
       * id - Primary key auto-increment.
       */
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      /**
       * name - Nama mata pelajaran (wajib, unik, max 255 karakter).
       * Contoh: "Matematika", "Bahasa Indonesia", "IPA", "IPS".
       */
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      /**
       * description - Deskripsi mata pelajaran (opsional, TEXT).
       * Bisa diisi dengan penjelasan singkat tentang cakupan materi.
       */
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Subject',
      tableName: 'subjects',
      timestamps: false,        // Tidak ada kolom created_at/updated_at
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Subject;
};