/**
 * models/gradeDetail.js
 *
 * Model untuk item penilaian (Grade Detail) yang berada di bawah suatu kategori penilaian.
 * Contoh: GradeCategory "Ulangan Harian" memiliki GradeDetail:
 *   - "Bilangan Bulat"
 *   - "Pecahan"
 *   - "Bangun Datar"
 *
 * ============================================================
 * HIERARKI DATA
 * ============================================================
 * GradeCategory (Kategori)
 *   └─ GradeDetail (Item penilaian, memiliki tanggal pelaksanaan)
 *       └─ StudentGrade (Nilai per siswa)
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - GradeDetail.belongsTo(GradeCategory) as 'grade_category' → kategori induk
 * - GradeDetail.hasMany(StudentGrade)     as 'student_grade' → nilai-nilai siswa untuk item ini
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Setiap GradeDetail wajib memiliki grade_category_id.
 * - Kombinasi (grade_category_id, name) harus unik – dicek di controller.
 * - Field date opsional (bisa null jika tanggal belum ditentukan).
 * - Saat GradeDetail dibuat, secara otomatis dibuat StudentGrade dengan score null
 *   untuk semua siswa di kelas (dilakukan di controller).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps. Jika diperlukan audit log perubahan item,
 *   tambahkan kolom created_at/updated_at via migration.
 * - Hapus GradeDetail akan menghapus semua StudentGrade terkait jika foreign key
 *   menggunakan ON DELETE CASCADE (pastikan di migration).
 * - Index pada (grade_category_id) untuk query yang sering.
 *
 * @module GradeDetail
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GradeDetail extends Model {
    static associate(models) {
      // Kategori induk (wajib)
      GradeDetail.belongsTo(models.GradeCategory, {
        foreignKey: 'grade_category_id',
        as: 'grade_category',
      });
      // Nilai-nilai siswa untuk item penilaian ini (one-to-many)
      GradeDetail.hasMany(models.StudentGrade, {
        foreignKey: 'grade_detail_id',
        as: 'student_grade',
      });
    }
  }

  GradeDetail.init(
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
       * name - Nama item penilaian (wajib, max 255 karakter).
       * Contoh: "Bilangan Bulat", "Pecahan", "Sistem Pernapasan".
       */
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * date - Tanggal pelaksanaan item penilaian (opsional, format YYYY-MM-DD).
       * Bisa null jika tanggal belum ditentukan.
       */
      date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      /**
       * grade_category_id - Foreign key ke grade_categories.id (wajib).
       * Item penilaian ini berada di bawah kategori tertentu.
       */
      grade_category_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'grade_categories',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'GradeDetail',
      tableName: 'grade_details',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return GradeDetail;
};