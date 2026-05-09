/**
 * models/schedule.js
 *
 * Model untuk jadwal pelajaran (schedules) per kelas.
 * Menentukan mata pelajaran yang diajarkan pada hari dan waktu tertentu di suatu kelas.
 *
 * ============================================================
 * RELASI
 * ============================================================
 * - Schedule.belongsTo(Class)    as 'class'    → kelas terkait
 * - Schedule.belongsTo(Subject)  as 'subject'  → mata pelajaran
 *
 * ============================================================
 * ATURAN BISNIS
 * ============================================================
 * - Jadwal hanya dapat dibuat untuk tahun ajaran aktif (dicek di controller).
 * - Tidak boleh ada dua jadwal dengan kelas, hari, dan rentang waktu yang bertumpuk
 *   (overlap detection menggunakan formula interval overlap di controller).
 * - Hari menggunakan enum Bahasa Indonesia (Senin, Selasa, ..., Sabtu).
 * - Waktu menggunakan format TIME (HH:MM:SS) atau HH:MM.
 *
 * ============================================================
 * PANDUAN MAINTENANCE
 * ============================================================
 * - Tabel ini tidak memiliki timestamps (created_at/updated_at). Jika diperlukan
 *   audit perubahan jadwal, tambahkan kolom timestamps via migration.
 * - Pastikan foreign key constraints di migration menggunakan ON DELETE CASCADE
 *   agar jadwal ikut terhapus jika kelas atau mata pelajaran dihapus.
 * - Index pada (class_id, day, start_time) direkomendasikan untuk query overlap.
 *
 * @module Schedule
 */

'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Schedule extends Model {
    static associate(models) {
      // Relasi ke kelas
      Schedule.belongsTo(models.Class, { foreignKey: 'class_id', as: 'class' });
      // Relasi ke mata pelajaran
      Schedule.belongsTo(models.Subject, { foreignKey: 'subject_id', as: 'subject' });
    }
  }

  Schedule.init(
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
       * class_id - Foreign key ke classes.id (wajib).
       * Kelas yang memiliki jadwal ini.
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
       * subject_id - Foreign key ke subjects.id (wajib).
       * Mata pelajaran yang diajarkan.
       */
      subject_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'subjects',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      /**
       * day - Hari pelaksanaan jadwal, menggunakan ENUM bahasa Indonesia.
       * Nilai yang valid: 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'.
       */
      day: {
        type: DataTypes.ENUM('Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'),
        allowNull: false,
      },
      /**
       * start_time - Waktu mulai pelajaran (format TIME, misal '07:30:00').
       */
      start_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
      /**
       * end_time - Waktu selesai pelajaran (format TIME, harus > start_time).
       */
      end_time: {
        type: DataTypes.TIME,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Schedule',
      tableName: 'schedules',
      timestamps: false,
      charset: 'latin1',
      collate: 'latin1_swedish_ci',
    }
  );

  return Schedule;
};