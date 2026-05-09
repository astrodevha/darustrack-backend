/**
 * models/studentEvaluation.js
 *
 * Model untuk menyimpan deskripsi evaluasi siswa per evaluasi (Evaluation).
 * Menghubungkan antara evaluasi (judul) dengan siswa (via StudentClass)
 * untuk mengisi deskripsi kualitatif (misal: "Baik, selalu berdoa sebelum belajar").
 *
 * ============================================================
 * HIERARKI DATA
 * ============================================================
 * Evaluation (Judul evaluasi, misal: "Sikap Spiritual")
 *   └─ StudentEvaluation (Deskripsi per siswa)
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - StudentEvaluation.belongsTo(Evaluation)    as 'evaluation'     → judul evaluasi
 * - StudentEvaluation.belongsTo(StudentClass)  as 'student_class'  → siswa & kelas
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Setiap evaluasi memiliki satu StudentEvaluation per StudentClass.
 * - Saat evaluasi baru dibuat, StudentEvaluation otomatis dibuat untuk setiap
 *   siswa di kelas (dilakukan di controller dengan transaction).
 * - Deskripsi boleh null (belum diisi oleh wali kelas) atau berisi teks panjang.
 * - Hapus evaluasi akan menghapus semua StudentEvaluation terkait jika foreign key
 *   menggunakan ON DELETE CASCADE (pastikan di migration).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   audit perubahan deskripsi, tambahkan kolom timestamps via migration.
 * - Index pada (evaluation_id, student_class_id) untuk keunikan (seharusnya unique)
 *   agar tidak ada duplikasi evaluasi untuk siswa yang sama.
 * - Gunakan charset latin1 dan collate latin1_swedish_ci untuk kompatibilitas
 *   dengan legacy system.
 *
 * @module StudentEvaluation
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StudentEvaluation extends Model {
    static associate(models) {
      // Relasi ke evaluasi (judul)
      StudentEvaluation.belongsTo(models.Evaluation, {
        foreignKey: 'evaluation_id',
        as: 'evaluation',
      });
      // Relasi ke student_class (siswa dalam konteks kelas & tahun ajaran)
      StudentEvaluation.belongsTo(models.StudentClass, {
        foreignKey: 'student_class_id',
        as: 'student_class',
      });
    }
  }

  StudentEvaluation.init(
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
       * evaluation_id - Foreign key ke evaluations.id (wajib).
       * Menentukan evaluasi (judul) yang sedang diisi.
       */
      evaluation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'evaluations',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      /**
       * student_class_id - Foreign key ke student_classes.id (wajib).
       * Menentukan siswa dan kelas tempat evaluasi ini berlaku.
       */
      student_class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'student_classes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      /**
       * description - Deskripsi evaluasi untuk siswa tersebut (opsional, TEXT).
       * Bisa null jika wali kelas belum mengisi.
       * Isinya bisa panjang (deskriptif).
       */
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'StudentEvaluation',
      tableName: 'student_evaluations',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return StudentEvaluation;
};