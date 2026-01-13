FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create data directory for encrypted local storage
RUN mkdir -p /app/data && chmod 755 /app/data

# Expose port 7654 (Capsule default port)
EXPOSE 7654

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]