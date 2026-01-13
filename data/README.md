# Capsule User Data Directory

This directory contains all your encrypted budget data.

## What's Stored Here

- **users.json** - User credentials (SHA-256 hashed passwords)
- **{userId}.json** - Individual user budget data (AES-GCM encrypted)
- **locks/** - File locks for concurrent access protection

## Data Persistence

✅ This directory is **mounted as a Docker volume**  
✅ Data persists across container restarts  
✅ Data persists across container rebuilds  
✅ Data survives system reboots  

## Backup

**Recommended:** Back up this entire directory regularly

```bash
# From parent directory
tar -czf capsule-backup-$(date +%Y%m%d).tar.gz data/
```

## Security

- All budget data is encrypted with AES-GCM
- Passwords are hashed with SHA-256
- NEVER share your ENCRYPTION_KEY
- Keep this directory secure

## File Structure

```
data/
├── users.json              # User accounts
├── user-abc123.json        # User 1 data (encrypted)
├── user-def456.json        # User 2 data (encrypted)
└── locks/                  # File locks
    ├── users.json.lock
    └── ...
```

## Troubleshooting

**Data not persisting?**

Check Docker volume mount:
```bash
docker inspect capsule-budget | grep -A 10 "Mounts"
```

Should show:
```json
"Mounts": [{
    "Source": "/path/to/capsule/data",
    "Destination": "/app/data"
}]
```

**Permission issues?**

Ensure directory has correct permissions:
```bash
chmod 755 data
```
