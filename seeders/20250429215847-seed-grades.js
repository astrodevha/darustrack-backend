'use strict';

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 5);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // Ambil data relasional
    const [kelas] = await queryInterface.sequelize.query(
      `SELECT id FROM classes WHERE name = '6E' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [subject] = await queryInterface.sequelize.query(
      `SELECT id FROM subjects WHERE name = 'Bahasa Arab' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [semester] = await queryInterface.sequelize.query(
      `SELECT id FROM semesters WHERE name = 'Ganjil' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const studentClasses = await queryInterface.sequelize.query(
      `SELECT id FROM student_classes WHERE class_id = '${kelas.id}'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const assessmentTypes = [
      { name: 'Asesmen Sumatif Harian', detailName: 'TP 1', date: '2025-04-25' },
      { name: 'Asesmen Sumatif Tengah Semester', detailName: 'STS 1', date: '2025-05-10' },
      { name: 'Asesmen Sumatif Akhir Semester', detailName: 'SAS 1', date: '2025-06-15' }
    ];

    for (const assessment of assessmentTypes) {
      const categoryId = nanoid();
      const detailId = nanoid();

      // Insert Grade Category
      await queryInterface.bulkInsert('grade_categories', [
        {
          id: categoryId,
          class_id: kelas.id,
          subject_id: subject.id,
          semester_id: semester.id,
          name: assessment.name,
          createdAt: now,
          updatedAt: now
        }
      ]);

      // Insert Grade Detail
      await queryInterface.bulkInsert('grade_details', [
        {
          id: detailId,
          grade_category_id: categoryId,
          name: assessment.detailName,
          date: assessment.date,
          createdAt: now,
          updatedAt: now
        }
      ]);

      // Insert Student Grades
      const grades = studentClasses.map(sc => ({
        id: nanoid(),
        student_class_id: sc.id,
        grade_detail_id: detailId,
        score: Math.floor(Math.random() * 41) + 60, // nilai 60-100
        createdAt: now,
        updatedAt: now
      }));

      await queryInterface.bulkInsert('student_grades', grades);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('student_grades', null, {});
    await queryInterface.bulkDelete('grade_details', null, {});
    await queryInterface.bulkDelete('grade_categories', null, {});
  }
};
