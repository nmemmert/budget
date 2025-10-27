'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { DataService } from '../lib/dataService';
import DataInput from '../components/DataInput';
import TransactionEdit from '../components/TransactionEdit';
import EnvelopeCreate from '../components/EnvelopeCreate';
import EnvelopeEdit from '../components/EnvelopeEdit';
import DataExport from '../components/DataExport';
import AuthModal from '../components/AuthModal';
import SetupWizard from '../components/SetupWizard';
import AccountManagement from '../components/AccountManagement';
import GetPaid from '../components/GetPaid';

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

export default function BudgetDashboard() {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [setupCompleted, setSetupCompleted] = useState(false);

  // Modal states
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCreateEnvelope, setShowCreateEnvelope] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);

  // Initialize Firebase auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // Load user data from Firestore
        try {
          const userData = await DataService.loadUserData(user.uid);
          if (userData) {
            setAccounts(userData.accounts || []);
            setEnvelopes(userData.envelopes || []);
            setTransactions(userData.transactions || []);
            setSetupCompleted(userData.setupCompleted || false);
            setShowSetupWizard(!(userData.setupCompleted || false));
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

  // Save data to Firestore whenever data changes
  useEffect(() => {
    if (user && (((accounts || []).length > 0 || (envelopes || []).length > 0 || (transactions || []).length > 0 || setupCompleted))) {
      const saveData = async () => {
        try {
          await DataService.saveUserData(user.uid, { accounts, envelopes, transactions, setupCompleted });
        } catch (error) {
          console.error('Error saving user data:', error);
        }
      };
      saveData();
    }
  }, [user, accounts, envelopes, transactions, setupCompleted]);

  const handleTransactionsAdded = (newTransactions: Transaction[]) => {
    const allTransactions = [...newTransactions];

    // Process income transactions - automatically allocate to envelopes
    newTransactions.forEach(transaction => {
      if (transaction.amount > 0 && !transaction.envelopeId) {
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
                    id: `allocation-${envelope.id}-${Date.now()}-${Math.random()}`,
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
                  id: `allocation-${envelope.id}-${Date.now()}-${Math.random()}`,
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
                  id: `allocation-${envelope.id}-${Date.now()}-${Math.random()}`,
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
    });

    // Add all processed transactions at once
    setTransactions(prevTransactions => [...prevTransactions, ...allTransactions]);
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

    // Validate fixed allocations
    if (hasFixed && fixedTotal !== totalAmount) {
      return { isValid: false, message: 'Fixed allocations do not sum up to the total amount.' };
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
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
    setLoading(false);
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleSetupComplete = (accounts: Account[], envelopes: Envelope[]) => {
    setAccounts(accounts);
    setEnvelopes(envelopes);
    setTransactions([]);
    setSetupCompleted(true);
    setShowSetupWizard(false);
  };

  const handleAccountUpdate = (updatedAccount: Account) => {
    setAccounts(prevAccounts => prevAccounts.map(acc => acc.id === updatedAccount.id ? updatedAccount : acc));
  };

  const handleAccountAdd = (newAccount: Account) => {
    setAccounts(prevAccounts => [...prevAccounts, newAccount]);
  };

  const handleAccountDelete = (accountId: string) => {
    setAccounts(prevAccounts => prevAccounts.filter(acc => acc.id !== accountId));
  };

  const handleEnvelopeUpdate = (updatedEnvelope: Envelope) => {
    setEnvelopes(prevEnvelopes => prevEnvelopes.map(env => env.id === updatedEnvelope.id ? updatedEnvelope : env));
  };

  const handleTransactionEdit = (updatedTransaction: Transaction) => {
    setTransactions(prevTransactions => prevTransactions.map(tx => tx.id === updatedTransaction.id ? updatedTransaction : tx));
  };

  const handleTransactionDelete = (transactionId: string) => {
    setTransactions(prevTransactions => prevTransactions.filter(tx => tx.id !== transactionId));
  };

  const handleCreateEnvelope = (newEnvelope: Envelope) => {
    setEnvelopes(prevEnvelopes => [...prevEnvelopes, newEnvelope]);
  };

  const handleDeleteEnvelope = (envelopeId: string) => {
    setEnvelopes(prevEnvelopes => prevEnvelopes.filter(env => env.id !== envelopeId));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Envelope Budgeting</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentView === 'dashboard' ? 'border-indigo-500 text-gray-900' : ''
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setCurrentView('accounts')}
                  className={`border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentView === 'accounts' ? 'border-indigo-500 text-gray-900' : ''
                  }`}
                >
                  Accounts
                </button>
                <button
                  onClick={() => setCurrentView('transactions')}
                  className={`border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentView === 'transactions' ? 'border-indigo-500 text-gray-900' : ''
                  }`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => setCurrentView('envelopes')}
                  className={`border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentView === 'envelopes' ? 'border-indigo-500 text-gray-900' : ''
                  }`}
                >
                  Envelopes
                </button>
                <button
                  onClick={() => setCurrentView('settings')}
                  className={`border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    currentView === 'settings' ? 'border-indigo-500 text-gray-900' : ''
                  }`}
                >
                  Settings
                </button>
              </div>
            </div>
            <div className="flex items-center">
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign Out
                </button>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium"
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
        ) : (
          <>
            {currentView === 'dashboard' && (
              <div className="px-4 py-6 sm:px-0">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                            <span className="text-white text-sm font-medium">$</span>
                          </div>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                          <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">Total Balance</dt>
                            <dd className="text-lg font-medium text-gray-900">
                              ${accounts.reduce((sum, acc) => sum + acc.balance, 0).toFixed(2)}
                            </dd>
                          </dl>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
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
                  </div>
                  <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
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
                  </div>
                </div>
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
                                {transaction.date.toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center">
                              <p className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${Math.abs(transaction.amount).toFixed(2)}
                              </p>
                              <button
                                onClick={() => setEditingTransaction(transaction)}
                                className="ml-2 text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
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
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <li key={transaction.id}>
                        <div className="px-4 py-4 sm:px-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{transaction.description}</p>
                              <p className="text-sm text-gray-500">
                                {transaction.date.toLocaleDateString()} • {accounts.find(acc => acc.id === transaction.accountId)?.name}
                              </p>
                            </div>
                            <div className="flex items-center">
                              <p className={`text-sm font-medium ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${Math.abs(transaction.amount).toFixed(2)}
                              </p>
                              <button
                                onClick={() => setEditingTransaction(transaction)}
                                className="ml-2 text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
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
                    <div key={envelope.id} className="bg-white overflow-hidden shadow rounded-lg">
                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-3"
                              style={{ backgroundColor: envelope.color }}
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
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Allocated</span>
                            <span>${envelope.allocated.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>Spent</span>
                            <span>${envelope.spent.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-medium text-gray-900">
                            <span>Remaining</span>
                            <span>${(envelope.allocated - envelope.spent).toFixed(2)}</span>
                          </div>
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
            {currentView === 'settings' && (
              <div className="px-4 py-6 sm:px-0">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
                <DataExport
                  envelopes={envelopes}
                  transactions={transactions}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals and Components */}
      {showAuthModal && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthSuccess={handleAuthSuccess} />}
      {showSetupWizard && <SetupWizard onComplete={handleSetupComplete} onSkip={() => setShowSetupWizard(false)} />}
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
          onCancel={() => setEditingEnvelope(null)}
          accounts={accounts.map(acc => ({ id: acc.id, name: acc.name }))}
        />
      )}

      {/* Always visible components */}
      <DataInput
        onTransactionsAdded={handleTransactionsAdded}
        envelopes={envelopes.map(env => ({ id: env.id, name: env.name }))}
        accounts={accounts.map(acc => ({ id: acc.id, name: acc.name }))}
      />
      <GetPaid
        accounts={accounts}
        envelopes={envelopes}
        onIncomeAdded={handleTransactionsAdded}
        onAccountUpdate={handleAccountUpdate}
      />
    </div>
  );
}
