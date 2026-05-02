const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'mysql',
  pool: {
    max: 40,
    min: 5,
    acquire: 30000,
    idle: 10000
  },
  logging: false,
});

module.exports = sequelize;
