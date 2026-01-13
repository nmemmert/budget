FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove devDependencies to reduce image size
RUN npm prune --production

# Create data directory for encrypted local storage
RUN mkdir -p /app/data && chmod 755 /app/data

# Expose port 7654 (Capsule default port)
EXPOSE 7654

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]