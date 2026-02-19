# ================================================================
# Safimatch — Dockerfile do frontend Expo (Metro bundler)
# ================================================================
FROM node:20-alpine

# Instala dependências nativas necessárias
RUN apk add --no-cache git curl

WORKDIR /app

# Copia package.json primeiro (camada de cache)
COPY package.json ./

# Instala dependências
RUN npm install --legacy-peer-deps

# Expo CLI global
RUN npm install -g @expo/cli

# Copia restante do código
# (em dev o volume sobrescreve este COPY — serve apenas para prod)
COPY . .

# Metro bundler e Expo DevTools
EXPOSE 8081
EXPOSE 19000
EXPOSE 19001
EXPOSE 19002

# Necessário para que o Metro escute em todas as interfaces
ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

# ── Arquivo de entrada ─────────────────────────────────────────
# --host lan → Metro escuta em 0.0.0.0 (todas as interfaces do container)
CMD ["npx", "expo", "start", "--web", "--port", "8081", "--host", "lan"]
