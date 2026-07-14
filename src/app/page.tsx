'use client';

import { useState, useEffect } from 'react';
import { AuthService } from '../lib/authService';
import { DataService } from '../lib/dataService';
import DataInput from '../components/DataInput';
import TransactionEdit from '../components/TransactionEdit';
import EnvelopeCreate from '../components/EnvelopeCreate';
import EnvelopeEdit from '../components/EnvelopeEdit';
import DataExport from '../components/DataExport';
import AuthModal from '../components/AuthModal';
import SetupWizard from '../components/SetupWizard';
import AccountManagement from '../components/AccountManagement';
import DashboardCharts from '../components/DashboardCharts';
import Settings from '../components/Settings';
import GetPaid from '../components/GetPaid';

interface User {
  userId: string;
  email: string;
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

interface Envelope {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
  accountId: string;
  incomeAllocation?: number; // Percentage (0-100) or fixed amount if negative
  incomeAllocationType?: 'percentage' | 'fixed'; // How to interpret incomeAllocation
}

interface Transaction {
  id: string;
  envelopeId?: string;
  amount: number;
  description: string;
  date: Date;
  accountId: string;
}

type ViewMode = 'dashboard' | 'accounts' | 'transactions' | 'envelopes' | 'settings';

const liabilityTypes: Array<Account['type']> = ['credit_card', 'mortgage', 'loan'];
const normalizeBalanceByType = (type: Account['type'], balance: number): number => {
  if (liabilityTypes.includes(type)) {
    return -Math.abs(balance || 0);
  }
  return balance || 0;
};

export default function BudgetDashboard() {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showGetPaidModal, setShowGetPaidModal] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [setupCompleted, setSetupCompleted] = useState(false);

