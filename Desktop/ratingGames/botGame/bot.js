const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { sequelize, User, Game, GameScore } = require('../models');

const TOKEN = process.env.BOT_TOKEN;
const bot = new TelegramBot(TOKEN, { polling: true });

// 🔧 ДОБАВЬТЕ ВЕБ-СЕРВЕР ДЛЯ RENDER
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: 'Bot is running',
        service: 'Telegram Game Score Bot',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

app.listen(PORT, () => {
    console.log(`🚀 Web server running on port ${PORT}`);
});

// ВАШ СУЩЕСТВУЮЩИЙ КОД БОТА
const initDatabase = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ База данных подключена');
        await sequelize.sync({ force: false });
        console.log('✅ Модели синхронизированы');
    } catch (error) {
        console.log('❌ Ошибка БД:', error);
    }
};

// ==================== КОМАНДЫ БОТА ====================

// 👥 ПОКАЗАТЬ ВСЕХ ИГРОКОВ ИГРЫ С ОЧКАМИ (ИСПРАВЛЕННАЯ)
bot.onText(/\/allGamers (.+)/, async (msg, match) => {
    const gameName = match[1].trim();

    try {
        const game = await Game.findOne({ where: { name: gameName } });
        if (!game) {
            return await bot.sendMessage(
                msg.chat.id,
                `❌ Игра "${gameName}" не найдена.\nПроверьте список игр: /games`
            );
        }

        // 🔧 ИСПРАВЛЕНИЕ: Указываем конкретную таблицу для COUNT
        const playerStats = await GameScore.findAll({
            attributes: [
                'userId',
                [sequelize.fn('SUM', sequelize.col('score')), 'totalScore'],
                [sequelize.fn('COUNT', sequelize.col('GameScore.id')), 'gamesPlayed'] // ЯВНО УКАЗЫВАЕМ ТАБЛИЦУ
            ],
            where: { gameId: game.id },
            include: [User],
            group: ['userId', 'User.id'],
            order: [[sequelize.fn('SUM', sequelize.col('score')), 'DESC']]
        });

        if (playerStats.length === 0) {
            return await bot.sendMessage(
                msg.chat.id,
                `📊 В игре "${gameName}" пока нет игроков.\nДобавьте первого игрока: /newGamer Имя ${gameName}`
            );
        }

        let response = `🎮 Игроки в "${gameName}":\n\n`;

        playerStats.forEach((stat, index) => {
            const player = stat.User;
            const totalScore = stat.dataValues.totalScore;

            response += `${index + 1}. ${player.name}\n`;
            response += `   💰 Очков: ${totalScore}\n\n`;
        });

        await bot.sendMessage(msg.chat.id, response);
    } catch (error) {
        console.log('Ошибка при получении игроков:', error);
        await bot.sendMessage(msg.chat.id, '❌ Ошибка при получении списка игроков');
    }
});
// 👤 ДОБАВИТЬ ИГРОКА В КОНКРЕТНУЮ ИГРУ
bot.onText(/\/newGamer (.+) (.+)/, async (msg, match) => {
    const playerName = match[1].trim();
    const gameName = match[2].trim();

    try {
        const game = await Game.findOne({ where: { name: gameName } });
        if (!game) {
            return await bot.sendMessage(
                msg.chat.id,
                `❌ Игра "${gameName}" не найдена.\nСначала создайте игру: /addGame ${gameName}`
            );
        }

        const [player, created] = await User.findOrCreate({
            where: { name: playerName },
            defaults: { name: playerName }
        });

        // 🔧 ИСПРАВЛЕНИЕ: Проверяем, не добавлен ли уже игрок
        const existingScore = await GameScore.findOne({
            where: { gameId: game.id, userId: player.id }
        });

        if (existingScore) {
            return await bot.sendMessage(
                msg.chat.id,
                `ℹ️ Игрок "${playerName}" уже участвует в игре "${gameName}"`
            );
        }

        // Добавляем с 0 очков
        await GameScore.create({
            gameId: game.id,
            userId: player.id,
            score: 0
        });

        if (created) {
            await bot.sendMessage(msg.chat.id, `✅ Новый игрок "${playerName}" добавлен в игру "${gameName}"!`);
        } else {
            await bot.sendMessage(msg.chat.id, `✅ Игрок "${playerName}" добавлен в игру "${gameName}"!`);
        }

    } catch (error) {
        console.log('Ошибка при добавлении игрока:', error);
        await bot.sendMessage(msg.chat.id, '❌ Ошибка при добавлении игрока в игру');
    }
});

