'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuthService } from '../lib/authService';
import { DataService } from '../lib/dataService';
import DataInput from '../components/DataInput';
import TransactionEdit from '../components/TransactionEdit';
import EnvelopeCreate from '../components/EnvelopeCreate';
import EnvelopeEdit from '../components/EnvelopeEdit';
import AuthModal from '../components/AuthModal';
import SetupWizard from '../components/SetupWizard';
import AccountManagement from '../components/AccountManagement';
import DashboardCharts from '../components/DashboardCharts';
import Settings from '../components/Settings';
import GetPaid from '../components/GetPaid';
import GoalsManager from '../components/GoalsManager';
import TransactionRulesManager from '../components/TransactionRulesManager';
import RecurringTransactionManager from '../components/RecurringTransactionManager';
import SharedAccountManager from '../components/SharedAccountManager';

interface User { userId: string; email: string }

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
  incomeAllocation?: number;
  incomeAllocationType?: 'percentage' | 'fixed';
  rollover?: boolean;
}

interface Transaction {
  id: string;
  envelopeId?: string;
  amount: number;
  description: string;
  date: Date;
  accountId: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  lastAppliedDate?: string;
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  accountId: string;
  targetDate?: string;
  color: string;
}

export interface TransactionRule {
  id: string;
  keyword: string;
  envelopeId: string;
  matchCase: boolean;
}

type ViewMode = 'dashboard' | 'accounts' | 'transactions' | 'envelopes' | 'goals' | 'rules' | 'settings';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const liabilityTypes: Array<Account['type']> = ['credit_card', 'mortgage', 'loan'];

function normalizeBalanceByType(type: Account['type'], balance: number): number {
  return liabilityTypes.includes(type) ? -Math.abs(balance || 0) : (balance || 0);
}

function applyRulesToTransaction(
  tx: Transaction,
  rules: TransactionRule[],
  envelopes: Envelope[],
): Transaction {
  if (tx.envelopeId || tx.amount >= 0) return tx;
  for (const rule of rules) {
    const haystack = rule.matchCase ? tx.description : tx.description.toLowerCase();
    const needle = rule.matchCase ? rule.keyword : rule.keyword.toLowerCase();
    if (haystack.includes(needle) && envelopes.some(e => e.id === rule.envelopeId)) {
      return { ...tx, envelopeId: rule.envelopeId };
    }
  }
  return tx;
}

