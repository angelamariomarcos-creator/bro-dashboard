FROM node:22-bullseye-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copiamos solo los manifiestos primero para aprovechar la caché de capas
COPY package*.json ./

# Instalamos únicamente dependencias de producción de forma estricta y limpia
RUN npm ci --omit=dev

# Copiamos solo los archivos indispensables (el .dockerignore ya filtra el resto)
COPY public ./public
COPY server.js ./

# Seguridad: ejecutamos con el usuario 'node' sin privilegios de root
USER node

EXPOSE 3002

CMD ["node", "server.js"]