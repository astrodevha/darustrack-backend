'use strict';

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // Ambil semester Ganjil tahun ajaran 2024/2025
    const semester = await queryInterface.sequelize.query(
      `SELECT id FROM semesters WHERE name = 'Ganjil' AND academic_year_id = 1 LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const semesterId = semester[0]?.id;

    // Ambil beberapa data student_classes (siswa yang tergabung dalam kelas)
    const studentClasses = await queryInterface.sequelize.query(
      `SELECT id FROM student_classes LIMIT 2;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Tanggal kehadiran (contoh: hari ini)
    const today = new Date().toISOString().split('T')[0]; // format YYYY-MM-DD

    // Buat seed untuk 2 siswa
    const attendanceData = studentClasses.map((sc, i) => ({
      id: nanoid(),
      student_class_id: sc.id,
      semester_id: semesterId,
      date: today,
      status: i % 2 === 0 ? 'Hadir' : 'Izin',
      createdAt: now,
      updatedAt: now
    }));

    await queryInterface.bulkInsert('attendances', attendanceData);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('attendances', null, {});
  }
};
