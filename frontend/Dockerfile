
# ==========================================
# Stage 1: Build React application
# ==========================================

FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install exact dependencies from lockfile
RUN npm ci

# Backend API URL (provided during build)
ARG VITE_API_BASE_URL=http://localhost:8000

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Copy frontend source
COPY . .

# Generate production build
RUN npm run build


# ==========================================
# Stage 2: Nginx runtime
# ==========================================

FROM nginx:alpine AS runtime

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production React build
COPY --from=builder /app/dist /usr/share/nginx/html

# Frontend port
EXPOSE 3000

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
