FROM node:26.13.1-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30.6-alpine
COPY nginx.conf /etc/nginx/pdf.conf.template
COPY nginx-start.sh /nginx-start.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["sh", "/nginx-start.sh"]
