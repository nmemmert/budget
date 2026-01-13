# Capsule Budget - ZimaOS Deployment Guide

## Quick Deploy

1. **Clone or upload this repository to your ZimaOS device**

2. **Run the deployment script:**
   ```bash
   ./deploy.sh
   ```

   This will:
   - Generate a secure encryption key
   - Clear any test data
   - Build the Docker image
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
   docker-compose up -d
   ```

## Data Persistence

**IMPORTANT: Your data is safely stored outside the Docker container**

### How It Works

The Docker setup uses a **bind mount** to persist data:

```yaml
volumes:
  - ./data:/app/data  # Host directory : Container directory
```

- **Host Location**: `./data/` (on your ZimaOS filesystem)
- **Container Location**: `/app/data/` (inside the container)
- **What's Stored**: 
  - User credentials (hashed)
  - Budget data (encrypted)
  - Transaction history
  - Envelope configurations

### Data Survives

✅ Container restarts  
✅ Container rebuilds  
✅ Docker Compose down/up  
✅ System reboots (with restart: unless-stopped)  

### Data is Lost If

❌ You delete the `./data` directory  
❌ You run `docker-compose down -v` (removes volumes)

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

### Data Location on ZimaOS

Depending on where you deploy:
- **SMB/File Manager**: Check the upload location
- **SSH Deployment**: Usually `/mnt/your-pool/apps/capsule/data`
- **Docker Apps**: May be in `/var/lib/docker/volumes/`

To find exact location:
```bash
docker inspect capsule-budget | grep -A 10 "Mounts"
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
docker-compose logs -f

# Stop Capsule
docker-compose stop

# Restart Capsule
docker-compose restart

# Stop and remove container
docker-compose down

# Rebuild after updates
docker-compose build --no-cache
docker-compose up -d
```

## Updating Capsule

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
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
docker-compose logs

# Verify .env file exists
ls -la .env
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
- Check logs: `docker-compose logs -f`
