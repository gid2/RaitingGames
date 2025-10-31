const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    telegramId: {
        type: DataTypes.BIGINT,
        allowNull: true, // Может быть null для игроков без Telegram
    }
}, {
    timestamps: true,
});

module.exports = User;
