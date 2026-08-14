# ===== Stage 1: build dependencies (butuh compiler buat native module: bcrypt, ssh2, cpu-features) =====
FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# ===== Stage 2: runtime image (ga bawa compiler, lebih kecil & aman) =====
FROM node:20-bookworm-slim

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Folder data (kalau ada sisa penggunaan lokal) & pastikan permission oke
RUN mkdir -p data

EXPOSE 3000

# Catatan: image ini jalan sebagai root supaya bisa akses /var/run/docker.sock
# yang di-mount dari host (lihat docker-compose.yml). Ini pola umum buat
# "control-plane" container yang perlu ngatur container lain (sibling containers).
CMD ["node", "server.js"]
