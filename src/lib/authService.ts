'use client';

export interface User {
  userId: string;
  email: string;
}

export class AuthService {
  private static currentUser: User | null = null;
  private static sessionToken: string | null = null;
  private static authCallbacks: Set<(user: User | null) => void> = new Set();

  static async signUp(email: string, password: string): Promise<User> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Registration failed');
    }

    const result = await response.json();
    this._persist(result.user, result.sessionToken);
    this.notifyAuthChange(result.user);
    return result.user;
  }

  static async signIn(email: string, password: string): Promise<User> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const result = await response.json();

    if (result.requiresTOTP) {
      const err: any = new Error('2FA required');
      err.requiresTOTP = true;
      err.tempToken = result.tempToken;
      throw err;
    }

    this._persist(result.user, result.sessionToken);
    this.notifyAuthChange(result.user);
    return result.user;
  }

  static async signInWithTOTP(tempToken: string, code: string): Promise<User> {
    const response = await fetch('/api/auth/2fa/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, code }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '2FA verification failed');
    }

    const result = await response.json();
    this._persist(result.user, result.sessionToken);
    this.notifyAuthChange(result.user);
    return result.user;
  }

  static async signOut(): Promise<void> {
    const token = this.getSessionToken();
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'x-session-token': token },
      }).catch(() => {});
    }
    this._clear();
    this.notifyAuthChange(null);
  }

  static getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser;
    if (typeof window === 'undefined') return null;

    try {
      const userJson = localStorage.getItem('user');
      if (userJson) this.currentUser = JSON.parse(userJson);
    } catch {}

    return this.currentUser;
  }

  static getSessionToken(): string | null {
    if (this.sessionToken) return this.sessionToken;
    if (typeof window === 'undefined') return null;
    this.sessionToken = localStorage.getItem('sessionToken');
    return this.sessionToken;
  }

  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    this.authCallbacks.add(callback);
    callback(this.getCurrentUser());

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        if (e.newValue) {
          try {
            const user = JSON.parse(e.newValue);
            this.currentUser = user;
            callback(user);
          } catch { callback(null); }
        } else {
          this.currentUser = null;
          callback(null);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
        this.authCallbacks.delete(callback);
      };
    }

    return () => { this.authCallbacks.delete(callback); };
  }

  private static _persist(user: User, token: string): void {
    this.currentUser = user;
    this.sessionToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sessionToken', token);
    }
  }

  private static _clear(): void {
    this.currentUser = null;
    this.sessionToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('userId');
    }
  }

  private static notifyAuthChange(user: User | null): void {
    this.authCallbacks.forEach(cb => { try { cb(user); } catch {} });
  }
}
