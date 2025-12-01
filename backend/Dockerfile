FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json ./

# Install dependencies (use npm install since we don't have a complete lock file)
RUN npm install --omit=dev

# Copy backend files
COPY . .

# Expose port (Railway uses PORT env var, but 8080 is default)
EXPOSE 8080

# Start server
CMD ["npm", "start"]