// 🎮 ДОБАВИТЬ НОВУЮ ИГРУ
bot.onText(/\/addGame (.+)/, async (msg, match) => {
    const gameName = match[1].trim();

    try {
        if (!gameName) {
            return await bot.sendMessage(msg.chat.id, '❌ Название игры не может быть пустым');
        }

        const [game, created] = await Game.findOrCreate({
            where: { name: gameName },
            defaults: { name: gameName }
        });

        if (created) {
            await bot.sendMessage(msg.chat.id, `✅ Игра "${gameName}" успешно добавлена!`);
        } else {
            await bot.sendMessage(msg.chat.id, `ℹ️ Игра "${gameName}" уже существует!`);
        }
    } catch (error) {
        console.log('Ошибка при добавлении игры:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            await bot.sendMessage(msg.chat.id, '❌ Игра с таким названием уже существует');
        } else {
            await bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при добавлении игры');
        }
    }
});

// ➕ ДОБАВИТЬ ОЧКИ (ИСПРАВЛЕННАЯ)
bot.onText(/\/addScore (.+) (.+) (.+)/, async (msg, match) => {
    const playerName = match[1].trim();
    const gameName = match[2].trim();
    const points = parseInt(match[3]);

    try {
        if (isNaN(points)) {
            return await bot.sendMessage(msg.chat.id, '❌ Очки должны быть числом');
        }

        const player = await User.findOne({ where: { name: playerName } });
        const game = await Game.findOne({ where: { name: gameName } });

        if (!player) {
            return await bot.sendMessage(msg.chat.id, `❌ Игрок "${playerName}" не найден.`);
        }

        if (!game) {
            return await bot.sendMessage(msg.chat.id, `❌ Игра "${gameName}" не найдена.`);
        }

        // 🔧 ИСПРАВЛЕНИЕ: Всегда создаем новую запись для истории
        await GameScore.create({
            gameId: game.id,
            userId: player.id,
            score: points
        });

        // Получаем общую сумму очков
        const totalScore = await GameScore.sum('score', {
            where: { gameId: game.id, userId: player.id }
        });

        await bot.sendMessage(
            msg.chat.id,
            `✅ Добавлено ${points} очков игроку "${playerName}"!\n💰 Теперь всего: ${totalScore} очков`
        );

    } catch (error) {
        console.log('Ошибка:', error);
        await bot.sendMessage(msg.chat.id, '❌ Ошибка при добавлении очков');
    }
});

// 📊 ПОКАЗАТЬ ВСЕ ИГРЫ
bot.onText(/\/games/, async (msg) => {
    try {
        const games = await Game.findAll({ order: [['name', 'ASC']] });

        if (games.length === 0) {
            return await bot.sendMessage(msg.chat.id, '📝 Игр пока нет.\nДобавьте первую: /addGame Название');
        }

        let response = `🎮 Список всех игр (${games.length}):\n\n`;
        games.forEach((game, index) => {
            response += `${index + 1}. ${game.name}\n`;
        });

        await bot.sendMessage(msg.chat.id, response);
    } catch (error) {
        console.log('Ошибка:', error);
        await bot.sendMessage(msg.chat.id, '❌ Ошибка при получении списка игр');
    }
});

// ℹ️ ПОМОЩЬ
bot.onText(/\/start|\/help/, async (msg) => {
    const helpText = `
🎮 Бот для учета очков в настольных играх

📋 Команды:

👥 Игроки:
/newGamer Имя Игра - добавить игрока
/allGamers Игра - показать игроков игры

🎮 Игры:
/addGame Название - добавить игру
/games - показать все игры

📊 Очки:
/addScore Игрок Игра Очки - добавить очки

Пример:
/addGame Покер
/newGamer Алексей Покер
/addScore Алексей Покер 100
/allGamers Покер
`;

    await bot.sendMessage(msg.chat.id, helpText);
});

// Запуск
initDatabase().then(() => {
    console.log('🤖 Бот для учета очков запущен!');
});

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.log('Polling error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🔄 Остановка бота...');
    process.exit(0);
});
