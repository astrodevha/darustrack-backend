'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('curriculums', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT('long'), // pakai TEXT panjang jika perlu
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Tambahkan data kurikulum lengkap
    await queryInterface.bulkInsert('curriculums', [{
      id: 1,
      name: 'Kurikulum 2013 - SDIT Darussalam 01 Batam',
      description: `
Kerangka Dasar dan Struktur Kurikulum

Pengertian Kurikulum
Kurikulum adalah seperangkat rencana dan pengaturan mengenai tujuan, isi dan bahan pelajaran serta cara yang digunakan sebagai pedoman penyelenggaraan kegiatan pembelajaran untuk mencapai tujuan pendidikan tertentu.

Berdasarkan pengertian tersebut, ada dua dimensi kurikulum, yang pertama adalah rencana dan pengaturan mengenai tujuan, isi dan bahan pelajaran, sedangkan yang kedua adalah cara yang digunakan untuk kegiatan pembelajaran.

SDIT Darussalam 01 Batam Menggunakan Kurikulum 2013

Kurikulum 2013 adalah kurikulum operasional yang disusun oleh dan dilaksanakan di masing-masing satuan pendidikan. Kurikulum 2013 terdiri dari tujuan pendidikan tingkat satuan pendidikan, struktur dan muatan kurikulum tingkat satuan pendidikan, kalender pendidikan dan silabus.

Kerangka Dasar Kurikulum
- Landasan Filosofis:
  Menentukan kualitas peserta didik, isi kurikulum, proses pembelajaran, dan relasi peserta didik dengan lingkungan.

- Landasan Teoritis:
  Berdasarkan teori pendidikan berbasis standar dan kurikulum berbasis kompetensi.

- Landasan Yuridis:
  Berdasarkan undang-undang dan peraturan pemerintah.

Struktur Kurikulum
- Kompetensi Inti: Disusun sesuai perkembangan usia peserta didik.
- Mata Pelajaran: Disusun berdasar kompetensi inti dan alokasi waktu.
- Beban Belajar: Total kegiatan belajar dalam satu minggu, semester, dan tahun.

Kompetensi Dasar
Dirumuskan untuk mencapai kompetensi inti, mempertimbangkan karakteristik peserta didik dan mata pelajaran.

Muatan Kurikulum
- Muatan Pembelajaran:
  Menggunakan pendekatan tematik terpadu dari kelas 1 sampai kelas VI, kecuali Pendidikan Agama dan Budi Pekerti.

- Muatan Lokal:
  Kegiatan kurikuler sesuai potensi dan keunggulan daerah, ditentukan oleh satuan pendidikan.
      `.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    }]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('curriculums');
  }
};