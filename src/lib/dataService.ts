// Local file-based data service (no Firebase needed)

interface Envelope {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
  accountId: string; // Link envelope to specific account
  incomeAllocation?: number; // Percentage (0-100) or fixed amount if negative
  incomeAllocationType?: 'percentage' | 'fixed'; // How to interpret incomeAllocation
}

interface Transaction {
  id: string;
  envelopeId?: string;
  accountId: string; // Link transaction to specific account
  amount: number;
  description: string;
  date: Date | string; // Support both Date objects and ISO strings
  category?: string;
}

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'mortgage' | 'investment' | 'loan';
  balance: number;
  institution?: string;
  accountNumber?: string;
  color: string;
  isActive: boolean;
  defaultPaycheckAmount?: number;
}

interface UserData {
  accounts: Account[];
  envelopes: Envelope[];
  transactions: Transaction[];
  setupCompleted: boolean;
}

export class DataService {
  private static currentUserId: string | null = null;

  static setUserId(userId: string | null) {
    this.currentUserId = userId;
    if (typeof window !== 'undefined') {
      if (userId) {
        localStorage.setItem('userId', userId);
      } else {
        localStorage.removeItem('userId');
      }
    }
  }

  static getUserId(): string | null {
    if (this.currentUserId) return this.currentUserId;
    if (typeof window !== 'undefined') {
      this.currentUserId = localStorage.getItem('userId');
    }
    return this.currentUserId;
  }

  static clearUserId() {
    this.setUserId(null);
  }

  static async saveUserData(data: UserData): Promise<void> {
    const userId = this.getUserId();
    if (!userId) throw new Error('No user ID set');

    try {
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save data');
      }
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  }

  static async loadUserData(): Promise<UserData | null> {
    const userId = this.getUserId();
    if (!userId) throw new Error('No user ID set');

    try {
      const response = await fetch('/api/data', {
        method: 'GET',
        headers: {
          'x-user-id': userId,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load data');
      }

      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error loading user data:', error);
      throw error;
    }
  }

  static async updateUserData(updates: Partial<UserData>): Promise<void> {
    try {
      const currentData = await this.loadUserData();
      if (currentData) {
        const updatedData = { ...currentData, ...updates };
        await this.saveUserData(updatedData);
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }
}