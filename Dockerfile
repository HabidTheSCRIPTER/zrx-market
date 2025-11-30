# Dockerfile for Railway
# Copies backend files and starts the server

FROM node:18

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy all backend files
COPY backend/ ./

# Expose port (Railway will set PORT automatically)
EXPOSE 3000

# Start the server (no cd needed - we're already in /app)
CMD ["node", "server.js"]

