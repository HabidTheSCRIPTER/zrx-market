FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package.json ./

# Install dependencies (use npm install, not npm ci)
RUN npm install --omit=dev

# Copy backend files
COPY backend/ ./

# Copy bot directory so it can be loaded by server.js
COPY bot/ ../bot/

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]

