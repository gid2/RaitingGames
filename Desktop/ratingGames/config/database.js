const { Sequelize } = require('sequelize');

// Для SQLite (проще для начала)
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
    logging: console.log, // Можно отключить: logging: false
});

// Для MySQL/PostgreSQL
// const sequelize = new Sequelize('database', 'username', 'password', {
//   host: 'localhost',
//   dialect: 'mysql', // или 'postgres'
// });

module.exports = sequelize;
