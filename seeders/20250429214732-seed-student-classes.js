'use strict';

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ambil kelas '6E' dari tahun ajaran '2024/2025'
    const classResult = await queryInterface.sequelize.query(
      `SELECT id FROM classes WHERE name = '6E' AND academic_year_id = 1 LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const studentResult = await queryInterface.sequelize.query(
      `SELECT id, name FROM students WHERE name IN ('Atthar', 'Cindy');`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const classId = classResult[0]?.id;

    const now = new Date();

    const studentClassData = studentResult.map(student => ({
      id: nanoid(),
      student_id: student.id,
      class_id: classId,
      createdAt: now,
      updatedAt: now
    }));

    await queryInterface.bulkInsert('student_classes', studentClassData, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('student_classes', null, {});
  }
};
