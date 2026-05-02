'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Tambahkan indeks pada kolom `email`
    await queryInterface.addIndex('users', ['email'], {
      name: 'idx_users_email',
      unique: true, // Karena email sudah unique
    });
  },

  async down(queryInterface, Sequelize) {
    // Hapus indeks
    await queryInterface.removeIndex('users', 'idx_users_email');
  }
};