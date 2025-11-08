# File-Based Storage System

This application uses a local file-based storage system instead of cloud databases like Firebase. All user data is stored on the server in JSON files.

## Architecture

### Storage Location
- All user data is stored in the `/data` directory
- User credentials: `/data/users.json`
- User budget data: `/data/{userId}.json`

### Authentication Flow
1. User registers with email and password
2. Password is hashed using SHA-256
3. User credentials stored in `/data/users.json`
4. Unique userId generated and returned to client
5. Client stores userId in localStorage for session persistence

### Data Storage Flow
1. Client authenticates and receives userId
2. Client makes API calls with userId in headers
3. Server reads/writes user data file at `/data/{userId}.json`
4. Data is encrypted server-side using AES-GCM encryption
5. Encrypted data saved to disk

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
  - Body: `{ email, password }`
  - Returns: `{ userId, email }`

- `POST /api/auth/login` - Login existing user
  - Body: `{ email, password }`
  - Returns: `{ userId, email }`

### Data Operations
- `GET /api/data` - Load user data
  - Headers: `x-user-id: {userId}`
  - Returns: `{ data: UserData }`

- `POST /api/data` - Save user data
  - Headers: `x-user-id: {userId}`
  - Body: `{ accounts, envelopes, transactions, setupCompleted }`
  - Returns: `{ success: true }`

## Security

### Password Security
- Passwords hashed with SHA-256 before storage
- Original passwords never stored
- Hash comparison done server-side

### Data Encryption
- All user budget data encrypted with AES-GCM
- Encryption key stored in environment variable: `ENCRYPTION_KEY`
- 256-bit encryption with PBKDF2 key derivation
- Unique salt and IV for each encryption operation

### Session Management
- UserId stored in browser localStorage
- No sensitive data in browser storage
- Server validates userId on every request
- User can sign out to clear session

## Environment Variables

```bash
# .env.local
ENCRYPTION_KEY=your-32-byte-hex-key-here
```

Generate a secure key with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## File Structure

```
/data
  ├── users.json              # User credentials (email → userId mapping)
  ├── {userId1}.json          # User 1 budget data (encrypted)
  ├── {userId2}.json          # User 2 budget data (encrypted)
  └── .gitignore              # Excludes all JSON files from git
```

## Data Backup

Since all data is stored in local files:
1. **Regular Backups**: Copy `/data` directory to secure backup location
2. **Version Control**: The `/data` directory is gitignored for security
3. **Migration**: Simply copy files to move data between servers
4. **Export**: Users can export their data via the app's export feature

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

3. Generate encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. Update `.env.local` with your encryption key

5. Start development server:
   ```bash
   npm run dev
   ```

## Production Deployment

1. Set environment variable `ENCRYPTION_KEY` on your server
2. Ensure `/data` directory has write permissions
3. Set up automated backups of `/data` directory
4. Use HTTPS for all API communication
5. Consider adding rate limiting to API routes
6. Monitor `/data` directory disk usage

## Migration from Firebase

The app previously used Firebase. The migration to file-based storage included:
- ✅ Removed Firebase SDK dependency
- ✅ Created custom authentication system
- ✅ Implemented file-based data storage
- ✅ Added encryption for data at rest
- ✅ Created API routes for all operations
- ✅ Updated all components to use new auth system

All Firebase code has been removed and replaced with local file storage.
