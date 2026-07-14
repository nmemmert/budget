import path from 'path';
import { promises as fsPromises } from 'fs';
import bcrypt from 'bcryptjs';
import { encryptData, decryptData } from '@/lib/crypto';
import { generateSecret, verifyTOTP } from '@/lib/totp';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const RESET_TOKENS_FILE = path.join(DATA_DIR, 'reset_tokens.json');
const SHARES_FILE = path.join(DATA_DIR, 'shares.json');
const TEMP_TOKENS_FILE = path.join(DATA_DIR, 'temp_tokens.json');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

interface Share {
  ownerUserId: string;
  ownerEmail: string;
  targetEmail: string;
  accountId: string;
  role: 'view' | 'edit';
  createdAt: string;
}

interface Shares { [shareId: string]: Share }

async function initializeDirectories() {
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
    for (const file of [USERS_FILE, SESSIONS_FILE, RESET_TOKENS_FILE, SHARES_FILE, TEMP_TOKENS_FILE]) {
      try {
        await fsPromises.access(file);
      } catch {
        await fsPromises.writeFile(file, JSON.stringify({}), 'utf-8');
      }
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
  totpSecret?: string;
  totpEnabled?: boolean;
  pendingTotpSecret?: string;
}

interface TempToken { userId: string; email: string; expiresAt: string }
interface TempTokens { [token: string]: TempToken }

interface Users {
  [email: string]: UserCredentials;
}

interface Session {
  userId: string;
  email: string;
  expiresAt: string;
}

interface Sessions {
  [token: string]: Session;
}

interface ResetToken {
  email: string;
  expiresAt: string;
}

interface ResetTokens {
  [token: string]: ResetToken;
}

class FileLock {
  private static locks = new Map<string, Promise<void>>();

  static async acquire(key: string): Promise<() => void> {
    const existingLock = this.locks.get(key);
    if (existingLock) await existingLock;

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

function validatePasswordStrength(password: string): void {
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
}

async function readJson<T>(file: string): Promise<T> {
  const content = await fsPromises.readFile(file, 'utf-8');
  return JSON.parse(content) as T;
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fsPromises.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}

export class FileStorageService {
  static async registerUser(email: string, password: string): Promise<{ userId: string; email: string; sessionToken: string }> {
    validatePasswordStrength(password);
    const releaseLock = await FileLock.acquire('users-file');

    try {
      const users = await readJson<Users>(USERS_FILE);

      if (users[email]) throw new Error('User already exists');

      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 12);

      users[email] = { email, passwordHash, userId };
      await writeJson(USERS_FILE, users);

      const encryptedData = await encryptData(JSON.stringify({
        accounts: [], envelopes: [], transactions: [], setupCompleted: false,
      }), ENCRYPTION_KEY);
      await writeJson(path.join(DATA_DIR, `${userId}.json`), {
        data: encryptedData, lastUpdated: new Date().toISOString(),
      });

      const sessionToken = await this._createSession(userId, email);
      return { userId, email, sessionToken };
    } finally {
      releaseLock();
    }
  }

  static async loginUser(email: string, password: string): Promise<
    | { userId: string; email: string; sessionToken: string; requiresTOTP?: false }
    | { requiresTOTP: true; tempToken: string }
  > {
    const users = await readJson<Users>(USERS_FILE);
    const user = users[email];

    const hashToCompare = user?.passwordHash ?? '$2a$12$invalidhashpadding000000000000000000000000000000000000000';
    const valid = await bcrypt.compare(password, hashToCompare);

    if (!user || !valid) throw new Error('Invalid credentials');

    if (user.totpEnabled && user.totpSecret) {
      const releaseLock = await FileLock.acquire('temp-tokens');
      try {
        const temps = await readJson<TempTokens>(TEMP_TOKENS_FILE);
        const tempToken = crypto.randomUUID();
        temps[tempToken] = { userId: user.userId, email: user.email, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() };
        await writeJson(TEMP_TOKENS_FILE, temps);
        return { requiresTOTP: true, tempToken };
      } finally {
        releaseLock();
      }
    }

    const sessionToken = await this._createSession(user.userId, email);
    return { userId: user.userId, email: user.email, sessionToken };
  }

  static async completeTOTPLogin(tempToken: string, totpCode: string): Promise<{ userId: string; email: string; sessionToken: string }> {
    const temps = await readJson<TempTokens>(TEMP_TOKENS_FILE);
    const record = temps[tempToken];
    if (!record) throw new Error('Invalid or expired token');
    if (new Date(record.expiresAt) < new Date()) throw new Error('Token expired — please sign in again');

    const users = await readJson<Users>(USERS_FILE);
    const user = Object.values(users).find(u => u.userId === record.userId);
    if (!user?.totpSecret) throw new Error('2FA not configured');

    if (!verifyTOTP(user.totpSecret, totpCode)) throw new Error('Invalid 2FA code');

    const releaseLock = await FileLock.acquire('temp-tokens');
    try {
      const temps2 = await readJson<TempTokens>(TEMP_TOKENS_FILE);
      delete temps2[tempToken];
      await writeJson(TEMP_TOKENS_FILE, temps2);
    } finally {
      releaseLock();
    }

    const sessionToken = await this._createSession(record.userId, record.email);
    return { userId: record.userId, email: record.email, sessionToken };
  }

  static async setup2FA(userId: string): Promise<{ secret: string; otpAuthUrl: string }> {
    const { getOtpAuthUrl } = await import('@/lib/totp');
    const users = await readJson<Users>(USERS_FILE);
    const userEntry = Object.entries(users).find(([, u]) => u.userId === userId);
    if (!userEntry) throw new Error('User not found');

    const secret = generateSecret();
    const [email, user] = userEntry;
    users[email] = { ...user, pendingTotpSecret: secret };
    await writeJson(USERS_FILE, users);

    return { secret, otpAuthUrl: getOtpAuthUrl(secret, email) };
  }

  static async enable2FA(userId: string, token: string): Promise<void> {
    const releaseLock = await FileLock.acquire('users-file');
    try {
      const users = await readJson<Users>(USERS_FILE);
      const entry = Object.entries(users).find(([, u]) => u.userId === userId);
      if (!entry) throw new Error('User not found');
      const [email, user] = entry;
      if (!user.pendingTotpSecret) throw new Error('No pending 2FA setup — start setup first');
      if (!verifyTOTP(user.pendingTotpSecret, token)) throw new Error('Invalid code — please check your authenticator app');
      users[email] = { ...user, totpSecret: user.pendingTotpSecret, totpEnabled: true, pendingTotpSecret: undefined };
      await writeJson(USERS_FILE, users);
    } finally {
      releaseLock();
    }
  }

  static async disable2FA(userId: string, token: string): Promise<void> {
    const releaseLock = await FileLock.acquire('users-file');
    try {
      const users = await readJson<Users>(USERS_FILE);
      const entry = Object.entries(users).find(([, u]) => u.userId === userId);
      if (!entry) throw new Error('User not found');
      const [email, user] = entry;
      if (!user.totpEnabled || !user.totpSecret) throw new Error('2FA is not enabled');
      if (!verifyTOTP(user.totpSecret, token)) throw new Error('Invalid 2FA code');
      users[email] = { ...user, totpSecret: undefined, totpEnabled: false, pendingTotpSecret: undefined };
      await writeJson(USERS_FILE, users);
    } finally {
      releaseLock();
    }
  }

  static async get2FAStatus(userId: string): Promise<boolean> {
    const users = await readJson<Users>(USERS_FILE);
    const user = Object.values(users).find(u => u.userId === userId);
    return user?.totpEnabled ?? false;
  }

  static async validateSession(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const sessions = await readJson<Sessions>(SESSIONS_FILE);
      const session = sessions[token];
      if (!session) return null;
      if (new Date(session.expiresAt) < new Date()) {
        // Expired — clean up lazily
        delete sessions[token];
        await writeJson(SESSIONS_FILE, sessions);
        return null;
      }
      return { userId: session.userId, email: session.email };
    } catch {
      return null;
    }
  }

  static async deleteSession(token: string): Promise<void> {
    try {
      const sessions = await readJson<Sessions>(SESSIONS_FILE);
      delete sessions[token];
      await writeJson(SESSIONS_FILE, sessions);
    } catch {
      // ignore
    }
  }

  static async generatePasswordResetToken(email: string): Promise<string> {
    const users = await readJson<Users>(USERS_FILE);
    if (!users[email]) throw new Error('User not found');

    const releaseLock = await FileLock.acquire('reset-tokens');
    try {
      const tokens = await readJson<ResetTokens>(RESET_TOKENS_FILE);
      const token = crypto.randomUUID();
      tokens[token] = { email, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString() };
      await writeJson(RESET_TOKENS_FILE, tokens);
      return token;
    } finally {
      releaseLock();
    }
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    validatePasswordStrength(newPassword);
    const releaseLock = await FileLock.acquire('users-file');

    try {
      const tokens = await readJson<ResetTokens>(RESET_TOKENS_FILE);
      const record = tokens[token];
      if (!record) throw new Error('Invalid or expired reset token');
      if (new Date(record.expiresAt) < new Date()) throw new Error('Reset token has expired');

      const users = await readJson<Users>(USERS_FILE);
      if (!users[record.email]) throw new Error('User not found');

      users[record.email].passwordHash = await bcrypt.hash(newPassword, 12);
      await writeJson(USERS_FILE, users);

      delete tokens[token];
      await writeJson(RESET_TOKENS_FILE, tokens);
    } finally {
      releaseLock();
    }
  }

  static async saveUserData(userId: string, data: any): Promise<void> {
    const userDataFile = path.join(DATA_DIR, `${userId}.json`);
    const releaseLock = await FileLock.acquire(`user-${userId}`);

    try {
      const serialized = {
        ...data,
        transactions: (data.transactions || []).map((t: any) => ({
          ...t,
          date: t.date instanceof Date ? t.date.toISOString() : t.date,
        })),
      };

      const encryptedData = await encryptData(JSON.stringify(serialized), ENCRYPTION_KEY);
      await writeJson(userDataFile, { data: encryptedData, lastUpdated: new Date().toISOString() });
    } finally {
      releaseLock();
    }
  }

  static async loadUserData(userId: string): Promise<any> {
    const userDataFile = path.join(DATA_DIR, `${userId}.json`);

    try {
      const fileData = await readJson<{ data: string }>(userDataFile);
      const decryptedData = await decryptData(fileData.data, ENCRYPTION_KEY);
      const parsed = JSON.parse(decryptedData);

      return {
        ...parsed,
        transactions: (parsed.transactions || []).map((t: any) => ({
          ...t,
          date: typeof t.date === 'string' ? t.date : new Date(t.date).toISOString(),
        })),
      };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return { accounts: [], envelopes: [], transactions: [], setupCompleted: false };
      }
      throw error;
    }
  }

  static async deleteUser(userId: string, sessionToken?: string): Promise<void> {
    const releaseLock = await FileLock.acquire('users-file');

    try {
      const userDataFile = path.join(DATA_DIR, `${userId}.json`);
      try {
        await fsPromises.unlink(userDataFile);
      } catch (error) {
        if ((error as any).code !== 'ENOENT') throw error;
      }

      const users = await readJson<Users>(USERS_FILE);
      const userEmail = Object.keys(users).find(email => users[email].userId === userId);
      if (userEmail) {
        delete users[userEmail];
        await writeJson(USERS_FILE, users);
      }

      if (sessionToken) await this.deleteSession(sessionToken);
    } finally {
      releaseLock();
    }
  }

  static async createShare(ownerUserId: string, ownerEmail: string, targetEmail: string, accountId: string, role: 'view' | 'edit'): Promise<string> {
    const users = await readJson<Users>(USERS_FILE);
    if (!Object.values(users).some(u => u.email === targetEmail)) {
      throw new Error('No Capsule account found for that email address');
    }
    const releaseLock = await FileLock.acquire('shares-file');
    try {
      const shares = await readJson<Shares>(SHARES_FILE);
      // Prevent duplicate shares for same account+email
      const existing = Object.entries(shares).find(
        ([, s]) => s.ownerUserId === ownerUserId && s.accountId === accountId && s.targetEmail === targetEmail
      );
      if (existing) return existing[0];
      const shareId = crypto.randomUUID();
      shares[shareId] = { ownerUserId, ownerEmail, targetEmail, accountId, role, createdAt: new Date().toISOString() };
      await writeJson(SHARES_FILE, shares);
      return shareId;
    } finally {
      releaseLock();
    }
  }

  static async listShares(email: string, userId: string): Promise<{ received: Array<Share & { shareId: string }>; owned: Array<Share & { shareId: string }> }> {
    const shares = await readJson<Shares>(SHARES_FILE);
    const received = Object.entries(shares)
      .filter(([, s]) => s.targetEmail === email)
      .map(([shareId, s]) => ({ shareId, ...s }));
    const owned = Object.entries(shares)
      .filter(([, s]) => s.ownerUserId === userId)
      .map(([shareId, s]) => ({ shareId, ...s }));
    return { received, owned };
  }

  static async getShareData(shareId: string, requestorEmail: string): Promise<{ account: any; envelopes: any[]; transactions: any[] } | null> {
    const shares = await readJson<Shares>(SHARES_FILE);
    const share = shares[shareId];
    if (!share || share.targetEmail !== requestorEmail) return null;
    const data = await this.loadUserData(share.ownerUserId);
    const account = data.accounts?.find((a: any) => a.id === share.accountId);
    if (!account) return null;
    const envelopes = (data.envelopes || []).filter((e: any) => e.accountId === share.accountId);
    const transactions = (data.transactions || []).filter((t: any) => t.accountId === share.accountId);
    return { account, envelopes, transactions };
  }

  static async revokeShare(shareId: string, requestorUserId: string): Promise<void> {
    const releaseLock = await FileLock.acquire('shares-file');
    try {
      const shares = await readJson<Shares>(SHARES_FILE);
      const share = shares[shareId];
      if (!share) return;
      if (share.ownerUserId !== requestorUserId && share.targetEmail !== requestorUserId) {
        throw new Error('Not authorized to revoke this share');
      }
      delete shares[shareId];
      await writeJson(SHARES_FILE, shares);
    } finally {
      releaseLock();
    }
  }

  private static async _createSession(userId: string, email: string): Promise<string> {
    const releaseLock = await FileLock.acquire('sessions-file');
    try {
      const sessions = await readJson<Sessions>(SESSIONS_FILE);
      const token = crypto.randomUUID() + '-' + crypto.randomUUID();
      sessions[token] = {
        userId,
        email,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      };
      await writeJson(SESSIONS_FILE, sessions);
      return token;
    } finally {
      releaseLock();
    }
  }
}
