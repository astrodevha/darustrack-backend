'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashedPassword = await bcrypt.hash('password123', 10);

    await queryInterface.bulkInsert('users', [
      {
        id: 'U0001',
        name: 'Admin',
        email: 'admin@gmail.com',
        password: hashedPassword,
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'U0002',
        name: 'Kepala Sekolah',
        email: 'kepalasekolah@gmail.com',
        password: hashedPassword,
        role: 'kepala_sekolah',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'U0003',
        name: 'Wali Kelas 6D',
        email: 'walikelas6d@gmail.com',
        password: hashedPassword,
        role: 'wali_kelas',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'U0004',
        name: 'Wali Kelas 6E',
        email: 'walikelas6e@gmail.com',
        password: hashedPassword,
        role: 'wali_kelas',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'U0005',
        name: 'Orang Tua Atthar',
        email: 'orangtuaAtthar@gmail.com',
        password: hashedPassword,
        role: 'orang_tua',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'U0006',
        name: 'Orang Tua Mirza',
        email: 'orangtuamirza@gmail.com',
        password: hashedPassword,
        role: 'orang_tua',
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', null, {});
  }
};
