FROM node:22-alpine

WORKDIR /app

# Copiar manifiestos
COPY package.json package-lock.json* ./

# Instalar dependencias de producción + devDeps para build
RUN npm install

# Copiar código fuente y config
COPY tsconfig.json build.mjs ./
COPY src/ ./src/

# Compilar
RUN npm run build

# Limpiar devDependencies para imagen más liviana
RUN npm prune --production

ENV NODE_ENV=production

CMD ["npm", "start"]
