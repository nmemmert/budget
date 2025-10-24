import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { encryptData, decryptData } from './crypto';

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
  date: Date;
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

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-key-change-in-production';

export class DataService {
  private static async encryptUserData(data: UserData): Promise<string> {
    return await encryptData(JSON.stringify(data), ENCRYPTION_KEY);
  }

  private static async decryptUserData(encryptedData: string): Promise<UserData> {
    const decrypted = await decryptData(encryptedData, ENCRYPTION_KEY);
    return JSON.parse(decrypted);
  }

  static async saveUserData(userId: string, data: UserData): Promise<void> {
    try {
      const encryptedData = await this.encryptUserData(data);
      const userDocRef = doc(db, 'users', userId);
      await setDoc(userDocRef, {
        data: encryptedData,
        lastUpdated: new Date(),
      });
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  }

  static async loadUserData(userId: string): Promise<UserData | null> {
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const encryptedData = userDoc.data()?.data;
        if (encryptedData) {
          return await this.decryptUserData(encryptedData);
        }
      }

      // Return default data if no data exists
      return {
        accounts: [
          {
            id: 'checking-1',
            name: 'Main Checking',
            type: 'checking' as const,
            balance: 2500.00,
            institution: 'Bank of America',
            color: 'bg-blue-500',
            isActive: true,
          },
          {
            id: 'savings-1',
            name: 'Emergency Savings',
            type: 'savings' as const,
            balance: 5000.00,
            institution: 'Bank of America',
            color: 'bg-green-500',
            isActive: true,
          },
        ],
        envelopes: [
          { id: '1', name: 'Groceries', allocated: 500, spent: 0, color: 'bg-green-500', accountId: 'checking-1' },
          { id: '2', name: 'Transportation', allocated: 300, spent: 0, color: 'bg-blue-500', accountId: 'checking-1' },
          { id: '3', name: 'Entertainment', allocated: 200, spent: 0, color: 'bg-purple-500', accountId: 'checking-1' },
          { id: '4', name: 'Utilities', allocated: 250, spent: 0, color: 'bg-orange-500', accountId: 'checking-1' },
        ],
        transactions: [],
        setupCompleted: false,
      };
    } catch (error) {
      console.error('Error loading user data:', error);
      throw error;
    }
  }

  static async updateUserData(userId: string, updates: Partial<UserData>): Promise<void> {
    try {
      const currentData = await this.loadUserData(userId);
      if (currentData) {
        const updatedData = { ...currentData, ...updates };
        await this.saveUserData(userId, updatedData);
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }
}