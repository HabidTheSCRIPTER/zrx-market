FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies - use npm install if no lock file, otherwise npm ci
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy backend files
COPY . .

# Expose port (Railway uses PORT env var, but 8080 is default)
EXPOSE 8080

# Start server
CMD ["npm", "start"]

