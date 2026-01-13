#!/bin/bash

# Capsule Budget - ZimaOS Deployment Script

set -e

echo "🚀 Deploying Capsule to ZimaOS..."
echo ""

# Detect docker compose command
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    echo "❌ Docker Compose not found"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Using: $DOCKER_COMPOSE"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    
    # Generate a secure encryption key
    echo "🔑 Generating encryption key..."
    
    if command -v openssl &> /dev/null; then
        # Use openssl if available
        ENCRYPTION_KEY=$(openssl rand -base64 32)
    elif [ -r /dev/urandom ]; then
        # Fallback to /dev/urandom
        ENCRYPTION_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
    else
        # Last resort: generate from random data
        ENCRYPTION_KEY=$(cat /dev/random | head -c 32 | base64 | tr -d '\n' 2>/dev/null || echo "PLEASE-CHANGE-THIS-$(date +%s)-$(( RANDOM * RANDOM ))")
        echo "⚠️  Warning: Could not generate optimal random key"
        echo "   Please update ENCRYPTION_KEY in .env with a secure random value"
    fi
    
    # Update .env with generated key
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/change-this-to-a-secure-random-key/$ENCRYPTION_KEY/" .env
    else
        # Linux
        sed -i "s/change-this-to-a-secure-random-key/$ENCRYPTION_KEY/" .env
    fi
    
    echo "✅ Generated secure encryption key"
    echo ""
fi

# Clear test data
echo "🧹 Clearing test data..."
rm -rf data/*
echo "✅ Test data cleared"
echo ""

# Build and start containers
echo "🔨 Building Docker image..."
$DOCKER_COMPOSE build

echo ""
echo "🚀 Starting Capsule..."
$DOCKER_COMPOSE up -d

echo ""
echo "⏳ Waiting for container to start..."
sleep 5

# Verify data directory is mounted
echo ""
echo "🔍 Verifying data persistence..."
if $DOCKER_COMPOSE exec capsule ls -la /app/data >/dev/null 2>&1; then
    echo "✅ Data directory is correctly mounted in container"
else
    echo "⚠️  Warning: Could not verify data directory mount"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Capsule is running at:"
echo "   http://localhost:7654"
echo "   http://$(hostname -I | awk '{print $1}'):7654"
echo ""
echo "🔧 Useful commands:"
echo "   $DOCKER_COMPOSE logs -f       # View logs"
echo "   $DOCKER_COMPOSE stop          # Stop container"
echo "   $DOCKER_COMPOSE restart       # Restart container"
echo "   $DOCKER_COMPOSE down          # Stop and remove container"
echo ""
echo "💾 Your data is stored in: ./data/"
echo "   - This directory persists across container restarts"
echo "   - Back it up regularly!"
echo ""
echo "🧪 To test data persistence: ./test-persistence.sh"
echo ""
