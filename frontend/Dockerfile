# --- Build stage ------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (use lockfile if present for reproducible builds)
COPY package.json package-lock.json* ./
RUN npm install

# Build the production bundle
COPY . .
RUN npm run build

# --- Serve stage ------------------------------------------------------------
FROM nginx:1.27-alpine AS serve

# SPA + API proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static build output
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
