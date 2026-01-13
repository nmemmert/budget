import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';
import { createHash } from 'crypto';
import { encryptData, decryptData } from '@/lib/crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const LOCK_DIR = path.join(DATA_DIR, 'locks');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';

// Initialize directories
async function initializeDirectories() {
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
    await fsPromises.mkdir(LOCK_DIR, { recursive: true });
    
    // Ensure users file exists
    try {
      await fsPromises.access(USERS_FILE);
    } catch {
      await fsPromises.writeFile(USERS_FILE, JSON.stringify({}), 'utf-8');
    }
  } catch (error) {
    console.error('Error initializing directories:', error);
  }
}

initializeDirectories();

interface UserCredentials {
  email: string;
  passwordHash: string;
  userId: string;
}

interface Users {
  [email: string]: UserCredentials;
}

// Lock mechanism for concurrent access prevention
class FileLock {
  private static locks = new Map<string, Promise<void>>();
  
  static async acquire(key: string): Promise<() => void> {
    // Wait for any existing lock
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }
    
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.locks.delete(key);
        resolve();
      };
    });
    
    this.locks.set(key, lockPromise);
    
    return releaseLock!;
  }
}

// Simple password hashing (in production, use bcrypt or similar)
async function hashPassword(password: string): Promise<string> {
  // Prefer Web Crypto when available (browser/modern Node), otherwise fall back to Node crypto
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for environments without crypto.subtle
  return createHash('sha256').update(password, 'utf8').digest('hex');
}

export class FileStorageService {
  // User Authentication
  static async registerUser(email: string, password: string): Promise<{ userId: string; email: string }> {
    const releaseLock = await FileLock.acquire('users-file');
    
    try {
      const content = await fsPromises.readFile(USERS_FILE, 'utf-8');
      const users: Users = JSON.parse(content);
      
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

      await fsPromises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

      // Create user data file
      const userDataFile = path.join(DATA_DIR, `${userId}.json`);
      const initialData = {
        accounts: [],
        envelopes: [],
        transactions: [],
        setupCompleted: false,
      };
      
      const encryptedData = await encryptData(JSON.stringify(initialData), ENCRYPTION_KEY);
      await fsPromises.writeFile(userDataFile, JSON.stringify({ data: encryptedData, lastUpdated: new Date().toISOString() }), 'utf-8');

      return { userId, email };
    } finally {
      releaseLock();
    }
  }

  static async loginUser(email: string, password: string): Promise<{ userId: string; email: string }> {
    const content = await fsPromises.readFile(USERS_FILE, 'utf-8');
    const users: Users = JSON.parse(content);
    
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
    const releaseLock = await FileLock.acquire(`user-${userId}`);
    
    try {
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

      await fsPromises.writeFile(userDataFile, JSON.stringify(fileData, null, 2), 'utf-8');
    } finally {
      releaseLock();
    }
  }

  static async loadUserData(userId: string): Promise<any> {
    const userDataFile = path.join(DATA_DIR, `${userId}.json`);
    
    try {
      const fileData = JSON.parse(await fsPromises.readFile(userDataFile, 'utf-8'));
      const decryptedData = await decryptData(fileData.data, ENCRYPTION_KEY);
      const parsed = JSON.parse(decryptedData);

      // Ensure consistent date handling - always return ISO strings
      return {
        ...parsed,
        transactions: (parsed.transactions || []).map((t: any) => ({
          ...t,
          date: typeof t.date === 'string' ? t.date : new Date(t.date).toISOString()
        }))
      };
    } catch (error) {
      // Return default data for new users or on read error
      if ((error as any).code === 'ENOENT') {
        return {
          accounts: [],
          envelopes: [],
          transactions: [],
          setupCompleted: false,
        };
      }
      throw error;
    }
  }

  static async deleteUser(userId: string): Promise<void> {
    const releaseLock = await FileLock.acquire('users-file');
    
    try {
      const userDataFile = path.join(DATA_DIR, `${userId}.json`);
      
      try {
        await fsPromises.unlink(userDataFile);
      } catch (error) {
        // File might not exist, that's ok
        if ((error as any).code !== 'ENOENT') throw error;
      }

      // Also remove from users.json
      const content = await fsPromises.readFile(USERS_FILE, 'utf-8');
      const users: Users = JSON.parse(content);
      const userEmail = Object.keys(users).find(email => users[email].userId === userId);
      if (userEmail) {
        delete users[userEmail];
        await fsPromises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      }
    } finally {
      releaseLock();
    }
  }

  static async resetPassword(email: string, newPassword: string): Promise<void> {
    const releaseLock = await FileLock.acquire('users-file');
    
    try {
      const content = await fsPromises.readFile(USERS_FILE, 'utf-8');
      const users: Users = JSON.parse(content);
      
      if (!users[email]) {
        throw new Error('User not found');
      }

      const passwordHash = await hashPassword(newPassword);
      users[email].passwordHash = passwordHash;

      await fsPromises.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    } finally {
      releaseLock();
    }
  }
}
