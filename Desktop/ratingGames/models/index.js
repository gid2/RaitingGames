const sequelize = require('../config/database');
const User = require('./User');
const Game = require('./Game');
const GameScore = require('./GameScore');

// Связи
User.hasMany(GameScore, { foreignKey: 'userId' });
GameScore.belongsTo(User, { foreignKey: 'userId' });

Game.hasMany(GameScore, { foreignKey: 'gameId' });
GameScore.belongsTo(Game, { foreignKey: 'gameId' });

module.exports = {
    sequelize,
    User,
    Game,
    GameScore
};