  // Dashboard section order and visibility
  const [dashboardSections, setDashboardSections] = useState([
    { id: 'summaryCards', label: 'Summary Cards', visible: true },
    { id: 'charts', label: 'Analytics Charts', visible: true },
    { id: 'budgetProgress', label: 'Budget Progress', visible: true },
    { id: 'quickActions', label: 'Quick Actions', visible: true },
    { id: 'recentTransactions', label: 'Recent Transactions', visible: true },
  ]);
  const [showDashboardSettings, setShowDashboardSettings] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Modal states
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCreateEnvelope, setShowCreateEnvelope] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);

  // Initialize auth listener
  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        // Set user ID for DataService
        DataService.setUserId(user.userId);
        
        // Load user data
        try {
          const userData = await DataService.loadUserData();
          if (userData) {
            // Convert date strings to Date objects
            const transactionsWithDates = (userData.transactions || []).map((transaction) => ({
              ...transaction,
              date: typeof transaction.date === 'string' ? new Date(transaction.date) : transaction.date,
            }));

            const accountsWithBaseline = (userData.accounts || []).map((account) => {
              const accountTransactions = transactionsWithDates.filter((transaction) => transaction.accountId === account.id);
              const transactionTotal = accountTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
              const inferredBase = account.startingBalance ?? account.balance - transactionTotal;
              const startingBalance = normalizeBalanceByType(account.type, inferredBase);
              return { ...account, startingBalance, balance: startingBalance + transactionTotal };
            });

            setAccounts(accountsWithBaseline);
            setEnvelopes(userData.envelopes || []);
            setTransactions(transactionsWithDates);
            setSetupCompleted(userData.setupCompleted || false);
            
            // Show setup wizard if setup is not completed OR if there are no accounts
            const shouldShowWizard = !(userData.setupCompleted || false) || accountsWithBaseline.length === 0;
            setShowSetupWizard(shouldShowWizard);
          } else {
            // New user - show setup wizard
            setShowSetupWizard(true);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          // On error, assume new user and show setup wizard
          setShowSetupWizard(true);
        }
      } else {
        // Clear data when user logs out
        DataService.setUserId(null);
        setAccounts([]);
        setEnvelopes([]);
        setTransactions([]);
        setSetupCompleted(false);
        setShowSetupWizard(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Save data whenever data changes (with debouncing to prevent race conditions)
  useEffect(() => {
    if (user && (((accounts || []).length > 0 || (envelopes || []).length > 0 || (transactions || []).length > 0 || setupCompleted))) {
      const debounceTimer = setTimeout(async () => {
        try {
          // Recalculate envelope spent amounts before saving
          const updatedEnvelopes = calculateEnvelopeSpending(envelopes, transactions);
          // Recalculate account balances before saving
          const updatedAccounts = calculateAccountBalances(accounts, transactions);
          
          await DataService.saveUserData({ 
            accounts: updatedAccounts, 
            envelopes: updatedEnvelopes, 
            transactions, 
            setupCompleted 
          });
        } catch (error) {
          console.error('Error saving user data:', error);
        }
      }, 1000); // Debounce saves by 1 second
      
      return () => clearTimeout(debounceTimer);
    }
  }, [user, accounts, envelopes, transactions, setupCompleted]);

  // Calculate envelope spending from transactions
  const calculateEnvelopeSpending = (envelopes: Envelope[], transactions: Transaction[]): Envelope[] => {
    return envelopes.map(envelope => {
      const envelopeTransactions = transactions.filter(t => t.envelopeId === envelope.id);
      const spent = envelopeTransactions.reduce((sum, t) => {
        // Track spending from negative amounts (expenses)
        // Positive amounts are income allocations to the envelope
        return sum + (t.amount < 0 ? Math.abs(t.amount) : 0);
      }, 0);
      // Keep allocated as-is; income allocations are stored in transactions, not in allocated
      return { ...envelope, spent };
    });
  };

  // Calculate account balances from transactions
  const calculateAccountBalances = (accounts: Account[], transactions: Transaction[]): Account[] => {
    const accountTransactionMap = new Map<string, Transaction[]>();
    transactions.forEach((transaction) => {
      if (!accountTransactionMap.has(transaction.accountId)) {
        accountTransactionMap.set(transaction.accountId, []);
      }
      accountTransactionMap.get(transaction.accountId)!.push(transaction);
    });

    return accounts.map((account) => {
      const accountTransactions = accountTransactionMap.get(account.id) || [];
      const transactionTotal = accountTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      const baseBalance = normalizeBalanceByType(account.type, account.startingBalance ?? account.balance ?? 0);
      return { ...account, startingBalance: baseBalance, balance: baseBalance + transactionTotal };
    });
  };

  const handleTransactionsAdded = (newTransactions: Transaction[]) => {
    const allTransactions = [...newTransactions];

    // Process income transactions - automatically allocate to envelopes
    // BUT: only if allocations weren't already created by GetPaid
    newTransactions.forEach(transaction => {
      if (transaction.amount > 0 && !transaction.envelopeId) {
        // Check if this income already has corresponding allocations in newTransactions
        const hasExistingAllocations = newTransactions.some(
          t => t.accountId === transaction.accountId && 
               t.envelopeId && 
               t.description.includes('→')
        );

        // Only create auto-allocations if none exist
        if (!hasExistingAllocations) {
          // This is income - allocate to envelopes based on custom settings or proportionally
          const accountEnvelopes = envelopes.filter(env => env.accountId === transaction.accountId);
          const envelopesWithAllocation = accountEnvelopes.filter(env => env.incomeAllocation && env.incomeAllocationType);

          if (envelopesWithAllocation.length > 0) {
            // Validate allocations before processing
            const validation = validateIncomeAllocation(envelopesWithAllocation, transaction.amount);
            if (!validation.isValid) {
              console.warn('Invalid income allocation detected, falling back to proportional');
              // Fall back to proportional allocation if validation fails
              const totalAllocated = accountEnvelopes.reduce((sum, env) => sum + env.allocated, 0);
              if (accountEnvelopes.length > 0 && totalAllocated > 0) {
                accountEnvelopes.forEach(envelope => {
                  const proportion = envelope.allocated / totalAllocated;
                  const allocatedAmount = transaction.amount * proportion;
                  if (allocatedAmount > 0) {
                    allTransactions.push({
                      id: crypto.randomUUID(),
                      envelopeId: envelope.id,
                      amount: allocatedAmount,
                      description: `Income allocation - ${envelope.name}`,
                      date: transaction.date,
                      accountId: transaction.accountId,
                    });
                  }
                });
              }
            } else {
              // Use custom allocation settings
              envelopesWithAllocation.forEach(envelope => {
                let allocatedAmount = 0;
                if (envelope.incomeAllocationType === 'percentage') {
                  allocatedAmount = transaction.amount * (envelope.incomeAllocation! / 100);
                } else if (envelope.incomeAllocationType === 'fixed') {
                  allocatedAmount = Math.min(envelope.incomeAllocation!, transaction.amount);
                }

                if (allocatedAmount > 0) {
                  allTransactions.push({
                    id: crypto.randomUUID(),
                    envelopeId: envelope.id,
                    amount: allocatedAmount,
                    description: `Income allocation - ${envelope.name}`,
                    date: transaction.date,
                    accountId: transaction.accountId,
                  });
                }
              });
            }
          } else {
            // No specific envelope allocation found, fall back to proportional allocation
            const totalAllocated = accountEnvelopes.reduce((sum, env) => sum + env.allocated, 0);
            if (accountEnvelopes.length > 0 && totalAllocated > 0) {
              accountEnvelopes.forEach(envelope => {
                const proportion = envelope.allocated / totalAllocated;
                const allocatedAmount = transaction.amount * proportion;
                if (allocatedAmount > 0) {
                  allTransactions.push({
                    id: crypto.randomUUID(),
                    envelopeId: envelope.id,
                    amount: allocatedAmount,
                    description: `Income allocation - ${envelope.name}`,
                    date: transaction.date,
                    accountId: transaction.accountId,
                  });
                }
              });
            }
          }
        }
      }
    });

    // Add all processed transactions at once and immediately recompute derived balances
    setTransactions(prevTransactions => [...prevTransactions, ...allTransactions]);
    
    // Recalculate envelopes and accounts with the new transactions
    const updatedTransactions = [...transactions, ...allTransactions];
    setEnvelopes(calculateEnvelopeSpending(envelopes, updatedTransactions));
    setAccounts(calculateAccountBalances(accounts, updatedTransactions));
  };

  const validateIncomeAllocation = (envelopes: Envelope[], totalAmount: number) => {
    let fixedTotal = 0;
    let percentageTotal = 0;
    let hasFixed = false;
    let hasPercentage = false;

    envelopes.forEach(envelope => {
      if (envelope.incomeAllocationType === 'fixed') {
        fixedTotal += envelope.incomeAllocation!;
        hasFixed = true;
      } else if (envelope.incomeAllocationType === 'percentage') {
        percentageTotal += envelope.incomeAllocation!;
        hasPercentage = true;
      }
    });

    // Check for conflicting allocation types
    if (hasFixed && hasPercentage) {
      return { isValid: false, message: 'Conflicting allocation types (fixed and percentage) detected.' };
    }

    // Validate fixed allocations - allow partial allocation (don't require exact match)
    if (hasFixed && fixedTotal > totalAmount) {
      return { isValid: false, message: 'Fixed allocations exceed the total amount.' };
    }

    // Validate percentage allocations
    if (hasPercentage && (percentageTotal < 0 || percentageTotal > 100)) {
      return { isValid: false, message: 'Percentage allocations must be between 0 and 100.' };
    }

    return { isValid: true };
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await AuthService.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setLoading(false);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleSetupComplete = (accounts: Account[], envelopes: Envelope[]) => {
    const accountsWithBaseline = accounts.map((account) => {
      const baseBalance = normalizeBalanceByType(account.type, account.startingBalance ?? account.balance);
      return { ...account, startingBalance: baseBalance, balance: baseBalance };
    });
    setAccounts(accountsWithBaseline);
    setEnvelopes(envelopes);
    setTransactions([]);
    setSetupCompleted(true);
    setShowSetupWizard(false);
  };

  const handleAccountUpdate = (updatedAccount: Account) => {
    setAccounts((prevAccounts) => {
      const baseBalance = normalizeBalanceByType(updatedAccount.type, updatedAccount.startingBalance ?? updatedAccount.balance);
      const nextAccounts = prevAccounts.map((account) =>
        account.id === updatedAccount.id ? { ...updatedAccount, startingBalance: baseBalance } : account,
      );
      return calculateAccountBalances(nextAccounts, transactions);
    });
  };

  const handleAccountAdd = (newAccount: Account) => {
    setAccounts((prevAccounts) => {
      const baseBalance = normalizeBalanceByType(newAccount.type, newAccount.startingBalance ?? newAccount.balance);
      const nextAccounts = [...prevAccounts, { ...newAccount, startingBalance: baseBalance }];
      return calculateAccountBalances(nextAccounts, transactions);
    });
  };

  const handleAccountDelete = (accountId: string) => {
    setAccounts(prevAccounts => prevAccounts.filter(acc => acc.id !== accountId));
  };

  const handleEnvelopeUpdate = (updatedEnvelope: Envelope) => {
    setEnvelopes(prevEnvelopes => prevEnvelopes.map(env => env.id === updatedEnvelope.id ? updatedEnvelope : env));
  };

  const handleTransactionEdit = (updatedTransaction: Transaction) => {
    setTransactions(prevTransactions => {
      const newTransactions = prevTransactions.map(tx => tx.id === updatedTransaction.id ? updatedTransaction : tx);
      setEnvelopes(calculateEnvelopeSpending(envelopes, newTransactions));
      setAccounts(calculateAccountBalances(accounts, newTransactions));
      return newTransactions;
    });
  };

  const handleTransactionDelete = (transactionId: string) => {
    setTransactions(prevTransactions => {
      const newTransactions = prevTransactions.filter(tx => tx.id !== transactionId);
      setEnvelopes(calculateEnvelopeSpending(envelopes, newTransactions));
      setAccounts(calculateAccountBalances(accounts, newTransactions));
      return newTransactions;
    });
  };

  const handleCreateEnvelope = (newEnvelope: Envelope) => {
    setEnvelopes(prevEnvelopes => [...prevEnvelopes, newEnvelope]);
  };

  const handleDeleteEnvelope = (envelopeId: string) => {
    // Remove envelope and unassign any transactions linked to it
    setEnvelopes(prevEnvelopes => prevEnvelopes.filter(env => env.id !== envelopeId));
    // Unassign transactions from deleted envelope (don't delete transactions)
    setTransactions(prevTransactions => prevTransactions.map(tx => 
      tx.envelopeId === envelopeId ? { ...tx, envelopeId: undefined } : tx
    ));
  };

  const renderLanding = () => (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <img 
              src="/images/capsule-logo.svg" 
              alt="Capsule Logo" 
              className="w-12 h-12"
            />
            <span className="text-lg font-bold" style={{ color: 'var(--color-dark-navy)' }}>Capsule</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ color: 'var(--color-dark-navy)' }}>
            Take control of your money with smart envelopes
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Create envelopes, track spending, and auto-allocate income across accounts. Get set up in minutes with our guided wizard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex justify-center items-center px-5 py-3 rounded-lg text-white font-semibold shadow hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--color-primary-blue)' }}
            >
              Get Started
            </button>
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex justify-center items-center px-5 py-3 rounded-lg border-2 font-semibold transition-colors"
              style={{ borderColor: 'var(--color-primary-blue)', color: 'var(--color-primary-blue)' }}
            >
              Sign In
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-finance-green)' }} aria-hidden="true"></span>
              Auto-save & offline-ready data
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary-blue)' }} aria-hidden="true"></span>
              Guided setup wizard
            </div>
          </div>
        </div>
        <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
          <div className="flex flex-col items-center justify-center mb-8">
            <img 
              src="/images/capsule-logo.svg" 
              alt="Capsule Logo" 
              className="w-24 h-24 mb-4"
            />
            <h2 className="text-2xl font-bold text-center" style={{ color: 'var(--color-dark-navy)' }}>
              Capsule
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-finance-green)' }}>Smart Envelope Budgeting</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(30, 115, 190, 0.05)', borderColor: 'var(--color-cloud-blue)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-primary-blue)' }}>Total Balance</p>
              <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-dark-navy)' }}>$0.00</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-primary-blue)' }}>Link accounts to see your starting balance</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(40, 167, 69, 0.05)', borderColor: 'var(--color-finance-green)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-finance-green)' }}>Envelopes</p>
              <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-dark-navy)' }}>Organize spending</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-finance-green)' }}>Create categories with color-coded envelopes</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ backgroundColor: 'rgba(167, 216, 248, 0.1)', borderColor: 'var(--color-cloud-blue)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-primary-blue)' }}>Income Auto-Allocation</p>
              <p className="text-3xl font-bold mt-2" style={{ color: 'var(--color-dark-navy)' }}>Smart distribution</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-primary-blue)' }}>Allocate paychecks by percentage or fixed amounts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b" style={{ borderBottomColor: 'var(--color-cloud-blue)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <div className="flex items-center space-x-3">
                <img 
                  src="/images/capsule-logo.svg" 
                  alt="Capsule Logo" 
                  className="w-10 h-10"
                />
                <div>
                  <h1 className="text-xl font-bold" style={{ color: 'var(--color-dark-navy)' }}>
                    <span className="logo-text">Capsule</span>
                  </h1>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-primary-blue)' }}>by NeCloud</p>
                </div>
              </div>
            </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    currentView === 'dashboard' 
                      ? 'border-b-2 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={{
                    borderBottomColor: currentView === 'dashboard' ? 'var(--color-primary-blue)' : 'transparent'
                  }}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('accounts')}
                  className={`border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    currentView === 'accounts' 
                      ? 'border-b-2 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={{
                    borderBottomColor: currentView === 'accounts' ? 'var(--color-primary-blue)' : 'transparent'
                  }}
                >
                  Accounts
                </button>
                <button
                  onClick={() => setCurrentView('transactions')}
                  className={`border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    currentView === 'transactions' 
                      ? 'border-b-2 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={{
                    borderBottomColor: currentView === 'transactions' ? 'var(--color-primary-blue)' : 'transparent'
                  }}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setCurrentView('envelopes')}
                  className={`border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    currentView === 'envelopes' 
                      ? 'border-b-2 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={{
                    borderBottomColor: currentView === 'envelopes' ? 'var(--color-primary-blue)' : 'transparent'
                  }}
                >
                  Envelopes
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`border-transparent inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    currentView === 'settings' 
                      ? 'border-b-2 text-gray-900' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  style={{
                    borderBottomColor: currentView === 'settings' ? 'var(--color-primary-blue)' : 'transparent'
                  }}
                >
                  Settings
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {user && setupCompleted && (
                <button
                  onClick={() => setShowGetPaidModal(true)}
                  className="text-white px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--color-finance-green)' }}
                >
                  💰 Get Paid
                </button>
              )}
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="text-white px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#DC2626' }}
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-white px-3 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary-blue)' }}
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {loading ? (
          <div className="text-center">Loading...</div>
        ) : !user ? (
          renderLanding()
        ) : (
          <>
            {currentView === 'dashboard' && (
              <div className="px-4 py-6 sm:px-0">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                  <button
                    onClick={() => setShowDashboardSettings(!showDashboardSettings)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                    title="Customize dashboard sections"
                  >
                    ⚙️ {showDashboardSettings ? 'Hide' : 'Customize'}
                  </button>
                </div>

                {/* Dashboard Settings Panel */}
                {showDashboardSettings && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Arrange Dashboard Sections</h3>
                    <p className="text-sm text-gray-600 mb-4">Drag sections to reorder, or toggle visibility with the checkboxes</p>
                    <div className="space-y-2">
                      {dashboardSections.map((section, index) => (
                        <div
                          key={section.id}
                          draggable
                          onDragStart={() => setDraggedIndex(index)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (draggedIndex !== null && draggedIndex !== index) {
                              const newSections = [...dashboardSections];
                              const [removed] = newSections.splice(draggedIndex, 1);
                              newSections.splice(index, 0, removed);
                              setDashboardSections(newSections);
                              setDraggedIndex(null);
                            }
                          }}
                          className={`flex items-center justify-between p-4 bg-white border-2 rounded-lg cursor-move hover:border-blue-400 transition-all ${
                            draggedIndex === index ? 'opacity-50 border-blue-400' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-gray-400 text-xl">⋮⋮</span>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={section.visible}
                                onChange={(e) => {
                                  const newSections = [...dashboardSections];
                                  newSections[index].visible = e.target.checked;
                                  setDashboardSections(newSections);
                                }}
                                className="w-4 h-4 text-blue-600 rounded"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-sm font-medium text-gray-700">{section.label}</span>
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                if (index > 0) {
                                  const newSections = [...dashboardSections];
                                  [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
                                  setDashboardSections(newSections);
                                }
                              }}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => {
                                if (index < dashboardSections.length - 1) {
                                  const newSections = [...dashboardSections];
                                  [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
                                  setDashboardSections(newSections);
                                }
                              }}
                              disabled={index === dashboardSections.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Dynamic Dashboard Sections */}
                {dashboardSections.filter(s => s.visible).map((section) => {
                  switch (section.id) {
                    case 'summaryCards':
                      return (
                        <div key={section.id} className="mb-12">
                          {(() => {
                            const assetTypes: Account['type'][] = ['checking', 'savings', 'investment'];
                            const debtTypes: Account['type'][] = ['credit_card', 'mortgage', 'loan'];
                            const totalAssets = accounts.filter(acc => assetTypes.includes(acc.type)).reduce((sum, acc) => sum + acc.balance, 0);
                            const totalDebt = Math.abs(accounts.filter(acc => debtTypes.includes(acc.type)).reduce((sum, acc) => sum + acc.balance, 0));
                            const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

                            return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                      {/* Total Assets */}
                      <button
                        onClick={() => setCurrentView('accounts')}
                        className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                                <span className="text-white text-sm font-medium">+</span>
                              </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Total Assets</dt>
                                <dd className="text-lg font-medium text-green-600">${totalAssets.toFixed(2)}</dd>
                              </dl>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Total Debt */}
                      <button
                        onClick={() => setCurrentView('accounts')}
                        className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                                <span className="text-white text-sm font-medium">−</span>
                              </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Total Debt</dt>
                                <dd className="text-lg font-medium text-red-600">${totalDebt.toFixed(2)}</dd>
                              </dl>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Total Balance */}
                      <button
                        onClick={() => setCurrentView('accounts')}
                        className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary-blue)' }}>
                                <span className="text-white text-sm font-medium">$</span>
                              </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Total Balance</dt>
                                <dd className={`text-lg font-medium ${totalBalance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  ${totalBalance.toFixed(2)}
                                </dd>
                              </dl>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Envelopes */}
                      <button
                        onClick={() => setCurrentView('envelopes')}
                        className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                                <span className="text-white text-sm font-medium">E</span>
                              </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Envelopes</dt>
                                <dd className="text-lg font-medium text-gray-900">{envelopes.length}</dd>
                              </dl>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Transactions */}
                      <button
                        onClick={() => setCurrentView('transactions')}
                        className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                      >
                        <div className="p-5">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                                <span className="text-white text-sm font-medium">T</span>
                              </div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                              <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate">Transactions</dt>
                                <dd className="text-lg font-medium text-gray-900">{transactions.length}</dd>
                              </dl>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                            );
                          })()}
                        </div>
                      );

                    case 'charts':
                      return (
                        <div key={section.id} className="mb-12">
                          <DashboardCharts
                            accounts={accounts}
                            envelopes={envelopes}
                            transactions={transactions}
                          />
                        </div>
                      );

                    case 'budgetProgress':
                      return (
                        <div key={section.id} className="mb-12">
                          {(() => {
                            const now = new Date();
                            const currentMonth = now.getMonth();
                            const currentYear = now.getFullYear();
                            const monthTransactions = transactions.filter(t => {
                              const tDate = t.date instanceof Date ? t.date : new Date(t.date);
                              return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
                            });
                            const totalBudget = envelopes.reduce((sum, env) => sum + env.allocated, 0);
                            const totalSpent = monthTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
                            const budgetProgress = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

                            return (
                              <div className="bg-white shadow rounded-lg p-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Progress This Month</h3>
                                <div className="space-y-4">
                                  <div>
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-sm font-medium text-gray-700">Total Spending</span>
                                      <span className="text-sm font-medium text-gray-900">${totalSpent.toFixed(2)} of ${totalBudget.toFixed(2)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                      <div
                                        className={`h-3 rounded-full transition-all ${
                                          budgetProgress >= 100 ? 'bg-red-500' : budgetProgress >= 80 ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}
                                        style={{ width: `${Math.min(budgetProgress, 100)}%` }}
                                      />
                                    </div>
                                    <p className="text-sm text-gray-600 mt-2">{budgetProgress}% of monthly budget used</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );

                    case 'quickActions':
                      return (
                        <div key={section.id} className="mb-12">
                          <div className="bg-white shadow rounded-lg p-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => setCurrentView('transactions')}
                                className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-center"
                              >
                                <div className="text-xl mb-1">➕</div>
                                <span className="text-sm font-medium text-gray-900">Add Transaction</span>
                              </button>
                              <button
                                onClick={() => setCurrentView('envelopes')}
                                className="p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors text-center"
                              >
                                <div className="text-xl mb-1">📦</div>
                                <span className="text-sm font-medium text-gray-900">Manage Envelopes</span>
                              </button>
                              <button
                                onClick={() => setCurrentView('accounts')}
                                className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-center"
                              >
                                <div className="text-xl mb-1">🏦</div>
                                <span className="text-sm font-medium text-gray-900">Accounts</span>
                              </button>
                              <button
                                onClick={() => setShowGetPaidModal(true)}
                                className="p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors text-center"
                              >
                                <div className="text-xl mb-1">💰</div>
                                <span className="text-sm font-medium text-gray-900">Record Income</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );

                    case 'recentTransactions':
                      return (
                        <div key={section.id} className="mb-12">
                          <div className="bg-white shadow overflow-hidden sm:rounded-md">
                            <div className="px-4 py-5 sm:px-6">
                              <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Transactions</h3>
                            </div>
                            <ul className="divide-y divide-gray-200">
                              {transactions.slice(-5).reverse().map((transaction) => (
                                <li key={transaction.id}>
                                  <div className="px-4 py-4 sm:px-6">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center">
                                        <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                                        <p className="ml-2 text-sm text-gray-500">
                                          {transaction.date instanceof Date ? transaction.date.toLocaleDateString() : new Date(transaction.date).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <p className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          ${Math.abs(transaction.amount).toFixed(2)}
                                        </p>
                                        <button
                                          onClick={() => setEditingTransaction(transaction)}
                                          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium transition-colors"
                                          aria-label={`Edit transaction: ${transaction.description}`}
                                          title={`Edit transaction: ${transaction.description}`}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (confirm('Are you sure you want to delete this transaction?')) {
                                              handleTransactionDelete(transaction.id);
                                            }
                                          }}
                                          className="text-red-600 hover:text-red-900 text-sm font-medium transition-colors"
                                          aria-label={`Delete transaction: ${transaction.description}`}
                                          title={`Delete transaction: ${transaction.description}`}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );

                    default:
                      return null;
                  }
                })}
              </div>
            )}
            {currentView === 'accounts' && (
              <div className="px-4 py-6 sm:px-0">
                <AccountManagement
                  accounts={accounts}
                  onAccountAdd={handleAccountAdd}
                  onAccountUpdate={handleAccountUpdate}
                  onAccountDelete={handleAccountDelete}
                />
              </div>
            )}
            {currentView === 'transactions' && (
              <div className="px-4 py-6 sm:px-0">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Transactions</h2>
                
                {/* Add Transactions Form */}
                <DataInput
                  onTransactionsAdded={handleTransactionsAdded}
                  envelopes={envelopes}
                  accounts={accounts.map(acc => ({ id: acc.id, name: acc.name }))}
                  transactions={transactions}
                />
                
                {/* All Transactions List */}
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">All Transactions</h3>
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <li key={transaction.id}>
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                              <p className="text-sm text-gray-500">
                                {transaction.date instanceof Date ? transaction.date.toLocaleDateString() : new Date(transaction.date).toLocaleDateString()} • {accounts.find(acc => acc.id === transaction.accountId)?.name}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <p className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${Math.abs(transaction.amount).toFixed(2)}
                              </p>
                              <button
                                onClick={() => setEditingTransaction(transaction)}
                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium transition-colors"
                                aria-label={`Edit transaction: ${transaction.description}`}
                                title={`Edit transaction: ${transaction.description}`}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this transaction?')) {
                                    handleTransactionDelete(transaction.id);
                                  }
                                }}
                                className="text-red-600 hover:text-red-900 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {currentView === 'envelopes' && (
              <div className="px-4 py-6 sm:px-0">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Envelopes</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {envelopes.map((envelope) => (
                    <div key={envelope.id} className="bg-white overflow-hidden shadow rounded-lg" role="article" aria-label={`Envelope: ${envelope.name}`}>
                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-3"
                              style={{ backgroundColor: envelope.color }}
                              role="img"
                              aria-label={`Color indicator`}
                            ></div>
                            <h3 className="text-lg font-medium text-gray-900">{envelope.name}</h3>
                          </div>
                          <button
                            onClick={() => setEditingEnvelope(envelope)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="mt-4">
                          {(() => {
                            // Calculate income allocated to this envelope
                            const incomeAllocated = transactions
                              .filter(t => t.envelopeId === envelope.id && t.amount > 0)
                              .reduce((sum, t) => sum + t.amount, 0);
                            const totalAllocated = envelope.allocated + incomeAllocated;
                            const remaining = totalAllocated - envelope.spent;
                            return (
                              <>
                                <div className="flex justify-between text-sm text-gray-600">
                                  <span>Allocated</span>
                                  <span>${totalAllocated.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm text-gray-600">
                                  <span>Spent</span>
                                  <span>${envelope.spent.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-medium text-gray-900">
                                  <span>Remaining</span>
                                  <span>${remaining.toFixed(2)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateEnvelope(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Create Envelope
                  </button>
                </div>
              </div>
            )}
            {currentView === 'settings' && user && setupCompleted && (
              <Settings
                user={user}
                onAccountDeleted={() => {
                  setCurrentView('dashboard');
                  setUser(null);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Modals and Components */}
      {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthSuccess={handleAuthSuccess} />}
      {showSetupWizard && <SetupWizard onComplete={handleSetupComplete} onSkip={() => setShowSetupWizard(false)} userId={user?.userId || ''} />}
      {showGetPaidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div onClick={(e) => e.stopPropagation()} className="w-full">
            <GetPaid
              accounts={accounts}
              envelopes={envelopes}
              onIncomeAdded={(txns) => {
                handleTransactionsAdded(txns);
                setShowGetPaidModal(false);
              }}
              onAccountUpdate={handleAccountUpdate}
              autoOpen={true}
            />
          </div>
        </div>
      )}
      {editingTransaction && (
        <TransactionEdit
          transaction={editingTransaction}
          envelopes={envelopes.map(env => ({ id: env.id, name: env.name }))}
          accounts={accounts.map(acc => ({ id: acc.id, name: acc.name }))}
          onSave={(updatedTransaction) => {
            handleTransactionEdit(updatedTransaction);
            setEditingTransaction(null);
          }}
          onCancel={() => setEditingTransaction(null)}
        />
      )}
      {showCreateEnvelope && (
        <EnvelopeCreate
          onEnvelopeCreated={(newEnvelope) => {
            handleCreateEnvelope(newEnvelope);
            setShowCreateEnvelope(false);
          }}
          onCancel={() => setShowCreateEnvelope(false)}
          accounts={accounts.map(acc => ({ id: acc.id, name: acc.name }))}
        />
      )}
      {editingEnvelope && (
        <EnvelopeEdit
          envelope={editingEnvelope}
          onEnvelopeUpdated={(updatedEnvelope) => {
            handleEnvelopeUpdate(updatedEnvelope);
            setEditingEnvelope(null);
          }}
          onEnvelopeDeleted={handleDeleteEnvelope}
          onCancel={() => setEditingEnvelope(null)}
          accounts={accounts.map(acc => ({ id: acc.id, name: acc.name }))}
        />
      )}
    </div>
  );
}
