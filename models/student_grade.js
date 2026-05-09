/**
 * models/studentGrade.js
 *
 * Model untuk menyimpan nilai (score) siswa untuk setiap item penilaian (GradeDetail).
 * Grading system numerik (0-100) untuk setiap siswa pada suatu GradeDetail.
 *
 * ============================================================
 * HIERARKI DATA
 * ============================================================
 * GradeDetail (Item penilaian, misal: "Bilangan Bulat")
 *   └─ StudentGrade (Nilai per siswa)
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - StudentGrade.belongsTo(StudentClass) as 'student_class' → siswa & kelas
 * - StudentGrade.belongsTo(GradeDetail)  as 'grade_detail'  → item penilaian
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Score menggunakan tipe FLOAT (0-100, boleh desimal).
 * - Score wajib diisi (null tidak diperbolehkan) – validasi di controller.
 * - Saat GradeDetail dibuat, StudentGrade otomatis dibuat dengan score NULL
 *   untuk semua siswa di kelas, agar guru dapat langsung mengisi nilai.
 * - Kombinasi (student_class_id, grade_detail_id) harus unik (unique constraint)
 *   untuk mencegah duplikasi nilai satu siswa pada item yang sama.
 * - Nilai diupdate melalui PATCH /teachers/grades/students/:student_grade_id
 *   dengan autentikasi wali kelas yang sesuai.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   audit perubahan nilai, tambahkan kolom timestamps via migration.
 * - Pastikan foreign key constraints di migration menggunakan ON DELETE CASCADE
 *   agar nilai ikut terhapus jika GradeDetail atau StudentClass dihapus.
 * - Index pada (student_class_id, grade_detail_id) untuk keunikan dan performa query.
 *
 * @module StudentGrade
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StudentGrade extends Model {
    static associate(models) {
      // Relasi ke StudentClass (siswa dalam konteks kelas & tahun ajaran)
      StudentGrade.belongsTo(models.StudentClass, {
        foreignKey: 'student_class_id',
        as: 'student_class',
      });
      // Relasi ke GradeDetail (item penilaian)
      StudentGrade.belongsTo(models.GradeDetail, {
        foreignKey: 'grade_detail_id',
        as: 'grade_detail',
      });
    }
  }

  StudentGrade.init(
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
       * student_class_id - Foreign key ke student_classes.id (wajib).
       * Menentukan siswa dan kelas yang menerima nilai.
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
       * grade_detail_id - Foreign key ke grade_details.id (wajib).
       * Menentukan item penilaian yang dinilai.
       */
      grade_detail_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'grade_details',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      /**
       * score - Nilai siswa (0-100, tipe FLOAT, bisa desimal).
       * Boleh null jika nilai belum diisi (saat pembuatan awal).
       */
      score: {
        type: DataTypes.FLOAT,
        allowNull: true,
        validate: {
          min: 0,
          max: 100,
        },
      },
    },
    {
      sequelize,
      modelName: 'StudentGrade',
      tableName: 'student_grades',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return StudentGrade;
};