'use strict';

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    
    const academicYearId = 1;
    const semesterGanjilId = nanoid();
    const semesterGenapId = nanoid();

    await queryInterface.bulkInsert('academic_years', [
      {
        id: academicYearId,
        year: '2024/2025',
        is_active: true,
        createdAt: now,
        updatedAt: now
      }
    ]);

    await queryInterface.bulkInsert('semesters', [
      {
        id: semesterGanjilId,
        name: 'Ganjil',
        academic_year_id: academicYearId,
        is_active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: semesterGenapId,
        name: 'Genap',
        academic_year_id: academicYearId,
        is_active: false,
        createdAt: now,
        updatedAt: now
      }
    ]);

    await queryInterface.bulkInsert('classes', [
      {
        id: nanoid(),
        name: '6D',
        teacher_id: 'U0003',
        academic_year_id: academicYearId,
        createdAt: now,
        updatedAt: now
      },
      {
        id: nanoid(),
        name: '6E',
        teacher_id: 'U0004',
        academic_year_id: academicYearId,
        createdAt: now,
        updatedAt: now
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('classes', null, {});
    await queryInterface.bulkDelete('semesters', { academic_year_id: 'AY01' }, {});
    await queryInterface.bulkDelete('academic_years', { id: 'AY01' }, {});
  }
};
