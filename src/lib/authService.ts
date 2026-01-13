// Local authentication service (no Firebase needed)

export interface User {
  userId: string;
  email: string;
}

export class AuthService {
  private static currentUser: User | null = null;
  private static authCallbacks: Set<(user: User | null) => void> = new Set();

  static async signUp(email: string, password: string): Promise<User> {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const result = await response.json();
      this.currentUser = result.user;
      
      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      // Notify all listeners
      this.notifyAuthChange(result.user);

      return result.user;
    } catch (error) {
      // Only log non-authentication errors to avoid console spam
      if (!(error instanceof Error) || !error.message.includes('User already exists')) {
        console.error('Sign up error:', error);
      }
      throw error;
    }
  }

  static async signIn(email: string, password: string): Promise<User> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        // Don't log authentication errors to console as they may contain sensitive info
        throw new Error(error.error || 'Login failed');
      }

      const result = await response.json();
      this.currentUser = result.user;

      // Store in localStorage for persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(result.user));
      }

      // Notify all listeners
      this.notifyAuthChange(result.user);

      return result.user;
    } catch (error) {
      // Only log non-authentication errors to avoid console spam
      if (!(error instanceof Error) || !error.message.includes('Invalid credentials')) {
        console.error('Sign in error:', error);
      }
      throw error;
    }
  }

  static async signOut(): Promise<void> {
    this.currentUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
    }
    
    // Notify all listeners
    this.notifyAuthChange(null);
  }

  static getCurrentUser(): User | null {
    if (this.currentUser) return this.currentUser;
    
    if (typeof window !== 'undefined') {
      const userJson = localStorage.getItem('user');
      if (userJson) {
        try {
          this.currentUser = JSON.parse(userJson);
          return this.currentUser;
        } catch (e) {
          console.error('Error parsing stored user:', e);
        }
      }
    }
    
    return null;
  }

  static onAuthStateChanged(callback: (user: User | null) => void): () => void {
    // Add callback to listeners
    this.authCallbacks.add(callback);
    
    // Initial call with current user
    const user = this.getCurrentUser();
    callback(user);

    // Set up listener for storage events (for multi-tab support)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        if (e.newValue) {
          try {
            const user = JSON.parse(e.newValue);
            this.currentUser = user;
            callback(user);
          } catch (err) {
            callback(null);
          }
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

    return () => {
      this.authCallbacks.delete(callback);
    };
  }

  private static notifyAuthChange(user: User | null): void {
    this.authCallbacks.forEach(callback => {
      try {
        callback(user);
      } catch (err) {
        console.error('Error in auth callback:', err);
      }
    });
  }
}
