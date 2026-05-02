'use strict';

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();

    // Ambil satu kelas (misalnya kelas 6E)
    const [kelas] = await queryInterface.sequelize.query(
      `SELECT id FROM classes WHERE name = '6E' LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Ambil semester Ganjil di tahun ajaran AY01
    const [semester] = await queryInterface.sequelize.query(
      `SELECT id FROM semesters WHERE name = 'Ganjil' AND academic_year_id = 1 LIMIT 1;`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const evaluationId = nanoid();

    // Tambahkan satu data evaluasi
    await queryInterface.bulkInsert('evaluations', [
      {
        id: evaluationId,
        title: 'Mengenai Perilaku Siswa',
        class_id: kelas.id,
        semester_id: semester.id,
        createdAt: now,
        updatedAt: now
      }
    ]);

    // Ambil siswa-siswa yang tergabung dalam kelas tersebut
    const studentClasses = await queryInterface.sequelize.query(
      `SELECT id FROM student_classes WHERE class_id = '${kelas.id}'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Masukkan data evaluasi untuk tiap siswa
    const studentEvaluations = studentClasses.map((sc, idx) => ({
      id: nanoid(),
      evaluation_id: evaluationId,
      student_class_id: sc.id,
      description: `Siswa ${idx + 1} menunjukkan perkembangan baik.`,
      createdAt: now,
      updatedAt: now
    }));

    await queryInterface.bulkInsert('student_evaluations', studentEvaluations);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('student_evaluations', null, {});
    await queryInterface.bulkDelete('evaluations', null, {});
  }
};
