# ========================================================
# OmniDesk - All-in-One Single Docker Container
# Runs PostgreSQL + Node.js Backend + Nginx/React Frontend
# ========================================================
FROM node:20-bookworm-slim

# Prevent interactive prompts during apt install
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install PostgreSQL, Nginx, curl, and essential tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql \
    postgresql-contrib \
    nginx \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Build Frontend
WORKDIR /tmp/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build && \
    mkdir -p /var/www/html && \
    cp -r dist/* /var/www/html/ && \
    rm -rf /tmp/frontend

# 3. Configure Nginx
COPY docker-allinone-nginx.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# 4. Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./

# 5. Setup Entrypoint Script
COPY docker-entrypoint-allinone.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# 6. Default Environment Variables
ENV PORT=5000 \
    NODE_ENV=production \
    CLIENT_URL=http://localhost:5173 \
    DATABASE_URL=postgresql://admin:admin123@localhost:5432/support_chat \
    JWT_SECRET=super_secret_jwt_key_change_in_production_minimum_32_characters_long \
    JWT_EXPIRES_IN=7d \
    AGENT_EMAIL=agent@support.com \
    AGENT_INITIAL_PASSWORD=AgentPassword123! \
    AGENT_NAME="Alex Support"

# Expose Frontend (5173), Backend (5000), and PostgreSQL (5432)
EXPOSE 5173 5000 5432

ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
