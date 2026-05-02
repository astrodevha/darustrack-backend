'use strict';

const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', 5);

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('subjects', [
      {
        id: nanoid(),
        name: 'Bahasa Arab',
        description: '1. mengidentifikasi bunyi, kata, dan makna terkait materi waktu dengan memperhatikan struktur fiil mudhore 2. mengidentifikasi bunyi, kata, dan makna terkait materi saya suka bahasa arab dengan memperhatikan struktur fiil amr 3. mengidentifikasi bunyi, kata, dan makna terkait materi aktivitas yang saya sukai dengan memperhatikan struktur fiil mudhore',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'Bahasa Indonesia',
        description: '1. mengenali ragam surat resmi dan surat pribadi 2. membuat kalimat tanya dan melakukan wawancara untuk menggali informasi dengan benar 3. memahami majas dan membedakan opini dan fakta 4. memahami dan membedakan sinonim dengan antonim',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'Bahasa Inggris',
        description: '1. Peserta didik menggunakan kalimat dengan pola tertentu dalam bahasa Inggris untuk berinteraksi pada lingkup situasi sosial yang makin luas namun masih dapat diprediksi atau bersifat rutin 2.  Peserta didik menggunakan beberapa strategi untuk memahami tujuan, ide pokok, dan informasi detail dari recount text pendek, sederhana dan familiar dalam bentuk tulisan atau digital, termasuk teks visual, multimodal atau interaktif dalam konteks kelas dan rumah 3. Peserta didik menulis recount text sederhana sesuai dengan konteks dan tujuannya menggunakan tanda baca dasar yang sesuai',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'IPAs',
        description: '1. memahami bagian-bagian darah, menjelaskan proses peredaran darah di dalam tubuh. 2. menjelaskan terjadinya gerak tubuh dan peranan sistem saraf dalam proses bergerak. 3. menjelaskan pentingnya energi alternatif dan mengidentifikasi energi alternatif yang dapat dikembangkan 4. memahami keteratutan yang terjadi di alam semesta, menjelaskan pengaruh gerak Bumi dan mengidentifikasi anggota penyusun tata surya',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'KRIYA',
        description: 'Menjelaskan pengertian menggambar model, menerapkan prinsip-prinsip, mengidentifikasi teknik-teknik, dan mengurutkan langkah-langgkah menggambar model serta menjelaskan fungsi dan jenis-jenis kolase dan relief',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'Matematika',
        description: '1. Memahami perkalian dan pembagian pecahan dengan bilangan asli dan menghitung hasil perkalian dan pembagian tersebut. 2. Mengubah pecahan menjadi desimal, serta membandingkan dan mengurutkan bilangan desimal (satu angka di belakang koma). 3. Memahami konsep rasio dan menggunakan bahasa rasio untuk menjelaskan hubungan perbandingan antara dua besaran.',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'Musik',
        description: '1. menjelaskan pengertian, ciri-ciri, fungsi lagu daerah dan mengidentifikasi berbagai alat musik tradisional dan modern 2. menjelaskan pengertian menggambar model, menerapkan prinsip-prinsip, mengidentifikasi teknik-teknik, dan mengurutkan langkah-langgkah menggambar model serta menjelaskan fungsi dan jenis-jenis kolase dan relief',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'Pendidikan Agama Islam dan Budi Pekerti',
        description: '1. Melafalkan Surah Ad-Dhuha dan Hadits tentang keutamaan memberi 2. Memahami dan meyakini Asmaul Husna Al-Ghaffar, Al-Afuw, Al-Wahid, dan As-Samad 3. Menjelaskan pengertian maaf dan memaafkan 4. Menjelaskan pengertian halal dan haram, dasar huku halal dan haram, dan sebab-sebab halal dan haram 5. Menjelaskan jasa-jasa khalifah Abu Bakar dan Umar bin Khattab',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'Pendidikan Pancasila dan Kewarganegaraan',
        description: '1. memahami dan mengamalkan nilai-nilai Pancasila dalam kehidupan 2. memahami Pancasila sebagai dasar negara, pandangan hidup bangsa, dan ideologi negara 3. mengenali bentuk-bentuk norma dan dapat menerapkan dalam kehidupan di lingkungan masyarakat 4. memahami hak dan kewajiban serta dapat menerapkan dalam kehidupan sehari-hari',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'PJOK',
        description: '1. Melakukan gerakan senam lantai 2. Melakukan gerak senam irama 3. Melakukan renang gaya dada dan penyelamatan di air dengan baik. 4. Menjaga jasmaninya dengan baik',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: nanoid(),
        name: 'Tari',
        description: 'Mengidentifikasi karakteristik, jenis-jenis tari kreasi dan menjelaskan pengertian koregrafi dan tari kreasi kelompok',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ], {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('subjects', null, {});
  }
};
