# Используем стабильную и легкую версию Node.js
FROM node:20-alpine

# Создаем папку приложения внутри контейнера
WORKDIR /app

# Копируем файлы package.json (и package-lock.json если есть)
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код сервера
COPY . .

# Открываем порт 3000 (на нем работает ваш server.js)
EXPOSE 3000

# Запускаем сервер
CMD ["npm", "start"]
