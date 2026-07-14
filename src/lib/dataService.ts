import { AuthService } from './authService';

interface Envelope {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
  accountId: string;
  incomeAllocation?: number;
  incomeAllocationType?: 'percentage' | 'fixed';
}

interface Transaction {
  id: string;
  envelopeId?: string;
  accountId: string;
  amount: number;
  description: string;
  date: Date | string;
  category?: string;
}

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'mortgage' | 'investment' | 'loan';
  balance: number;
  startingBalance?: number;
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
  goals?: any[];
  transactionRules?: any[];
}

function getAuthHeaders(): HeadersInit {
  const token = AuthService.getSessionToken();
  if (!token) throw new Error('Not authenticated');
  return { 'Content-Type': 'application/json', 'x-session-token': token };
}

export class DataService {
  // kept for legacy callers in page.tsx — no-op now that session handles identity
  static setUserId(_userId: string | null) {}
  static getUserId(): string | null { return AuthService.getCurrentUser()?.userId ?? null; }
  static clearUserId() {}

  static async saveUserData(data: UserData): Promise<void> {
    const response = await fetch('/api/data', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save data');
    }
  }

  static async loadUserData(): Promise<UserData | null> {
    const response = await fetch('/api/data', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to load data');
    }
    const result = await response.json();
    return result.data;
  }

  static async updateUserData(updates: Partial<UserData>): Promise<void> {
    const currentData = await this.loadUserData();
    if (currentData) {
      await this.saveUserData({ ...currentData, ...updates });
    }
  }
}
