FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package.json ./

# Install backend dependencies (use npm install, not npm ci)
RUN npm install --omit=dev

# Copy backend files
COPY backend/ ./

# Copy bot directory to /bot (absolute path to ensure it's always available)
COPY bot/ /bot/

# Install bot dependencies
WORKDIR /bot
RUN npm install --omit=dev

# Return to app directory
WORKDIR /app

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]

