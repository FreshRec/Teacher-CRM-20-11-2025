# 1. Этап сборки (Build)
# Используем легкий образ Node.js версии 20
FROM node:20-alpine as build

# Создаем рабочую папку внутри контейнера
WORKDIR /app

# Сначала копируем файлы с зависимостями
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем весь остальной код проекта
COPY . .

# Собираем проект (результат появится в папке dist)
RUN npm run build

# 2. Этап запуска (Production)
# Используем Nginx для раздачи статики
FROM nginx:alpine

# Копируем собранные файлы из первого этапа в папку Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем наш файл настроек Nginx (см. ниже)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Говорим, что контейнер будет слушать 80 порт
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
