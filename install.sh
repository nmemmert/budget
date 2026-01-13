#!/bin/bash

# Capsule Budget - One-Line Installer for ZimaOS/Docker
# Usage: curl -fsSL https://raw.githubusercontent.com/nmemmert/budget/master/install.sh | bash

set -e

REPO_URL="https://github.com/nmemmert/budget.git"
INSTALL_DIR="capsule-budget"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║              🌟 Capsule Budget Installer 🌟                ║"
echo "║                    by NeCloud                              ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check for Docker
echo "🔍 Checking prerequisites..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi
echo "✅ Docker found"

# Check for Docker Compose
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
    echo "✅ Docker Compose found (standalone)"
elif docker compose version &> /dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
    echo "✅ Docker Compose found (plugin)"
else
    echo "❌ Docker Compose is not installed"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if git is available
if command -v git &> /dev/null; then
    USE_GIT=true
    echo "✅ Git found"
else
    USE_GIT=false
    echo "⚠️  Git not found, will download files directly"
fi

echo ""
echo "📦 Installing Capsule Budget..."

# Remove existing installation if present
if [ -d "$INSTALL_DIR" ]; then
    echo "⚠️  Existing installation found"
    read -p "Do you want to remove it and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Removing old installation..."
        rm -rf "$INSTALL_DIR"
    else
        echo "❌ Installation cancelled"
        exit 0
    fi
fi

# Clone or download repository
if [ "$USE_GIT" = true ]; then
    echo "📥 Cloning repository..."
    git clone "$REPO_URL" "$INSTALL_DIR"
else
    echo "📥 Downloading repository..."
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Download essential files
    curl -fsSL "https://raw.githubusercontent.com/nmemmert/budget/master/docker-compose.yml" -o docker-compose.yml
    curl -fsSL "https://raw.githubusercontent.com/nmemmert/budget/master/Dockerfile" -o Dockerfile
    curl -fsSL "https://raw.githubusercontent.com/nmemmert/budget/master/.env.example" -o .env.example
    curl -fsSL "https://raw.githubusercontent.com/nmemmert/budget/master/package.json" -o package.json
    
    # Note: Full source code still needs to be downloaded
    echo "⚠️  For full installation, Git is recommended"
    echo "Downloading complete source archive..."
    curl -fsSL "https://github.com/nmemmert/budget/archive/refs/heads/master.tar.gz" | tar -xz --strip-components=1
    
    cd ..
fi

cd "$INSTALL_DIR"

# Setup environment
echo ""
echo "⚙️  Setting up environment..."

if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    
    # Generate encryption key
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
    
    # Update .env with generated key (escape special chars for sed)
    ESCAPED_KEY=$(echo "$ENCRYPTION_KEY" | sed 's/[&/\\]/\\&/g')
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|change-this-to-a-secure-random-key|$ESCAPED_KEY|" .env
    else
        sed -i "s|change-this-to-a-secure-random-key|$ESCAPED_KEY|" .env
    fi
    echo "✅ Generated secure encryption key"
else
    echo "ℹ️  .env file already exists, keeping existing configuration"
fi

# Create data directory
mkdir -p data
echo "✅ Data directory created"

# Build and start
echo ""
echo "🔨 Building Docker image..."
$DOCKER_COMPOSE build

echo ""
echo "🚀 Starting Capsule Budget..."
$DOCKER_COMPOSE up -d

# Wait for container
echo "⏳ Waiting for container to start..."
sleep 5

# Verify container is running
if $DOCKER_COMPOSE ps | grep -q "Up"; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║           ✅  Installation Complete! ✅                     ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "📊 Capsule Budget is running!"
    echo ""
    echo "🌐 Access your budget app at:"
    echo "   • http://localhost:7654"
    if command -v hostname &> /dev/null; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-device-ip")
        echo "   • http://$LOCAL_IP:7654"
    fi
    echo ""
    echo "📁 Installation directory: $(pwd)"
    echo "💾 Data storage: $(pwd)/data"
    echo ""
    echo "🔧 Useful commands (run from $(pwd)):"
    echo "   $DOCKER_COMPOSE logs -f       # View logs"
    echo "   $DOCKER_COMPOSE stop          # Stop Capsule"
    echo "   $DOCKER_COMPOSE restart       # Restart Capsule"
    echo "   $DOCKER_COMPOSE down          # Stop and remove"
    echo ""
    echo "📚 Documentation:"
    echo "   • README.md - Getting started guide"
    echo "   • DEPLOYMENT.md - Deployment details"
    echo ""
    echo "🎉 Happy budgeting with Capsule!"
    echo ""
else
    echo ""
    echo "❌ Container failed to start"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check logs: $DOCKER_COMPOSE logs"
    echo "2. Verify .env file has ENCRYPTION_KEY set"
    echo "3. Check if port 7654 is available"
    echo ""
    exit 1
fi
