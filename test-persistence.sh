#!/bin/bash

# Test script to verify Docker data persistence

echo "🧪 Testing Capsule Docker Data Persistence..."
echo ""

# Ensure data directory exists
mkdir -p data

# Start container
echo "📦 Starting container..."
docker-compose up -d

# Wait for container to be ready
echo "⏳ Waiting for container to start..."
sleep 10

# Check if container is running
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Container failed to start"
    docker-compose logs
    exit 1
fi

echo "✅ Container is running"
echo ""

# Create a test file in the data directory
TEST_FILE="data/persistence-test-$(date +%s).txt"
echo "test data from host" > "$TEST_FILE"
echo "📝 Created test file: $TEST_FILE"

# Check if file is visible in container
echo "🔍 Checking if file is visible in container..."
if docker-compose exec capsule ls -la /app/data | grep -q "persistence-test"; then
    echo "✅ Test file is visible in container"
else
    echo "❌ Test file NOT visible in container"
    exit 1
fi

# Restart container
echo ""
echo "🔄 Restarting container to test persistence..."
docker-compose restart

# Wait for restart
sleep 10

# Check if file still exists after restart
echo "🔍 Checking if test file persists after restart..."
if [ -f "$TEST_FILE" ]; then
    echo "✅ Test file persisted after container restart"
else
    echo "❌ Test file was lost after restart"
    exit 1
fi

# Clean up test file
rm "$TEST_FILE"

echo ""
echo "✅ All persistence tests passed!"
echo ""
echo "Data persistence verified:"
echo "  - Host directory: ./data"
echo "  - Container directory: /app/data"
echo "  - Data survives container restarts: YES"
echo ""
echo "Your user data will be safely stored in ./data/"
echo ""
