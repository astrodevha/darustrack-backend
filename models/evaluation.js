/**
 * models/evaluation.js
 *
 * Model untuk evaluasi deskriptif (non-numerik) siswa per semester.
 * Evaluasi berisi judul (misal: "Sikap Spiritual", "Sikap Sosial", "Kedisiplinan")
 * dan dapat diisi deskripsi per siswa melalui StudentEvaluation.
 *
 * ============================================================
 * HIERARKI DATA
 * ============================================================
 * Evaluation (judul evaluasi)
 *   └─ StudentEvaluation (deskripsi per siswa, berelasi melalui student_class)
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - Evaluation.belongsTo(Class)    as 'class'             → kelas tempat evaluasi berlaku
 * - Evaluation.belongsTo(Semester) as 'semester'          → semester evaluasi
 * - Evaluation.hasMany(StudentEvaluation) as 'student_evaluation' → deskripsi per siswa
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Satu evaluasi hanya untuk satu kelas dalam satu semester.
 * - Judul evaluasi harus unik per kombinasi (class_id, semester_id) – diatur di controller.
 * - Saat evaluasi dibuat, secara otomatis dibuat StudentEvaluation untuk setiap siswa
 *   di kelas (via controller, bukan hook model).
 * - Evaluasi bersifat deskriptif, bukan numerik (berbeda dengan GradeCategory).
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   audit trail perubahan judul evaluasi, tambahkan kolom timestamps via migration.
 * - Hapus evaluasi akan menghapus semua StudentEvaluation terkait (CASCADE jika
 *   foreign key di migration diatur dengan ON DELETE CASCADE).
 * - Index pada (class_id, semester_id) direkomendasikan untuk query daftar evaluasi.
 *
 * @module Evaluation
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Evaluation extends Model {
    static associate(models) {
      // Kelas tempat evaluasi ini berlaku
      Evaluation.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
      // Semester evaluasi
      Evaluation.belongsTo(models.Semester, { foreignKey: 'semester_id', as: 'semester' });
      // Deskripsi per siswa (one-to-many)
      Evaluation.hasMany(models.StudentEvaluation, { foreignKey: 'evaluation_id', as: 'student_evaluation' });
    }
  }

  Evaluation.init(
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
       * title - Judul evaluasi (wajib, max 255 karakter).
       * Contoh: "Sikap Spiritual", "Sikap Sosial", "Kedisiplinan".
       */
      title: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      /**
       * class_id - Foreign key ke classes.id (wajib).
       * Menentukan kelas yang dievaluasi.
       */
      class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'classes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      /**
       * semester_id - Foreign key ke semesters.id (wajib).
       * Menentukan semester evaluasi.
       */
      semester_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'semesters',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
    },
    {
      sequelize,
      modelName: 'Evaluation',
      tableName: 'evaluations',
      timestamps: false,        // Tidak ada kolom created_at/updated_at
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Evaluation;
};