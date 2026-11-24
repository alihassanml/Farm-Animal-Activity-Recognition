# Frontend: build the React app, then serve it with nginx.
# nginx also forwards /api (HTTP and the camera WebSocket) to the backend, so the site and
# the API share one origin and the login cookie works.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
