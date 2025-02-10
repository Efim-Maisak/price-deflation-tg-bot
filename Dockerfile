# Используем легковесный образ на Alpine Linux
FROM node:18-alpine

# Устанавливаем рабочую директорию в контейнере
WORKDIR /bot

# Копируем файлы package.json и package-lock.json (если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем все файлы бота в контейнер
COPY . .

# Указываем переменные окружения (если используются)
ENV NODE_ENV=production

# Указываем команду для запуска бота
CMD ["node", "bot.js"]