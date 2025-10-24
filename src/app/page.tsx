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
    if (user && (accounts.length > 0 || envelopes.length > 0 || transactions.length > 0 || setupCompleted)) {
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

  const handleSetupComplete = (setupData: {
    accounts: Account[];
    envelopes: Envelope[];
    transactions: Transaction[];
  }) => {
    setAccounts(setupData.accounts);
    setEnvelopes(setupData.envelopes);
    setTransactions(setupData.transactions);
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

  const handleDataExport = (exportData: { accounts: Account[]; envelopes: Envelope[]; transactions: Transaction[] }) => {
    // Implement data export logic here (e.g., download CSV, send to server, etc.)
    console.log('Exporting data:', exportData);
  };

  return (
    <div>
      {/* Render components based on current view */}
      {currentView === 'dashboard' && <div>Dashboard View</div>}
      {currentView === 'accounts' && <div>Accounts View</div>}
      {currentView === 'transactions' && <div>Transactions View</div>}
      {currentView === 'envelopes' && <div>Envelopes View</div>}
      {currentView === 'settings' && <div>Settings View</div>}

      {/* Auth modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={handleAuthSuccess} />}

      {/* Setup wizard */}
      {showSetupWizard && <SetupWizard onComplete={handleSetupComplete} />}

      {/* Data input component */}
      <DataInput
        onDataImported={(importedData) => {
          // Handle imported data (e.g., from CSV)
          console.log('Imported data:', importedData);
        }}
      />

      {/* Transaction edit component */}
      {editingTransaction && (
        <TransactionEdit
          transaction={editingTransaction}
          onSave={(updatedTransaction) => {
            handleTransactionEdit(updatedTransaction);
            setEditingTransaction(null);
          }}
          onCancel={() => setEditingTransaction(null)}
        />
      )}

      {/* Envelope create/edit component */}
      {showCreateEnvelope && (
        <EnvelopeCreate
          onCreate={(newEnvelope) => {
            handleCreateEnvelope(newEnvelope);
            setShowCreateEnvelope(false);
          }}
          onCancel={() => setShowCreateEnvelope(false)}
        />
      )}
      {editingEnvelope && (
        <EnvelopeEdit
          envelope={editingEnvelope}
          onSave={(updatedEnvelope) => {
            handleEnvelopeUpdate(updatedEnvelope);
            setEditingEnvelope(null);
          }}
          onCancel={() => setEditingEnvelope(null)}
        />
      )}

      {/* Data export component */}
      <DataExport
        accounts={accounts}
        envelopes={envelopes}
        transactions={transactions}
        onExport={handleDataExport}
      />

      {/* Account management component */}
      <AccountManagement
        accounts={accounts}
        onAccountAdd={handleAccountAdd}
        onAccountUpdate={handleAccountUpdate}
        onAccountDelete={handleAccountDelete}
      />

      {/* Get Paid component */}
      <GetPaid
        accounts={accounts}
        envelopes={envelopes}
        onIncomeAdded={handleTransactionsAdded}
        onAccountUpdate={handleAccountUpdate}
      />
    </div>
  );
}
