# Dockerfile for Railway - Backend Service (with frontend build)
# This builds the frontend first, then sets up the backend

# Build frontend stage
FROM node:18 AS frontend-builder

WORKDIR /frontend-build

# Copy and install frontend dependencies
COPY ../frontend/package*.json ./
RUN npm install

# Copy frontend source and build
COPY ../frontend/ ./
RUN npm run build

# Backend stage
FROM node:18

WORKDIR /app

# Copy backend package files
COPY package*.json ./

# Install backend dependencies
RUN npm ci --only=production

# Copy all backend files
COPY . .

# Copy built frontend from builder stage
COPY --from=frontend-builder /frontend-build/dist ./dist

# Expose port (Railway will set PORT automatically)
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]
