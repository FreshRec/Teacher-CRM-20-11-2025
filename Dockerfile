# 1. Сборка React приложения
FROM node:20-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# 2. Запуск Nginx
FROM nginx:alpine

# Копируем собранные файлы
COPY --from=build /app/dist /usr/share/nginx/html

# Копируем конфиг (см. ниже)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Важно: открываем порт 8080 для Яндекс Облака
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
