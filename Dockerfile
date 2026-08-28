# Imagen base de Node.js
FROM node:18-slim

# Directorio de trabajo en el contenedor
WORKDIR /app

# Copiamos los archivos de dependencias de Node
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código del proyecto
COPY . .

# Exponemos el puerto de tu servidor Bro Dashboard
EXPOSE 3002

# Comando para arrancar el servidor
CMD ["node", "server.js"]docker build -t mi-app-avatar .