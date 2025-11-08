import fs from 'fs';
import path from 'path';
import { encryptData, decryptData } from '@/lib/crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure users file exists
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({}), 'utf-8');
}

interface UserCredentials {
  email: string;
  passwordHash: string;
  userId: string;
}

interface Users {
  [email: string]: UserCredentials;
}

// Simple password hashing (in production, use bcrypt or similar)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class FileStorageService {
  // User Authentication
  static async registerUser(email: string, password: string): Promise<{ userId: string; email: string }> {
    const users: Users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    
    if (users[email]) {
      throw new Error('User already exists');
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    users[email] = {
      email,
      passwordHash,
      userId,
    };

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

    // Create user data file
    const userDataFile = path.join(DATA_DIR, `${userId}.json`);
    const initialData = {
      accounts: [],
      envelopes: [],
      transactions: [],
      setupCompleted: false,
    };
    
    const encryptedData = await encryptData(JSON.stringify(initialData), ENCRYPTION_KEY);
    fs.writeFileSync(userDataFile, JSON.stringify({ data: encryptedData, lastUpdated: new Date().toISOString() }), 'utf-8');

    return { userId, email };
  }

  static async loginUser(email: string, password: string): Promise<{ userId: string; email: string }> {
    const users: Users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    
    const user = users[email];
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const passwordHash = await hashPassword(password);
    if (passwordHash !== user.passwordHash) {
      throw new Error('Invalid credentials');
    }

    return { userId: user.userId, email: user.email };
  }

  // Data Management
  static async saveUserData(userId: string, data: any): Promise<void> {
    const userDataFile = path.join(DATA_DIR, `${userId}.json`);
    
    // Serialize dates
    const serialized = {
      ...data,
      transactions: (data.transactions || []).map((t: any) => ({
        ...t,
        date: t.date instanceof Date ? t.date.toISOString() : t.date
      }))
    };

    const encryptedData = await encryptData(JSON.stringify(serialized), ENCRYPTION_KEY);
    const fileData = {
      data: encryptedData,
      lastUpdated: new Date().toISOString(),
    };

    fs.writeFileSync(userDataFile, JSON.stringify(fileData, null, 2), 'utf-8');
  }

  static async loadUserData(userId: string): Promise<any> {
    const userDataFile = path.join(DATA_DIR, `${userId}.json`);
    
    if (!fs.existsSync(userDataFile)) {
      // Return default data for new users
      return {
        accounts: [],
        envelopes: [],
        transactions: [],
        setupCompleted: false,
      };
    }

    const fileData = JSON.parse(fs.readFileSync(userDataFile, 'utf-8'));
    const decryptedData = await decryptData(fileData.data, ENCRYPTION_KEY);
    const parsed = JSON.parse(decryptedData);

    // Deserialize dates
    return {
      ...parsed,
      transactions: (parsed.transactions || []).map((t: any) => ({
        ...t,
        date: typeof t.date === 'string' ? t.date : new Date(t.date).toISOString()
      }))
    };
  }

  static async deleteUser(userId: string): Promise<void> {
    const userDataFile = path.join(DATA_DIR, `${userId}.json`);
    
    if (fs.existsSync(userDataFile)) {
      fs.unlinkSync(userDataFile);
    }

    // Also remove from users.json
    const users: Users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const userEmail = Object.keys(users).find(email => users[email].userId === userId);
    if (userEmail) {
      delete users[userEmail];
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    }
  }
}