export default function BudgetDashboard() {
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showGetPaidModal, setShowGetPaidModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [transactionRules, setTransactionRules] = useState<TransactionRule[]>([]);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [sharedAccounts, setSharedAccounts] = useState<Array<{ shareId: string; ownerEmail: string; account: Account; role: string }>>([]);

  // Transaction filters
  const [txSearch, setTxSearch] = useState('');
  const [txDateFrom, setTxDateFrom] = useState('');
  const [txDateTo, setTxDateTo] = useState('');
  const [txAccountFilter, setTxAccountFilter] = useState('');
  const [txEnvelopeFilter, setTxEnvelopeFilter] = useState('');

  // Dashboard customization
  const [dashboardSections, setDashboardSections] = useState([
    { id: 'summaryCards', label: 'Summary Cards', visible: true },
    { id: 'charts', label: 'Analytics Charts', visible: true },
    { id: 'insights', label: 'Spending Insights', visible: true },
    { id: 'budgetProgress', label: 'Budget Progress', visible: true },
    { id: 'goals', label: 'Goals', visible: true },
    { id: 'quickActions', label: 'Quick Actions', visible: true },
    { id: 'recentTransactions', label: 'Recent Transactions', visible: true },
  ]);
  const [showDashboardSettings, setShowDashboardSettings] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Modal states
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showCreateEnvelope, setShowCreateEnvelope] = useState(false);
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [showGoalsManager, setShowGoalsManager] = useState(false);

  // ── Derived helpers ──────────────────────────────────────────────────────────

  const calculateEnvelopeSpending = useCallback((envs: Envelope[], txns: Transaction[]): Envelope[] =>
    envs.map(envelope => {
      const spent = txns
        .filter(t => t.envelopeId === envelope.id && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return { ...envelope, spent };
    }), []);

  const calculateAccountBalances = useCallback((accs: Account[], txns: Transaction[]): Account[] => {
    const map = new Map<string, number>();
    txns.forEach(t => map.set(t.accountId, (map.get(t.accountId) ?? 0) + t.amount));
    return accs.map(acc => {
      const base = normalizeBalanceByType(acc.type, acc.startingBalance ?? acc.balance ?? 0);
      return { ...acc, startingBalance: base, balance: base + (map.get(acc.id) ?? 0) };
    });
  }, []);

  // ── Auth & data load ─────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = AuthService.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        DataService.setUserId(u.userId);
        try {
          const userData = await DataService.loadUserData();
          if (userData) {
            const txnsWithDates = (userData.transactions || []).map((t: any) => ({
              ...t,
              date: typeof t.date === 'string' ? new Date(t.date) : t.date,
            }));
            const accsWithBase = (userData.accounts || []).map((acc: any) => {
              const txTotal = txnsWithDates
                .filter((t: Transaction) => t.accountId === acc.id)
                .reduce((s: number, t: Transaction) => s + t.amount, 0);
              const base = normalizeBalanceByType(acc.type, acc.startingBalance ?? acc.balance - txTotal);
              return { ...acc, startingBalance: base, balance: base + txTotal };
            });
            setAccounts(accsWithBase);
            setEnvelopes(userData.envelopes || []);
            setTransactions(txnsWithDates);
            setGoals(userData.goals || []);
            setTransactionRules(userData.transactionRules || []);
            setSetupCompleted(userData.setupCompleted || false);
            setShowSetupWizard(!(userData.setupCompleted) || accsWithBase.length === 0);

            // Auto-apply due recurring transactions
            autoApplyRecurring(txnsWithDates);

            // Load accounts shared with me
            const sessionToken = AuthService.getSessionToken();
            if (sessionToken) {
              fetch('/api/share/list', { headers: { 'x-session-token': sessionToken } })
                .then(r => r.json())
                .then(async (data) => {
                  const received: any[] = data.received ?? [];
                  const loaded = await Promise.all(received.map(async (share: any) => {
                    const res = await fetch(`/api/share/data?shareId=${share.shareId}`, { headers: { 'x-session-token': sessionToken } });
                    if (!res.ok) return null;
                    const d = await res.json();
                    return { shareId: share.shareId, ownerEmail: share.ownerEmail, account: d.account, role: share.role };
                  }));
                  setSharedAccounts(loaded.filter(Boolean) as any);
                })
                .catch(() => {});
            }
          } else {
            setShowSetupWizard(true);
          }
        } catch {
          setShowSetupWizard(true);
        }
      } else {
        DataService.setUserId(null);
        setAccounts([]); setEnvelopes([]); setTransactions([]);
        setGoals([]); setTransactionRules([]);
        setSetupCompleted(false); setShowSetupWizard(false);
        setSharedAccounts([]);
      }
      setLoading(false);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    if (!accounts.length && !envelopes.length && !transactions.length && !setupCompleted) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        const updatedEnvelopes = calculateEnvelopeSpending(envelopes, transactions);
        const updatedAccounts = calculateAccountBalances(accounts, transactions);
        await DataService.saveUserData({
          accounts: updatedAccounts,
          envelopes: updatedEnvelopes,
          transactions,
          goals,
          transactionRules,
          setupCompleted,
        } as any);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, accounts, envelopes, transactions, goals, transactionRules, setupCompleted,
      calculateEnvelopeSpending, calculateAccountBalances]);

  // ── Recurring transactions ───────────────────────────────────────────────────

  const autoApplyRecurring = (txns: Transaction[]) => {
    const now = new Date();
    const due = txns.filter(t => {
      if (!t.isRecurring || !t.recurringFrequency) return false;
      const last = t.lastAppliedDate ? new Date(t.lastAppliedDate) : t.date;
      const next = new Date(last);
      if (t.recurringFrequency === 'weekly') next.setDate(next.getDate() + 7);
      else if (t.recurringFrequency === 'biweekly') next.setDate(next.getDate() + 14);
      else if (t.recurringFrequency === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (t.recurringFrequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
      return next <= now;
    });

    if (due.length === 0) return;

    const newTxns: Transaction[] = due.map(t => ({
      ...t,
      id: crypto.randomUUID(),
      date: new Date(),
      lastAppliedDate: new Date().toISOString(),
    }));

    setTransactions(prev => {
      const updated = prev.map(t => due.find(d => d.id === t.id)
        ? { ...t, lastAppliedDate: new Date().toISOString() }
        : t);
      return [...updated, ...newTxns];
    });
  };

  const handleApplyRecurring = (dueTxns: Transaction[]) => {
    const now = new Date();
    const newTxns: Transaction[] = dueTxns.map(t => ({
      ...t,
      id: crypto.randomUUID(),
      date: now,
      lastAppliedDate: now.toISOString(),
    }));
    setTransactions(prev => {
      const updated = prev.map(t =>
        dueTxns.find(d => d.id === t.id) ? { ...t, lastAppliedDate: now.toISOString() } : t
      );
      const next = [...updated, ...newTxns];
      setEnvelopes(calculateEnvelopeSpending(envelopes, next));
      setAccounts(calculateAccountBalances(accounts, next));
      return next;
    });
  };

  // ── Event handlers ───────────────────────────────────────────────────────────

  const handleTransactionsAdded = (newTxns: Transaction[]) => {
    // Apply auto-categorization rules
    const ruled = newTxns.map(t => applyRulesToTransaction(t, transactionRules, envelopes));
    const all = [...ruled];

    ruled.forEach(tx => {
      if (tx.amount > 0 && !tx.envelopeId) {
        const accEnvs = envelopes.filter(e => e.accountId === tx.accountId);
        const withAlloc = accEnvs.filter(e => e.incomeAllocation && e.incomeAllocationType);
        const hasFixed = withAlloc.some(e => e.incomeAllocationType === 'fixed');
        const hasPerc = withAlloc.some(e => e.incomeAllocationType === 'percentage');
        const source = withAlloc.length > 0 && !(hasFixed && hasPerc) ? withAlloc : [];

        if (source.length > 0) {
          source.forEach(env => {
            const amt = env.incomeAllocationType === 'percentage'
              ? tx.amount * (env.incomeAllocation! / 100)
              : Math.min(env.incomeAllocation!, tx.amount);
            if (amt > 0) all.push({
              id: crypto.randomUUID(), envelopeId: env.id, amount: amt,
              description: `Income → ${env.name}`, date: tx.date, accountId: tx.accountId,
            });
          });
        } else {
          const totalAlloc = accEnvs.reduce((s, e) => s + e.allocated, 0);
          if (accEnvs.length > 0 && totalAlloc > 0) {
            accEnvs.forEach(env => {
              const amt = tx.amount * (env.allocated / totalAlloc);
              if (amt > 0) all.push({
                id: crypto.randomUUID(), envelopeId: env.id, amount: amt,
                description: `Income → ${env.name}`, date: tx.date, accountId: tx.accountId,
              });
            });
          }
        }
      }
    });

    setTransactions(prev => {
      const next = [...prev, ...all];
      setEnvelopes(calculateEnvelopeSpending(envelopes, next));
      setAccounts(calculateAccountBalances(accounts, next));
      return next;
    });
  };

  const handleSignOut = async () => {
    setLoading(true);
    await AuthService.signOut().catch(() => {});
    setLoading(false);
  };

  const handleSetupComplete = async (accs: Account[], envs: Envelope[]) => {
    // Re-load from server so imported CSV transactions are included
    try {
      const userData = await DataService.loadUserData();
      if (userData) {
        const accsWithBase = (userData.accounts ?? accs).map(a => {
          const base = normalizeBalanceByType(a.type, a.startingBalance ?? a.balance);
          return { ...a, startingBalance: base, balance: base };
        });
        const txnsWithDates = (userData.transactions ?? []).map((t: any) => ({
          ...t,
          date: typeof t.date === 'string' ? new Date(t.date) : t.date,
        }));
        setAccounts(accsWithBase);
        setEnvelopes(userData.envelopes ?? envs);
        setTransactions(txnsWithDates);
        setGoals(userData.goals ?? []);
        setTransactionRules(userData.transactionRules ?? []);
      } else {
        const accsWithBase = accs.map(a => {
          const base = normalizeBalanceByType(a.type, a.startingBalance ?? a.balance);
          return { ...a, startingBalance: base, balance: base };
        });
        setAccounts(accsWithBase);
        setEnvelopes(envs);
        setTransactions([]);
      }
    } catch {
      const accsWithBase = accs.map(a => {
        const base = normalizeBalanceByType(a.type, a.startingBalance ?? a.balance);
        return { ...a, startingBalance: base, balance: base };
      });
      setAccounts(accsWithBase);
      setEnvelopes(envs);
      setTransactions([]);
    }
    setSetupCompleted(true);
    setShowSetupWizard(false);
  };

  const handleAccountUpdate = (updated: Account) => {
    setAccounts(prev => {
      const base = normalizeBalanceByType(updated.type, updated.startingBalance ?? updated.balance);
      const next = prev.map(a => a.id === updated.id ? { ...updated, startingBalance: base } : a);
      return calculateAccountBalances(next, transactions);
    });
  };

  const handleAccountAdd = (newAcc: Account) => {
    setAccounts(prev => {
      const base = normalizeBalanceByType(newAcc.type, newAcc.startingBalance ?? newAcc.balance);
      return calculateAccountBalances([...prev, { ...newAcc, startingBalance: base }], transactions);
    });
  };

  const handleTransactionEdit = (updated: Transaction) => {
    setTransactions(prev => {
      const next = prev.map(t => t.id === updated.id ? updated : t);
      setEnvelopes(e => calculateEnvelopeSpending(e, next));
      setAccounts(a => calculateAccountBalances(a, next));
      return next;
    });
  };

  const handleTransactionDelete = (id: string) => {
    setTransactions(prev => {
      const next = prev.filter(t => t.id !== id);
      setEnvelopes(e => calculateEnvelopeSpending(e, next));
      setAccounts(a => calculateAccountBalances(a, next));
      return next;
    });
  };

  // ── Filtered transactions ────────────────────────────────────────────────────

  const filteredTransactions = transactions.filter(t => {
    if (txSearch && !t.description.toLowerCase().includes(txSearch.toLowerCase())) return false;
    if (txAccountFilter && t.accountId !== txAccountFilter) return false;
    if (txEnvelopeFilter && t.envelopeId !== txEnvelopeFilter) return false;
    const d = t.date instanceof Date ? t.date : new Date(t.date);
    if (txDateFrom && d < new Date(txDateFrom)) return false;
    if (txDateTo && d > new Date(txDateTo + 'T23:59:59')) return false;
    return true;
  }).slice().sort((a, b) => {
    const da = a.date instanceof Date ? a.date : new Date(a.date);
    const db = b.date instanceof Date ? b.date : new Date(b.date);
    return db.getTime() - da.getTime();
  });

  // Running balance (newest-first list — show balance before each transaction)
  const runningBalances = (() => {
    const sorted = [...transactions].sort((a, b) => {
      const da = a.date instanceof Date ? a.date : new Date(a.date);
      const db = b.date instanceof Date ? b.date : new Date(b.date);
      return da.getTime() - db.getTime();
    });
    const balMap = new Map<string, number>();
    sorted.forEach(t => balMap.set(t.id, (balMap.get(t.id) ?? 0)));
    let running = 0;
    const result = new Map<string, number>();
    sorted.forEach(t => {
      running += t.amount;
      result.set(t.id, running);
    });
    return result;
  })();

  // ── Spending insights ────────────────────────────────────────────────────────

  const spendingInsights = (() => {
    const now = new Date();
    const insights: string[] = [];

    for (let i = 0; i < 2; i++) {
      const mo = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const spent = transactions
        .filter(t => {
          const d = t.date instanceof Date ? t.date : new Date(t.date);
          return t.amount < 0 && d >= mo && d <= me;
        })
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      if (i === 0 && spent > 0) insights.push(`This month you've spent $${spent.toFixed(2)} so far.`);
      if (i === 1 && spent > 0) {
        const thisMo = transactions
          .filter(t => {
            const d = t.date instanceof Date ? t.date : new Date(t.date);
            const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
            const m1 = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            return t.amount < 0 && d >= m0 && d <= m1;
          })
          .reduce((s, t) => s + Math.abs(t.amount), 0);
        const diff = thisMo - spent;
        if (Math.abs(diff) > 1) {
          insights.push(diff > 0
            ? `You're spending $${diff.toFixed(2)} more than last month.`
            : `You're spending $${Math.abs(diff).toFixed(2)} less than last month. Great job!`);
        }
      }
    }

    const overspent = envelopes.filter(e => e.allocated > 0 && e.spent > e.allocated);
    if (overspent.length > 0) {
      insights.push(`${overspent.length} envelope${overspent.length > 1 ? 's are' : ' is'} overspent: ${overspent.map(e => e.name).join(', ')}.`);
    }

    const nearLimit = envelopes.filter(e => e.allocated > 0 && e.spent / e.allocated >= 0.8 && e.spent <= e.allocated);
    if (nearLimit.length > 0) {
      insights.push(`${nearLimit.map(e => e.name).join(', ')} ${nearLimit.length > 1 ? 'are' : 'is'} near the budget limit (≥80%).`);
    }

    return insights;
  })();

  // ── Render ───────────────────────────────────────────────────────────────────

  const navBtn = (view: ViewMode, label: string) => (
    <button
      key={view}
      onClick={() => setCurrentView(view)}
      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
        currentView === view ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}
      style={{ borderBottomColor: currentView === view ? 'var(--color-primary-blue)' : 'transparent' }}
    >
      {label}
    </button>
  );

  const renderLanding = () => (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <img src="/images/capsule-logo.svg" alt="Capsule" className="w-12 h-12" />
            <span className="text-lg font-bold" style={{ color: 'var(--color-dark-navy)' }}>Capsule</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight" style={{ color: 'var(--color-dark-navy)' }}>
            Take control of your money with smart envelopes
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Create envelopes, track spending, and auto-allocate income across accounts. Get set up in minutes with our guided wizard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={() => setShowAuthModal(true)}
              className="inline-flex justify-center items-center px-5 py-3 rounded-lg text-white font-semibold shadow hover:opacity-90 transition-opacity"
              style={{ backgroundColor: 'var(--color-primary-blue)' }}>
              Get Started
            </button>
            <button onClick={() => setShowAuthModal(true)}
              className="inline-flex justify-center items-center px-5 py-3 rounded-lg border-2 font-semibold transition-colors"
              style={{ borderColor: 'var(--color-primary-blue)', color: 'var(--color-primary-blue)' }}>
              Sign In
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-finance-green)' }} />
              Auto-save & offline-ready data
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-primary-blue)' }} />
              Guided setup wizard
            </span>
          </div>
        </div>
        <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
          <div className="flex flex-col items-center mb-8">
            <img src="/images/capsule-logo.svg" alt="Capsule" className="w-24 h-24 mb-4" />
            <h2 className="text-2xl font-bold" style={{ color: 'var(--color-dark-navy)' }}>Capsule</h2>
            <p className="text-sm" style={{ color: 'var(--color-finance-green)' }}>Smart Envelope Budgeting</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {[
              { label: 'Total Balance', body: '$0.00', sub: 'Link accounts to see your starting balance', c: 'var(--color-primary-blue)', bg: 'rgba(30,115,190,0.05)', border: 'var(--color-cloud-blue)' },
              { label: 'Envelopes', body: 'Organize spending', sub: 'Create categories with color-coded envelopes', c: 'var(--color-finance-green)', bg: 'rgba(40,167,69,0.05)', border: 'var(--color-finance-green)' },
              { label: 'Income Auto-Allocation', body: 'Smart distribution', sub: 'Allocate paychecks by percentage or fixed amounts', c: 'var(--color-primary-blue)', bg: 'rgba(167,216,248,0.1)', border: 'var(--color-cloud-blue)' },
            ].map(({ label, body, sub, c, bg, border }) => (
              <div key={label} className="p-4 rounded-xl border" style={{ backgroundColor: bg, borderColor: border }}>
                <p className="text-sm font-medium" style={{ color: c }}>{label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-dark-navy)' }}>{body}</p>
                <p className="text-xs mt-1" style={{ color: c }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => {
    const assetTypes: Account['type'][] = ['checking', 'savings', 'investment'];
    const debtTypes: Account['type'][] = ['credit_card', 'mortgage', 'loan'];
    const totalAssets = accounts.filter(a => assetTypes.includes(a.type)).reduce((s, a) => s + a.balance, 0);
    const totalDebt = Math.abs(accounts.filter(a => debtTypes.includes(a.type)).reduce((s, a) => s + a.balance, 0));
    const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthTxns = transactions.filter(t => {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      return d >= monthStart && d <= monthEnd;
    });
    const totalBudget = envelopes.reduce((s, e) => s + e.allocated, 0);
    const totalSpent = monthTxns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const budgetPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    return dashboardSections.filter(s => s.visible).map(section => {
      switch (section.id) {
        case 'summaryCards':
          return (
            <div key={section.id} className="mb-10">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Assets', value: `$${totalAssets.toFixed(2)}`, color: 'bg-green-500', textColor: 'text-green-600', icon: '+', view: 'accounts' as ViewMode },
                  { label: 'Total Debt', value: `$${totalDebt.toFixed(2)}`, color: 'bg-red-500', textColor: 'text-red-600', icon: '−', view: 'accounts' as ViewMode },
                  { label: 'Net Worth', value: `$${totalBalance.toFixed(2)}`, color: 'bg-blue-500', textColor: totalBalance >= 0 ? 'text-blue-600' : 'text-red-600', icon: '$', view: 'accounts' as ViewMode },
                  { label: 'Envelopes', value: envelopes.length.toString(), color: 'bg-purple-500', textColor: 'text-purple-600', icon: 'E', view: 'envelopes' as ViewMode },
                  { label: 'Transactions', value: transactions.length.toString(), color: 'bg-orange-500', textColor: 'text-gray-900', icon: 'T', view: 'transactions' as ViewMode },
                ].map(({ label, value, color, textColor, icon, view }) => (
                  <button key={label} onClick={() => setCurrentView(view)}
                    className="bg-white shadow rounded-lg p-5 hover:shadow-md transition-shadow text-left">
                    <div className="flex items-center">
                      <div className={`w-8 h-8 ${color} rounded-md flex items-center justify-center flex-shrink-0`}>
                        <span className="text-white text-sm font-bold">{icon}</span>
                      </div>
                      <div className="ml-4 min-w-0">
                        <p className="text-xs text-gray-500 truncate">{label}</p>
                        <p className={`text-base font-semibold ${textColor}`}>{value}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );

        case 'charts':
          return (
            <div key={section.id} className="mb-10">
              <DashboardCharts accounts={accounts} envelopes={envelopes} transactions={transactions} />
            </div>
          );

        case 'insights':
          return spendingInsights.length > 0 ? (
            <div key={section.id} className="mb-10">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Spending Insights</h3>
                <ul className="space-y-2">
                  {spendingInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-0.5 text-blue-500 flex-shrink-0">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null;

        case 'budgetProgress':
          return (
            <div key={section.id} className="mb-10">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Progress This Month</h3>
                <div className="flex justify-between items-center mb-2 text-sm font-medium text-gray-700">
                  <span>Total Spending</span>
                  <span>${totalSpent.toFixed(2)} / ${totalBudget.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div className={`h-3 rounded-full transition-all ${budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(budgetPct, 100)}%` }} />
                </div>
                <p className="text-sm text-gray-500 mt-2">{budgetPct}% of monthly budget used</p>
                {/* Per-envelope progress */}
                <div className="mt-4 space-y-2">
                  {envelopes.filter(e => e.allocated > 0).slice(0, 5).map(e => {
                    const pct = Math.round((e.spent / e.allocated) * 100);
                    return (
                      <div key={e.id}>
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                            {e.name}
                            {e.rollover && <span className="text-blue-500 text-xs ml-1" title="Rollover enabled">↻</span>}
                          </span>
                          <span>${e.spent.toFixed(0)} / ${e.allocated.toFixed(0)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: pct < 80 ? e.color : undefined }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );

        case 'goals':
          return goals.length > 0 ? (
            <div key={section.id} className="mb-10">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Goals</h3>
                  <button onClick={() => setCurrentView('goals')}
                    className="text-sm text-blue-600 hover:text-blue-800">Manage →</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {goals.map(g => {
                    const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
                    return (
                      <div key={g.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="font-medium text-gray-900 text-sm">{g.name}</span>
                          <span className="ml-auto text-xs text-gray-500">{pct}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>${g.currentAmount.toFixed(2)}</span>
                          <span>${g.targetAmount.toFixed(2)}</span>
                        </div>
                        {g.targetDate && (
                          <p className="text-xs text-gray-400 mt-1">Target: {new Date(g.targetDate).toLocaleDateString()}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null;

        case 'quickActions':
          return (
            <div key={section.id} className="mb-10">
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: '➕', label: 'Add Transaction', view: 'transactions' as ViewMode, bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
                    { icon: '📦', label: 'Envelopes', view: 'envelopes' as ViewMode, bg: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
                    { icon: '🏦', label: 'Accounts', view: 'accounts' as ViewMode, bg: 'bg-green-50 border-green-200 hover:bg-green-100' },
                    { icon: '🎯', label: 'Goals', view: 'goals' as ViewMode, bg: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100' },
                  ].map(({ icon, label, view, bg }) => (
                    <button key={label} onClick={() => setCurrentView(view)}
                      className={`p-4 border rounded-lg transition-colors text-center ${bg}`}>
                      <div className="text-xl mb-1">{icon}</div>
                      <span className="text-sm font-medium text-gray-900">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );

        case 'recentTransactions':
          return (
            <div key={section.id} className="mb-10">
              <div className="bg-white shadow sm:rounded-md overflow-hidden">
                <div className="px-4 py-4 sm:px-6 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
                  <button onClick={() => setCurrentView('transactions')} className="text-sm text-blue-600 hover:text-blue-800">View all →</button>
                </div>
                <ul className="divide-y divide-gray-200">
                  {transactions.slice().sort((a, b) => {
                    const da = a.date instanceof Date ? a.date : new Date(a.date);
                    const db = b.date instanceof Date ? b.date : new Date(b.date);
                    return db.getTime() - da.getTime();
                  }).slice(0, 5).map(t => {
                    const env = envelopes.find(e => e.id === t.envelopeId);
                    return (
                      <li key={t.id} className="px-4 py-3 sm:px-6 flex items-center justify-between hover:bg-gray-50">
                        <div className="flex items-center gap-3 min-w-0">
                          {env && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: env.color }} />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.description}</p>
                            <p className="text-xs text-gray-400">
                              {(t.date instanceof Date ? t.date : new Date(t.date)).toLocaleDateString()}
                              {env && ` · ${env.name}`}
                            </p>
                          </div>
                        </div>
                        <span className={`text-sm font-medium flex-shrink-0 ml-4 ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.amount >= 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );

        default:
          return null;
      }
    });
  };

  const renderTransactions = () => (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Transactions</h2>
      <DataInput
        onTransactionsAdded={handleTransactionsAdded}
        envelopes={envelopes}
        accounts={accounts.map(a => ({ id: a.id, name: a.name }))}
        transactions={transactions}
      />

      <RecurringTransactionManager
        transactions={transactions}
        onApplyRecurring={handleApplyRecurring}
      />

      {/* Filter bar */}
      <div className="bg-white shadow rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <input
          type="text" placeholder="Search description…" value={txSearch}
          onChange={e => setTxSearch(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={txAccountFilter} onChange={e => setTxAccountFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={txEnvelopeFilter} onChange={e => setTxEnvelopeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All envelopes</option>
          <option value="__none__">No envelope</option>
          {envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <div className="flex gap-2">
          <input type="date" value={txDateFrom} onChange={e => setTxDateFrom(e.target.value)}
            className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="date" value={txDateTo} onChange={e => setTxDateTo(e.target.value)}
            className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
      {(txSearch || txAccountFilter || txEnvelopeFilter || txDateFrom || txDateTo) && (
        <button onClick={() => { setTxSearch(''); setTxAccountFilter(''); setTxEnvelopeFilter(''); setTxDateFrom(''); setTxDateTo(''); }}
          className="text-xs text-blue-600 hover:text-blue-800 mb-3">Clear filters</button>
      )}

      {/* Transaction list */}
      <div className="bg-white shadow sm:rounded-md overflow-hidden">
        <div className="px-4 py-4 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            All Transactions {filteredTransactions.length !== transactions.length && `(${filteredTransactions.length} of ${transactions.length})`}
          </h3>
        </div>
        {filteredTransactions.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No transactions match your filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Envelope</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Account</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Balance</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map(t => {
                  const env = envelopes.find(e => e.id === t.envelopeId);
                  const acc = accounts.find(a => a.id === t.accountId);
                  const runBal = runningBalances.get(t.id) ?? 0;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                        {(t.date instanceof Date ? t.date : new Date(t.date)).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{t.description}</span>
                        {t.isRecurring && <span className="ml-1 text-xs text-blue-500" title="Recurring">↻</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {env ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: env.color }} />
                            <span className="text-gray-600">{env.name}</span>
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{acc?.name ?? '—'}</td>
                      <td className={`px-4 py-3 text-right font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.amount >= 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right hidden lg:table-cell ${runBal >= 0 ? 'text-gray-600' : 'text-red-500'}`}>
                        ${runBal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setEditingTransaction(t)}
                          className="text-indigo-600 hover:text-indigo-900 mr-3 text-xs font-medium">Edit</button>
                        <button onClick={() => { if (confirm('Delete this transaction?')) handleTransactionDelete(t.id); }}
                          className="text-red-500 hover:text-red-800 text-xs font-medium">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderEnvelopes = () => {
    const overspentEnvs = envelopes.filter(e => {
      const incomeAlloc = transactions.filter(t => t.envelopeId === e.id && t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return e.allocated + incomeAlloc > 0 && e.spent > e.allocated + incomeAlloc;
    });

    // Available to budget = liquid assets (checking + savings) minus total envelope allocations
    const liquidBalance = accounts
      .filter(a => a.type === 'checking' || a.type === 'savings')
      .reduce((s, a) => s + a.balance, 0);
    const totalAllocated = envelopes.reduce((s, e) => s + e.allocated, 0);
    const availableToBudget = liquidBalance - totalAllocated;

    return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Envelopes</h2>

      {/* Available to Budget */}
      <div className={`mb-6 rounded-xl border-2 p-5 flex items-center justify-between ${availableToBudget >= 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
        <div>
          <p className="text-sm font-medium text-gray-600">Available to Budget</p>
          <p className={`text-3xl font-bold mt-0.5 ${availableToBudget >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            ${Math.abs(availableToBudget).toFixed(2)}{availableToBudget < 0 ? ' over' : ''}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ${liquidBalance.toFixed(2)} in checking &amp; savings &minus; ${totalAllocated.toFixed(2)} allocated to envelopes
          </p>
        </div>
        <div className="text-4xl">{availableToBudget >= 0 ? '💰' : '⚠️'}</div>
      </div>

      {overspentEnvs.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-300 rounded-lg p-4 flex items-start gap-3">
          <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">Budget exceeded</p>
            <p className="text-sm text-red-700 mt-0.5">
              {overspentEnvs.map(e => e.name).join(', ')} {overspentEnvs.length === 1 ? 'is' : 'are'} over budget. Consider adjusting allocations or reviewing recent spending.
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {envelopes.map(env => {
          const incomeAlloc = transactions.filter(t => t.envelopeId === env.id && t.amount > 0).reduce((s, t) => s + t.amount, 0);
          const totalAlloc = env.allocated + incomeAlloc;
          const remaining = totalAlloc - env.spent;
          const pct = totalAlloc > 0 ? Math.min(100, Math.round((env.spent / totalAlloc) * 100)) : 0;
          const isOver = totalAlloc > 0 && env.spent > totalAlloc;
          return (
            <div key={env.id} className={`bg-white shadow rounded-lg overflow-hidden ${isOver ? 'ring-2 ring-red-400' : ''}`}>
              <div className="h-1" style={{ backgroundColor: env.color }} />
              <div className="p-5">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: env.color }} />
                    <h3 className="text-lg font-medium text-gray-900">{env.name}</h3>
                    {env.rollover && <span className="text-xs text-blue-500 font-medium" title="Unspent rolls over">↻</span>}
                  </div>
                  <button onClick={() => setEditingEnvelope(env)} className="text-sm text-indigo-600 hover:text-indigo-900">Edit</button>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                  <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : ''}`}
                    style={{ width: `${pct}%`, backgroundColor: pct < 80 ? env.color : undefined }} />
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between"><span>Allocated</span><span>${totalAlloc.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Spent</span><span>${env.spent.toFixed(2)}</span></div>
                  <div className={`flex justify-between font-semibold ${remaining < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    <span>Remaining</span><span>${remaining.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        <button onClick={() => setShowCreateEnvelope(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium">
          Create Envelope
        </button>
      </div>
    </div>
  );};

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b" style={{ borderBottomColor: 'var(--color-cloud-blue)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <img src="/images/capsule-logo.svg" alt="Capsule" className="w-9 h-9" />
              <div className="hidden sm:block">
                <p className="text-base font-bold leading-tight" style={{ color: 'var(--color-dark-navy)' }}>Capsule</p>
                <p className="text-xs" style={{ color: 'var(--color-primary-blue)' }}>by NeCloud</p>
              </div>
            </div>

            {/* Nav links — scrollable on mobile */}
            {user && (
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-5 min-w-max h-16 items-end pb-1">
                  {navBtn('dashboard', 'Dashboard')}
                  {navBtn('accounts', 'Accounts')}
                  {navBtn('transactions', 'Transactions')}
                  {navBtn('envelopes', 'Envelopes')}
                  {navBtn('goals', 'Goals')}
                  {navBtn('rules', 'Rules')}
                  {navBtn('settings', 'Settings')}
                </div>
              </div>
            )}

            {/* Right actions */}
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              {/* Save indicator */}
              {saveStatus === 'saving' && (
                <span className="text-xs text-gray-400 hidden sm:inline">Saving…</span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-xs text-green-600 hidden sm:inline">Saved ✓</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-xs text-red-500 hidden sm:inline">Save failed</span>
              )}

              {user && setupCompleted && (
                <button onClick={() => setShowGetPaidModal(true)}
                  className="text-white px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--color-finance-green)' }}>
                  💰 Get Paid
                </button>
              )}
              {user ? (
                <button onClick={handleSignOut}
                  className="text-white px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity bg-red-600">
                  Sign Out
                </button>
              ) : (
                <button onClick={() => setShowAuthModal(true)}
                  className="text-white px-3 py-1.5 rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary-blue)' }}>
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pb-20 sm:pb-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : !user ? (
          renderLanding()
        ) : (
          <>
            {currentView === 'dashboard' && (
              <div className="px-4 py-6 sm:px-0">
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
                  <button onClick={() => setShowDashboardSettings(v => !v)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm">
                    ⚙️ Customize
                  </button>
                </div>

                {showDashboardSettings && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-8">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Arrange sections — drag to reorder</h3>
                    <div className="space-y-2">
                      {dashboardSections.map((sec, i) => (
                        <div key={sec.id} draggable
                          onDragStart={() => setDraggedIndex(i)}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            if (draggedIndex !== null && draggedIndex !== i) {
                              const s = [...dashboardSections];
                              const [r] = s.splice(draggedIndex, 1);
                              s.splice(i, 0, r);
                              setDashboardSections(s);
                              setDraggedIndex(null);
                            }
                          }}
                          className={`flex items-center gap-3 p-3 bg-white border-2 rounded-lg cursor-move ${draggedIndex === i ? 'opacity-50 border-blue-400' : 'border-gray-200'}`}>
                          <span className="text-gray-400">⋮⋮</span>
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input type="checkbox" checked={sec.visible}
                              onChange={e => {
                                const s = [...dashboardSections];
                                s[i] = { ...s[i], visible: e.target.checked };
                                setDashboardSections(s);
                              }}
                              onClick={e => e.stopPropagation()}
                              className="w-4 h-4 text-blue-600 rounded" />
                            <span className="text-sm text-gray-700">{sec.label}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {renderDashboard()}
              </div>
            )}

            {currentView === 'accounts' && (
              <div className="px-4 py-6 sm:px-0">
                <AccountManagement
                  accounts={accounts}
                  onAccountAdd={handleAccountAdd}
                  onAccountUpdate={handleAccountUpdate}
                  onAccountDelete={id => {
                    setTransactions(prev => {
                      const next = prev.filter(t => t.accountId !== id);
                      setEnvelopes(e => calculateEnvelopeSpending(e, next));
                      return next;
                    });
                    setAccounts(prev => prev.filter(a => a.id !== id));
                  }}
                />
                {sharedAccounts.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-lg font-semibold text-gray-700 mb-3">Shared with me</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sharedAccounts.map(sa => (
                        <div key={sa.shareId} className="bg-white shadow rounded-lg p-5 border border-blue-100">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900">{sa.account?.name}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded capitalize">{sa.role}</span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">Shared by {sa.ownerEmail}</p>
                          <p className="text-xl font-bold text-blue-700">${(sa.account?.balance ?? 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-1 capitalize">{sa.account?.type?.replace('_', ' ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentView === 'transactions' && renderTransactions()}

            {currentView === 'envelopes' && renderEnvelopes()}

            {currentView === 'goals' && (
              <div className="px-4 py-6 sm:px-0">
                <GoalsManager
                  goals={goals}
                  accounts={accounts}
                  onGoalsChange={setGoals}
                />
              </div>
            )}

            {currentView === 'rules' && (
              <div className="px-4 py-6 sm:px-0">
                <TransactionRulesManager
                  rules={transactionRules}
                  envelopes={envelopes}
                  onRulesChange={setTransactionRules}
                  transactions={transactions}
                  onApplyToExisting={updated => {
                    setTransactions(updated as any);
                    setEnvelopes(calculateEnvelopeSpending(envelopes, updated as any));
                  }}
                />
              </div>
            )}

            {currentView === 'settings' && user && (
              <Settings
                user={user}
                onAccountDeleted={() => { setCurrentView('dashboard'); setUser(null); }}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} onAuthSuccess={() => setShowAuthModal(false)} />
      )}
      {showSetupWizard && (
        <SetupWizard onComplete={handleSetupComplete} onSkip={() => setShowSetupWizard(false)} userId={user?.userId || ''} />
      )}
      {showGetPaidModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl">
            <GetPaid
              accounts={accounts} envelopes={envelopes}
              onIncomeAdded={txns => { handleTransactionsAdded(txns); setShowGetPaidModal(false); }}
              onAccountUpdate={handleAccountUpdate}
              autoOpen={true}
            />
          </div>
        </div>
      )}
      {editingTransaction && (
        <TransactionEdit
          transaction={editingTransaction}
          envelopes={envelopes.map(e => ({ id: e.id, name: e.name }))}
          accounts={accounts.map(a => ({ id: a.id, name: a.name }))}
          onSave={t => { handleTransactionEdit(t); setEditingTransaction(null); }}
          onCancel={() => setEditingTransaction(null)}
        />
      )}
      {showCreateEnvelope && (
        <EnvelopeCreate
          onEnvelopeCreated={env => { setEnvelopes(prev => [...prev, env]); setShowCreateEnvelope(false); }}
          onCancel={() => setShowCreateEnvelope(false)}
          accounts={accounts.map(a => ({ id: a.id, name: a.name }))}
        />
      )}
      {/* Mobile bottom nav */}
      {user && setupCompleted && (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex">
          {([
            { view: 'dashboard', icon: '🏠', label: 'Home' },
            { view: 'accounts', icon: '🏦', label: 'Accounts' },
            { view: 'transactions', icon: '↕', label: 'Txns' },
            { view: 'envelopes', icon: '📦', label: 'Envelopes' },
            { view: 'settings', icon: '⚙️', label: 'More' },
          ] as { view: ViewMode; icon: string; label: string }[]).map(({ view, icon, label }) => (
            <button key={view} onClick={() => setCurrentView(view)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${currentView === view ? 'text-blue-600' : 'text-gray-500'}`}>
              <span className="text-lg leading-none">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {editingEnvelope && (
        <EnvelopeEdit
          envelope={editingEnvelope}
          onEnvelopeUpdated={env => { setEnvelopes(prev => prev.map(e => e.id === env.id ? env : e)); setEditingEnvelope(null); }}
          onEnvelopeDeleted={id => {
            setEnvelopes(prev => prev.filter(e => e.id !== id));
            setTransactions(prev => prev.map(t => t.envelopeId === id ? { ...t, envelopeId: undefined } : t));
            setEditingEnvelope(null);
          }}
          onCancel={() => setEditingEnvelope(null)}
          accounts={accounts.map(a => ({ id: a.id, name: a.name }))}
        />
      )}
    </div>
  );
}
