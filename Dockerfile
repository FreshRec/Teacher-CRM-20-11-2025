# 1. Этап сборки (Build)
FROM node:20-alpine as build

# Рабочая папка
WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем приложение (Vite создаст папку dist)
RUN npm run build

# 2. Этап запуска (Production)
FROM nginx:alpine

# Копируем собранные файлы из этапа build в папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем наш конфиг Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Открываем порт 8080 (Важно для Yandex Cloud!)
EXPOSE 8080

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
