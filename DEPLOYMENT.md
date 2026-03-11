# Capsule Budget Deployment Guide

## Rocky Linux + Cockpit + Podman (Recommended)

This is the easiest path for Rocky Linux servers managed with Cockpit.

### 1) Install prerequisites on Rocky Linux

```bash
sudo dnf install -y podman podman-compose cockpit cockpit-podman git
sudo systemctl enable --now cockpit.socket
```

Optional firewall rules:

```bash
sudo firewall-cmd --add-service=cockpit --permanent
sudo firewall-cmd --add-port=7654/tcp --permanent
sudo firewall-cmd --reload
```

### 2) Clone and configure Capsule

```bash
git clone https://github.com/nmemmert/budget.git capsule-budget
cd capsule-budget
cp .env.example .env
```

Generate and set encryption key:

```bash
openssl rand -base64 32
# paste the value into .env as ENCRYPTION_KEY=...
```

### 3) Deploy with Podman Compose

```bash
podman-compose up -d --build
```

If your Podman version provides the compose subcommand, this also works:

```bash
podman compose up -d --build
```

### 4) Manage in Cockpit

1. Open Cockpit at `https://your-server:9090`
2. Go to **Podman Containers**
3. Verify `capsule-budget` is running
4. Use Logs/Start/Stop/Restart directly from Cockpit

Access Capsule at: `http://your-server:7654`

## Installation Methods

### Method 1: Clone and Deploy (Recommended for Private Repos)

If the repository is private, clone it first:

```bash
# Clone the repository
git clone https://github.com/nmemmert/budget.git capsule-budget
cd capsule-budget

# Run the deploy script
./deploy.sh
```

**Access at:** `http://your-zima-ip:7654`

### Method 2: One-Line Installation (Public Repos Only)

If the repository is public:

```bash
curl -fsSL https://raw.githubusercontent.com/nmemmert/budget/master/install.sh | bash
```

---

## Quick Deploy (Manual)

1. **Clone or upload this repository to your ZimaOS device**

2. **Run the deployment script:**
   ```bash
   ./deploy.sh
   ```

   This will:
   - Generate a secure encryption key
   - Clear any test data
   - Build the container image
   - Start the container

3. **Access Capsule:**
   - Open browser to `http://your-zima-ip:7654`
   - Create your account and start budgeting!

## Manual Deployment

If you prefer manual setup:

1. **Create .env file:**
   ```bash
   cp .env.example .env
   ```

2. **Generate encryption key:**
   ```bash
   openssl rand -base64 32
   ```
   
3. **Update .env with your key:**
   ```bash
   ENCRYPTION_KEY=your-generated-key-here
   ```

4. **Build and start:**
   ```bash
   podman-compose up -d
   ```

## Data Persistence

**IMPORTANT: Your data is safely stored outside the container**

### How It Works

The compose setup uses a **bind mount** to persist data:

```yaml
volumes:
   - ./data:/app/data:Z  # Host directory : Container directory
```

- **Host Location**: `./data/` (on your host filesystem)
- **Container Location**: `/app/data/` (inside the container)
- **What's Stored**: 
  - User credentials (hashed)
  - Budget data (encrypted)
  - Transaction history
  - Envelope configurations

### Data Survives

✅ Container restarts  
✅ Container rebuilds  
✅ Podman Compose down/up  
✅ System reboots (with restart: unless-stopped)  

### Data is Lost If

❌ You delete the `./data` directory  
❌ You run `podman-compose down -v` (removes volumes)

### Testing Persistence

Run the included test script:
```bash
./test-persistence.sh
```

This verifies that:
1. Data directory is correctly mounted
2. Files created in container appear on host
3. Data survives container restarts

### Backup Your Data

**Recommended backup schedule:**

```bash
# Quick backup
cp -r data data-backup-$(date +%Y%m%d)

# Compressed backup
tar -czf capsule-backup-$(date +%Y%m%d).tar.gz data/

# Restore from backup
tar -xzf capsule-backup-YYYYMMDD.tar.gz
```

**Using ZimaOS:**
- Enable automatic snapshots for the Capsule directory
- Or use ZimaOS built-in backup features

### Data Location on Rocky Linux / Podman

Depending on where you deploy:
- **SMB/File Manager**: Check the upload location
- **SSH Deployment**: Usually `/mnt/your-pool/apps/capsule/data`
- **Rootful Podman**: Usually under `/var/lib/containers/storage/`
- **Rootless Podman**: Usually under `~/.local/share/containers/storage/`

To find exact location:
```bash
podman inspect capsule-budget | grep -A 10 "Mounts"
```

## ZimaOS Integration

### Using ZimaOS Apps

If ZimaOS supports custom apps:

1. Navigate to Apps section
2. Click "Add Custom App"
3. Point to this directory
4. Configure port: 7654

### Using ZimaOS File Manager

1. Upload project via web interface or SMB
2. SSH into ZimaOS
3. Navigate to project directory
4. Run `./deploy.sh`

## Data Persistence

All user data is stored in `./data/` directory:
- User credentials (hashed)
- Budget data (encrypted with AES-GCM)
- Transaction history

**Backup Strategy:**
```bash
# Backup data
cp -r data data-backup-$(date +%Y%m%d)

# Or use ZimaOS snapshot feature
```

## Management Commands

```bash
# View logs
podman-compose logs -f

# Stop Capsule
podman-compose stop

# Restart Capsule
podman-compose restart

# Stop and remove container
podman-compose down

# Rebuild after updates
podman-compose build --no-cache
podman-compose up -d
```

## Updating Capsule

```bash
# Pull latest changes
git pull

# Rebuild and restart
podman-compose down
podman-compose build
podman-compose up -d
```

Your data in `./data/` will persist across updates.

## Security Notes

- Change the default ENCRYPTION_KEY before first use
- Keep your `.env` file secure and never commit it
- Use ZimaOS firewall to restrict access if needed
- Consider VPN-only access for additional security

## Troubleshooting

### Container won't start
```bash
# Check logs
podman-compose logs

# Verify .env file exists
ls -la .env
```

### Error: Failed to transpile next.config.ts / Cannot find module 'typescript'

Cause: production containers prune devDependencies, and `next.config.ts` requires TypeScript at runtime.

Fix:
```bash
# Pull latest changes that include next.config.mjs
git pull

# Rebuild image without cache and restart
podman-compose down
podman-compose build --no-cache
podman-compose up -d
```

### Error: EACCES permission denied on /app/data/locks

Cause: bind mount permissions/labels are not writable for the Podman container context.

Fix:
```bash
# Stop container
podman-compose down

# Ensure data dir exists and is writable
mkdir -p data
chmod 0777 data

# Rebuild and restart (compose now uses :Z,U)
podman-compose build --no-cache
podman-compose up -d
```

If SELinux is enforcing and issues persist:
```bash
ls -ldZ data
podman unshare chown -R 0:0 data
```

### Port already in use
Edit `docker-compose.yml` and change port mapping:
```yaml
ports:
  - "8080:7654"  # Change 8080 to your preferred port
```

### Data not persisting
Ensure `./data` directory has correct permissions:
```bash
chmod 755 data
```

## Support

For issues or questions:
- GitHub: https://github.com/nmemmert/budget
- Check logs: `podman-compose logs -f`
