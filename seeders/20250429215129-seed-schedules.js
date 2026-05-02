'use strict';

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // Ambil kelas 6E
    const classResult = await queryInterface.sequelize.query(
      `SELECT id FROM classes WHERE name = '6E' AND academic_year_id = 1 LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    const classId = classResult[0]?.id;

    // Ambil 2 mata pelajaran awal
    const subjects = await queryInterface.sequelize.query(
      `SELECT id, name FROM subjects ORDER BY name ASC LIMIT 2;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Jadwal contoh (2 mata pelajaran di hari Senin dan Selasa)
    const scheduleData = [
      {
        id: nanoid(),
        class_id: classId,
        subject_id: subjects[0]?.id,
        day: 'Senin',
        start_time: '07:30:00',
        end_time: '08:30:00',
        createdAt: now,
        updatedAt: now
      },
      {
        id: nanoid(),
        class_id: classId,
        subject_id: subjects[1]?.id,
        day: 'Selasa',
        start_time: '08:30:00',
        end_time: '09:30:00',
        createdAt: now,
        updatedAt: now
      }
    ];

    await queryInterface.bulkInsert('schedules', scheduleData);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('schedules', null, {});
  }
};
