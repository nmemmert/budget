'use client';

import { useState, useEffect } from 'react';
import { DataService } from '../lib/dataService';

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
  incomeAllocation?: number;
  incomeAllocationType?: 'percentage' | 'fixed';
}

interface SetupWizardProps {
  onComplete: (accounts: Account[], envelopes: Envelope[]) => void;
  onSkip: () => void;
  userId: string;
}

type WizardStep = 'welcome' | 'data-source' | 'csv-import' | 'accounts' | 'envelopes' | 'income-setup' | 'get-paid-setup' | 'complete';

interface CsvRow { [key: string]: string }
interface CsvMapping {
  date: string;
  description: string;
  amount: string;
  amountIn?: string;
  amountOut?: string;
  splitAmounts: boolean;
  accountName: string;
  accountType: 'checking' | 'savings' | 'credit_card';
  skipRows: number;
  negateAmount: boolean;
}

export default function SetupWizard({ onComplete, onSkip, userId }: SetupWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);

  // Account creation state
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState<Partial<Account>>({
    type: 'checking',
    balance: 0,
    color: 'bg-blue-500',
    isActive: true,
  });

  // Envelope creation state
  const [showAddEnvelope, setShowAddEnvelope] = useState(false);
  const [newEnvelope, setNewEnvelope] = useState<Partial<Envelope>>({
    allocated: 0,
    spent: 0,
    color: 'bg-green-500',
  });

  // Standard envelopes option
  const [includeStandardEnvelopes, setIncludeStandardEnvelopes] = useState(false);
  const [standardEnvelopeAccountId, setStandardEnvelopeAccountId] = useState<string>('');

  // Income allocation state
  const [incomeAllocations, setIncomeAllocations] = useState<{ [envelopeId: string]: { type: 'percentage' | 'fixed'; value: number } }>({});
  const [defaultPaycheckAmounts, setDefaultPaycheckAmounts] = useState<{ [accountId: string]: number }>({});

  // Loading and error states
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // CSV import state
  const [csvRawRows, setCsvRawRows] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvMapping, setCsvMapping] = useState<CsvMapping>({
    date: '', description: '', amount: '', amountIn: '', amountOut: '',
    splitAmounts: false, accountName: 'Imported Account',
    accountType: 'checking', skipRows: 0, negateAmount: false,
  });
  const [csvFileName, setCsvFileName] = useState('');
  const [pendingImportedTransactions, setPendingImportedTransactions] = useState<any[]>([]);

  // Modal ESC key handling and click outside
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showAddAccount || showAddEnvelope) {
          setShowAddAccount(false);
          setShowAddEnvelope(false);
        } else {
          onSkip(); // Close the entire wizard
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showAddAccount, showAddEnvelope, onSkip]);

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onSkip();
    }
  };

  const accountTypes = [
    { value: 'checking', label: 'Checking Account', icon: '🏦' },
    { value: 'savings', label: 'Savings Account', icon: '💰' },
    { value: 'credit_card', label: 'Credit Card', icon: '💳' },
    { value: 'mortgage', label: 'Mortgage', icon: '🏠' },
    { value: 'investment', label: 'Investment', icon: '📈' },
    { value: 'loan', label: 'Loan', icon: '📋' },
  ];

  const liabilityTypes: Account['type'][] = ['credit_card', 'mortgage', 'loan'];
  const normalizeBalanceByType = (type: Account['type'], balance: number): number => {
    if (liabilityTypes.includes(type)) {
      return -Math.abs(balance || 0);
    }
    return balance || 0;
  };

  const envelopeColors = [
    'bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
    'bg-red-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500'
  ];

  const generateDemoData = () => {
    const demoAccounts: Account[] = [
      {
        id: 'checking-demo',
        name: 'Main Checking',
        type: 'checking',
        balance: 5000,
        color: 'bg-blue-500',
        isActive: true,
        institution: 'Demo Bank',
      },
      {
        id: 'savings-demo',
        name: 'Emergency Fund',
        type: 'savings',
        balance: 10000,
        color: 'bg-green-500',
        isActive: true,
        institution: 'Demo Bank',
      },
    ];

    const demoEnvelopes: Envelope[] = [
      {
        id: 'env-groceries',
        name: 'Groceries',
        allocated: 500,
        spent: 0,
        color: 'bg-orange-500',
        accountId: 'checking-demo',
      },
      {
        id: 'env-dining',
        name: 'Dining & Entertainment',
        allocated: 300,
        spent: 0,
        color: 'bg-pink-500',
        accountId: 'checking-demo',
      },
      {
        id: 'env-utilities',
        name: 'Utilities',
        allocated: 200,
        spent: 0,
        color: 'bg-red-500',
        accountId: 'checking-demo',
      },
      {
        id: 'env-transportation',
        name: 'Transportation',
        allocated: 400,
        spent: 0,
        color: 'bg-purple-500',
        accountId: 'checking-demo',
      },
      {
        id: 'env-personal',
        name: 'Personal Care',
        allocated: 150,
        spent: 0,
        color: 'bg-indigo-500',
        accountId: 'checking-demo',
      },
    ];

    return { demoAccounts, demoEnvelopes };
  };

  const handleSkipWithDemo = async () => {
    if (!userId) {
      setErrorMessage('No user ID provided');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { demoAccounts, demoEnvelopes } = generateDemoData();
      DataService.setUserId(userId);
      await DataService.saveUserData({
        accounts: demoAccounts,
        envelopes: demoEnvelopes,
        transactions: [],
        setupCompleted: true,
      });
      onComplete(demoAccounts, demoEnvelopes);
    } catch (error) {
      console.error('Error creating demo data:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create demo data');
      setIsSaving(false);
    }
  };

  const handleAddAccount = () => {
    if (!newAccount.name || !newAccount.type) return;

    // Validation: unique name
    if (accounts.some(acc => acc.name.toLowerCase() === newAccount.name!.toLowerCase())) {
      alert('Account name must be unique');
      return;
    }

    // Validation: balance >= 0
    const balance = newAccount.balance || 0;
    if (balance < 0) {
      alert('Balance cannot be negative');
      return;
    }

    const normalizedBalance = normalizeBalanceByType(newAccount.type as Account['type'], newAccount.balance || 0);

    const account: Account = {
      id: `${newAccount.type}-${Date.now()}`,
      name: newAccount.name,
      type: newAccount.type as Account['type'],
      balance: normalizedBalance,
      institution: newAccount.institution,
      accountNumber: newAccount.accountNumber,
      color: newAccount.color || 'bg-blue-500',
      isActive: true,
    };
    setAccounts(prev => [...prev, account]);
    setNewAccount({
      type: 'checking',
      balance: 0,
      color: 'bg-blue-500',
      isActive: true,
    });
    setShowAddAccount(false);
  };

  const handleAddEnvelope = () => {
    const allocation = newEnvelope.allocated ?? 0;

    if (!newEnvelope.name || !newEnvelope.accountId || allocation <= 0) {
      alert('Please enter a budget amount greater than $0');
      return;
    }

    // Validation: unique name
    if (envelopes.some(env => env.name.toLowerCase() === newEnvelope.name!.toLowerCase())) {
      alert('Envelope name must be unique');
      return;
    }

    const envelope: Envelope = {
      id: `env-${Date.now()}`,
      name: newEnvelope.name,
      allocated: allocation,
      spent: 0,
      color: newEnvelope.color || 'bg-green-500',
      accountId: newEnvelope.accountId,
    };
    setEnvelopes(prev => [...prev, envelope]);
    setNewEnvelope({
      allocated: 0,
      spent: 0,
      color: 'bg-green-500',
    });
    setShowAddEnvelope(false);
  };

  const handleComplete = async () => {
    if (!userId) {
      setErrorMessage('No user ID provided');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      DataService.setUserId(userId);
      // Apply income allocation settings to envelopes
      const envelopesWithAllocations = envelopes.map(envelope => {
        const allocation = incomeAllocations[envelope.id];
        if (allocation) {
          return {
            ...envelope,
            incomeAllocation: allocation.value,
            incomeAllocationType: allocation.type,
          };
        }
        return envelope;
      });

      // Apply default paycheck amounts to accounts
      const accountsWithDefaults = accounts.map(account => {
        const defaultAmount = defaultPaycheckAmounts[account.id];
        if (defaultAmount) {
          return {
            ...account,
            defaultPaycheckAmount: defaultAmount,
          };
        }
        return account;
      });

      await DataService.saveUserData({
        accounts: accountsWithDefaults,
        envelopes: envelopesWithAllocations,
        transactions: pendingImportedTransactions,
        setupCompleted: true,
      });
      
      try {
        onComplete(accountsWithDefaults, envelopesWithAllocations);
      } catch (callbackError) {
        console.error('Error in setup completion callback:', callbackError);
        setErrorMessage('Setup completed but failed to update display. Please refresh.');
      }
    } catch (error) {
      console.error('Error saving setup data:', error);
      setErrorMessage('Failed to save setup data. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderWelcome = () => (
    <div className="text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4">💰</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Capsule</h1>
        <p className="text-gray-600 mb-4">Let&apos;s set up your budget to get started with secure, organized financial tracking.</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => setCurrentStep('data-source')}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Get Started
        </button>
        <button
          onClick={handleSkipWithDemo}
          disabled={isSaving}
          className="w-full text-gray-600 hover:text-gray-800 py-2 disabled:opacity-50"
        >
          {isSaving ? 'Creating demo data...' : 'Skip Setup (Use Demo Data)'}
        </button>
      </div>
    </div>
  );

  const renderDataSource = () => (
    <div className="text-center">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">How would you like to set up your data?</h2>
        <p className="text-gray-600">Choose how you&apos;d like to get started with your budget.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={() => {
            setCurrentStep('csv-import');
          }}
          className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
        >
          <div className="text-4xl mb-3">📊</div>
          <h3 className="font-semibold text-gray-900 mb-2">Import Data</h3>
          <p className="text-sm text-gray-600">Upload CSV files from your bank or credit card statements</p>
        </button>

        <button
          onClick={() => {
            setCurrentStep('accounts');
          }}
          className="p-6 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
        >
          <div className="text-4xl mb-3">✏️</div>
          <h3 className="font-semibold text-gray-900 mb-2">Manual Setup</h3>
          <p className="text-sm text-gray-600">Add your accounts and envelopes manually</p>
        </button>
      </div>

      <button
        onClick={() => setCurrentStep('welcome')}
        className="text-blue-600 hover:text-blue-800"
      >
        ← Back
      </button>
    </div>
  );

  const handleCsvFile = (file: File) => {
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) return;

      // Parse CSV respecting quoted fields
      const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuote = !inQuote; }
          else if (ch === ',' && !inQuote) { result.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseRow(lines[0]);
      const rows: CsvRow[] = lines.slice(1).map(line => {
        const vals = parseRow(line);
        const row: CsvRow = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
        return row;
      });

      setCsvHeaders(headers);
      setCsvRawRows(rows);

      // Auto-detect common column names
      const find = (...candidates: string[]) =>
        headers.find(h => candidates.some(c => h.toLowerCase().includes(c))) ?? '';
      const dateCol = find('date', 'posted', 'transaction date', 'trans date');
      const descCol = find('description', 'desc', 'memo', 'payee', 'name', 'details');
      const amtCol = find('amount', 'amt', 'debit/credit', 'transaction amount');
      const inCol = find('credit', 'deposit', 'money in', 'additions');
      const outCol = find('debit', 'withdrawal', 'money out', 'subtractions');
      const hasSplit = !amtCol && (inCol || outCol);

      setCsvMapping(m => ({
        ...m,
        date: dateCol, description: descCol,
        amount: amtCol, amountIn: inCol, amountOut: outCol,
        splitAmounts: hasSplit,
        accountName: file.name.replace(/\.csv$/i, '').replace(/[_-]/g, ' '),
      }));
    };
    reader.readAsText(file);
  };

  const importCsvTransactions = () => {
    const { date, description, amount, amountIn, amountOut, splitAmounts,
      accountName, accountType, negateAmount } = csvMapping;
    if (!date || !description || (!splitAmounts && !amount) || (splitAmounts && !amountIn && !amountOut)) {
      alert('Please map the required columns (Date, Description, and Amount).');
      return;
    }

    const parseAmt = (s: string): number => {
      if (!s) return 0;
      const n = parseFloat(s.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1'));
      return isNaN(n) ? 0 : n;
    };

    const accountId = `csv-${Date.now()}`;
    const newAcc: Account = {
      id: accountId, name: accountName, type: accountType,
      balance: 0, color: 'bg-blue-500', isActive: true,
    };

    let balance = 0;
    const newTransactions: { id: string; accountId: string; amount: number; description: string; date: string; envelopeId?: string }[] = [];

    csvRawRows.forEach((row, i) => {
      let amt: number;
      if (splitAmounts) {
        const inAmt = amountIn ? parseAmt(row[amountIn]) : 0;
        const outAmt = amountOut ? parseAmt(row[amountOut]) : 0;
        amt = inAmt - Math.abs(outAmt);
      } else {
        amt = parseAmt(row[amount]);
        if (negateAmount) amt = -amt;
      }
      if (amt === 0) return;

      const rawDate = row[date] || '';
      let parsedDate = rawDate;
      try { parsedDate = new Date(rawDate).toISOString().split('T')[0]; } catch {}

      balance += amt;
      newTransactions.push({
        id: `csv-tx-${Date.now()}-${i}`,
        accountId,
        amount: amt,
        description: row[description] || 'Imported transaction',
        date: parsedDate,
      });
    });

    newAcc.balance = balance;
    setAccounts(prev => [...prev, newAcc]);
    setPendingImportedTransactions(newTransactions);
    setCurrentStep('envelopes');
  };

  const renderCsvImport = () => {
    const previewRows = csvRawRows.slice(0, 5);
    const colOpts = ['', ...csvHeaders];

    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Bank CSV</h2>
          <p className="text-gray-600">Upload a CSV export from your bank or credit card.</p>
        </div>

        {/* File upload */}
        {!csvHeaders.length ? (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50 transition-colors">
            <div className="text-4xl mb-2">📁</div>
            <p className="text-sm text-gray-600 font-medium">Click to upload CSV file</p>
            <p className="text-xs text-gray-400 mt-1">Most banks let you export transaction history as CSV</p>
            <input type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
          </label>
        ) : (
          <div className="space-y-5">
            {/* File info */}
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-sm font-medium text-green-800">✓ {csvFileName} — {csvRawRows.length} rows detected</span>
              <button onClick={() => { setCsvHeaders([]); setCsvRawRows([]); setCsvFileName(''); }}
                className="text-xs text-red-600 hover:text-red-800">Remove</button>
            </div>

            {/* Account setup */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
                <input type="text" value={csvMapping.accountName}
                  onChange={e => setCsvMapping(m => ({ ...m, accountName: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Account Type</label>
                <select value={csvMapping.accountType}
                  onChange={e => setCsvMapping(m => ({ ...m, accountType: e.target.value as CsvMapping['accountType'] }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
            </div>

            {/* Column mapping */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Column Mapping</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date column <span className="text-red-500">*</span></label>
                  <select value={csvMapping.date}
                    onChange={e => setCsvMapping(m => ({ ...m, date: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description column <span className="text-red-500">*</span></label>
                  <select value={csvMapping.description}
                    onChange={e => setCsvMapping(m => ({ ...m, description: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                  </select>
                </div>
              </div>

              {/* Amount type toggle */}
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs font-medium text-gray-700">Amount format:</label>
                <button onClick={() => setCsvMapping(m => ({ ...m, splitAmounts: false }))}
                  className={`px-3 py-1 text-xs rounded-full border ${!csvMapping.splitAmounts ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  Single column
                </button>
                <button onClick={() => setCsvMapping(m => ({ ...m, splitAmounts: true }))}
                  className={`px-3 py-1 text-xs rounded-full border ${csvMapping.splitAmounts ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
                  Separate debit/credit
                </button>
              </div>

              {!csvMapping.splitAmounts ? (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Amount column <span className="text-red-500">*</span></label>
                    <select value={csvMapping.amount}
                      onChange={e => setCsvMapping(m => ({ ...m, amount: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={csvMapping.negateAmount}
                        onChange={e => setCsvMapping(m => ({ ...m, negateAmount: e.target.checked }))}
                        className="rounded" />
                      Negate amounts (flip +/−)
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Credit / Money In</label>
                    <select value={csvMapping.amountIn}
                      onChange={e => setCsvMapping(m => ({ ...m, amountIn: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Debit / Money Out</label>
                    <select value={csvMapping.amountOut}
                      onChange={e => setCsvMapping(m => ({ ...m, amountOut: e.target.value }))}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {colOpts.map(c => <option key={c} value={c}>{c || '-- select --'}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Preview table */}
            {previewRows.length > 0 && csvMapping.date && csvMapping.description && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Preview (first 5 rows)</h3>
                <div className="overflow-x-auto rounded border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-gray-600 font-medium">Date</th>
                        <th className="px-2 py-1.5 text-left text-gray-600 font-medium">Description</th>
                        <th className="px-2 py-1.5 text-right text-gray-600 font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => {
                        const parseAmt = (s: string) => parseFloat(s?.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1')) || 0;
                        let amt = csvMapping.splitAmounts
                          ? parseAmt(csvMapping.amountIn ? row[csvMapping.amountIn] : '') - Math.abs(parseAmt(csvMapping.amountOut ? row[csvMapping.amountOut] : ''))
                          : csvMapping.negateAmount ? -parseAmt(row[csvMapping.amount]) : parseAmt(row[csvMapping.amount]);
                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-2 py-1.5 text-gray-700">{row[csvMapping.date]}</td>
                            <td className="px-2 py-1.5 text-gray-700 max-w-[200px] truncate">{row[csvMapping.description]}</td>
                            <td className={`px-2 py-1.5 text-right font-medium ${amt >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {amt >= 0 ? '+' : ''}${Math.abs(amt).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-1">{csvRawRows.length} total transactions will be imported</p>
              </div>
            )}

            <button onClick={importCsvTransactions}
              className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg hover:bg-blue-700 font-medium text-sm">
              Import {csvRawRows.length} Transactions →
            </button>
          </div>
        )}

        <div className="mt-4">
          <button onClick={() => setCurrentStep('data-source')} className="text-blue-600 hover:text-blue-800 text-sm">← Back</button>
        </div>
      </div>
    );
  };

  const renderAccounts = () => (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Accounts</h2>
        <p className="text-gray-600">Add your bank accounts, credit cards, and other financial accounts.</p>
      </div>

      {/* Existing Accounts */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900  mb-3">Your Accounts</h3>
        {(accounts || []).length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No accounts added yet</p>
        ) : (
          <div className="space-y-3">
            {(accounts || []).map((account) => (
              <div key={account.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-4 h-4 rounded-full ${account.color}`}></div>
                  <div>
                    <p className="font-medium text-gray-900 ">{account.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{account.type.replace('_', ' ').toUpperCase()}</p>
                  </div>
                </div>
                <p className="font-semibold text-gray-900 ">${account.balance.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Account Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddAccount(true)}
          className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Account</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('data-source')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
        <button
          onClick={() => setCurrentStep('envelopes')}
          disabled={(accounts || []).length === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Create Envelopes →
        </button>
      </div>

      {/* Add Account Modal */}
      {showAddAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Account</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={newAccount.name || ''}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="e.g., Main Checking"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={newAccount.type || 'checking'}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, type: e.target.value as Account['type'] }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  {accountTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAccount.balance || ''}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institution (Optional)</label>
                <input
                  type="text"
                  value={newAccount.institution || ''}
                  onChange={(e) => setNewAccount(prev => ({ ...prev, institution: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="e.g., Bank of America"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700  mb-1">Color</label>
                <div className="flex space-x-2">
                  {envelopeColors.slice(0, 6).map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewAccount(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full ${color} ${newAccount.color === color ? 'ring-2 ring-gray-400' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddAccount(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={!newAccount.name}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderEnvelopes = () => (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Envelopes</h2>
        <p className="text-gray-600">Set up budget categories for different spending areas.</p>
      </div>

      {/* Existing Envelopes */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900  mb-3">Your Envelopes</h3>
        {envelopes.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">No envelopes created yet</p>
        ) : (
          <div className="space-y-3">
            {envelopes.map((envelope) => {
              const account = accounts.find(acc => acc.id === envelope.accountId);
              return (
                <div key={envelope.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${envelope.color}`}></div>
                    <div>
                      <p className="font-medium text-gray-900 ">{envelope.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{account?.name}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900 ">${envelope.allocated.toFixed(2)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Envelope Button */}
      {/* Standard envelopes option */}
      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={includeStandardEnvelopes}
            onChange={(e) => setIncludeStandardEnvelopes(e.target.checked)}
          />
          <span className="font-medium text-gray-900 ">Add standard envelopes</span>
        </label>

        <div className="mt-3">
          <label className="block text-sm text-gray-600 mb-1">Assign standard envelopes to account</label>
          <select
            value={standardEnvelopeAccountId}
            onChange={(e) => setStandardEnvelopeAccountId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            disabled={!includeStandardEnvelopes}
          >
            <option value="">Select an account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </select>
          <p className="text-sm text-gray-500 mt-2">We&apos;ll create a set of common envelopes (Rent, Groceries, Utilities, Savings, Transport, Entertainment, Emergency). You can edit amounts later.</p>
        </div>
      </div>

      <div className="mb-6">
        <button
          onClick={() => setShowAddEnvelope(true)}
          className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Add Envelope</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('accounts')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
        <button
          onClick={() => {
            // If standard envelopes are requested, create them and then proceed
            if (includeStandardEnvelopes) {
              const targetAccountId = standardEnvelopeAccountId || (accounts[0] && accounts[0].id) || '';
              if (!targetAccountId) {
                alert('Please select an account to assign standard envelopes to.');
                return;
              }

              const standardDefaults: Record<string, number> = {
                Rent: 1200,
                Groceries: 500,
                Utilities: 250,
                Savings: 300,
                Transport: 200,
                Entertainment: 150,
                Emergency: 200,
              };

              const standardNames = ['Rent', 'Groceries', 'Utilities', 'Savings', 'Transport', 'Entertainment', 'Emergency'];
              const newStandardEnvelopes: Envelope[] = standardNames.map((name, idx) => ({
                id: `env-standard-${Date.now()}-${idx}`,
                name,
                allocated: standardDefaults[name] ?? 100,
                spent: 0,
                color: envelopeColors[idx % envelopeColors.length],
                accountId: targetAccountId,
              }));
              // Avoid duplicating standard envelopes if they already exist by name on the same account
              setEnvelopes(prev => {
                const existingNames = new Set(prev.filter(e => e.accountId === targetAccountId).map(e => e.name));
                const toAdd = newStandardEnvelopes.filter(e => !existingNames.has(e.name));
                return [...prev, ...toAdd];
              });
            }
            setCurrentStep('income-setup');
          }}
          disabled={includeStandardEnvelopes && !standardEnvelopeAccountId}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Set Up Income →
        </button>
      </div>

      {/* Add Envelope Modal */}
      {showAddEnvelope && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Envelope</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Envelope Name</label>
                <input
                  type="text"
                  value={newEnvelope.name || ''}
                  onChange={(e) => setNewEnvelope(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="e.g., Groceries"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                <select
                  value={newEnvelope.accountId || ''}
                  onChange={(e) => setNewEnvelope(prev => ({ ...prev, accountId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.type.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Budget</label>
                <input
                  type="number"
                  step="0.01"
                  value={newEnvelope.allocated || ''}
                  onChange={(e) => setNewEnvelope(prev => ({ ...prev, allocated: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700  mb-1">Color</label>
                <div className="flex space-x-2">
                  {envelopeColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewEnvelope(prev => ({ ...prev, color }))}
                      className={`w-8 h-8 rounded-full ${color} ${newEnvelope.color === color ? 'ring-2 ring-gray-400' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddEnvelope(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
                <button
                  onClick={handleAddEnvelope}
                  disabled={!newEnvelope.name || !newEnvelope.accountId || !newEnvelope.allocated || newEnvelope.allocated <= 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Envelope
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderIncomeSetup = () => (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Income Allocation Setup</h2>
        <p className="text-gray-600">Set up how your income is automatically allocated to envelopes.</p>
      </div>

      {/* Income Allocation Settings */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900  mb-3">Envelope Income Allocations</h3>
        <p className="text-sm text-gray-600  mb-4">
          Configure how much of your income goes to each envelope automatically when you get paid.
          You can set percentages or fixed amounts.
        </p>

        <div className="space-y-4">
          {envelopes.map((envelope) => {
            const account = accounts.find(acc => acc.id === envelope.accountId);
            const allocation = incomeAllocations[envelope.id];

            return (
              <div key={envelope.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${envelope.color}`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{envelope.name}</p>
                      <p className="text-sm text-gray-500">{account?.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">${envelope.allocated.toFixed(2)} allocated</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700  mb-1">Allocation Type</label>
                    <select
                      value={allocation?.type || 'percentage'}
                      onChange={(e) => setIncomeAllocations(prev => ({
                        ...prev,
                        [envelope.id]: {
                          type: e.target.value as 'percentage' | 'fixed',
                          value: allocation?.value || 0
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700  mb-1">
                      {allocation?.type === 'fixed' ? 'Amount ($)' : 'Percentage (%)'}
                    </label>
                    <input
                      type="number"
                      step={allocation?.type === 'fixed' ? '0.01' : '1'}
                      min="0"
                      max={allocation?.type === 'percentage' ? '100' : undefined}
                      value={allocation?.value || ''}
                      onChange={(e) => setIncomeAllocations(prev => ({
                        ...prev,
                        [envelope.id]: {
                          type: allocation?.type || 'percentage',
                          value: parseFloat(e.target.value) || 0
                        }
                      }))}
                      placeholder={allocation?.type === 'fixed' ? '0.00' : '0'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => setIncomeAllocations(prev => {
                        const newAllocations = { ...prev };
                        delete newAllocations[envelope.id];
                        return newAllocations;
                      })}
                      className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total Percentage Warning */}
        {(() => {
          const totalPercentage = envelopes.reduce((sum, envelope) => {
            const allocation = incomeAllocations[envelope.id];
            if (allocation?.type === 'percentage') {
              return sum + (allocation.value || 0);
            }
            return sum;
          }, 0);
          if (totalPercentage > 100) {
            return (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">
                  Warning: Total percentage allocation ({totalPercentage.toFixed(1)}%) exceeds 100%. Please adjust your allocations.
                </p>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('envelopes')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
        <button
          onClick={() => setCurrentStep('get-paid-setup')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Next: Get Paid Setup →
        </button>
      </div>
    </div>
  );

  const renderGetPaidSetup = () => (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Get Paid Setup</h2>
        <p className="text-gray-600">Set up your default paycheck amounts for quick income entry.</p>
      </div>

      {/* Default Paycheck Amounts */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900  mb-3">Default Paycheck Amounts</h3>
        <p className="text-sm text-gray-600  mb-4">
          Set default amounts for each account to speed up paycheck entry. You can always change these later.
        </p>

        <div className="space-y-4">
          {accounts.filter(acc => acc.type !== 'credit_card' && acc.type !== 'mortgage' && acc.type !== 'loan').map((account) => {
            const defaultAmount = defaultPaycheckAmounts[account.id];

            return (
              <div key={account.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full ${account.color}`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-sm text-gray-500">{account.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700  mb-1">Default Paycheck Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={defaultAmount || ''}
                        onChange={(e) => setDefaultPaycheckAmounts(prev => ({
                          ...prev,
                          [account.id]: parseFloat(e.target.value) || 0
                        }))}
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => setDefaultPaycheckAmounts(prev => {
                        const newDefaults = { ...prev };
                        delete newDefaults[account.id];
                        return newDefaults;
                      })}
                      className="px-3 py-2 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep('income-setup')}
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back
        </button>
        <button
          onClick={() => setCurrentStep('complete')}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
        >
          Complete Setup →
        </button>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="text-center">
      <div className="mb-8">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h2>
        <p className="text-gray-600">Your Capsule budget is ready to use.</p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">Your Setup Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-left">
          <div>
            <p className="text-sm text-gray-500">Accounts</p>
            <p className="font-semibold text-gray-900">{(accounts || []).length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Envelopes</p>
            <p className="font-semibold text-gray-900">{(envelopes || []).length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Balance</p>
            <p className="font-semibold text-gray-900">
              ${(accounts || []).reduce((sum, acc) => sum + acc.balance, 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monthly Budget</p>
            <p className="font-semibold text-gray-900">
              ${(envelopes || []).reduce((sum, env) => sum + env.allocated, 0).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}
        <button
          onClick={handleComplete}
          disabled={isSaving}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Start Budgeting!'}
        </button>
        <button
          onClick={() => setCurrentStep('envelopes')}
          className="w-full text-gray-600 hover:text-gray-800 py-2"
        >
          ← Add More Envelopes
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Close button - only on welcome step, or if closing from welcome, create demo data */}
        {currentStep === 'welcome' && (
          <button
            onClick={handleSkipWithDemo}
            disabled={isSaving}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
            aria-label="Close setup wizard"
            title="Close setup wizard and use demo data"
          >
            ✕
          </button>
        )}

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {['welcome', 'data-source', 'accounts', 'envelopes', 'income-setup', 'get-paid-setup', 'complete'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  ['welcome', 'data-source', 'accounts', 'envelopes', 'income-setup', 'get-paid-setup', 'complete'].indexOf(currentStep) >= index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < 6 && (
                  <div className={`w-12 h-1 mx-2 ${
                    ['welcome', 'data-source', 'accounts', 'envelopes', 'income-setup', 'get-paid-setup', 'complete'].indexOf(currentStep) > index
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center text-sm text-gray-600">
            {currentStep === 'welcome' && 'Welcome'}
            {currentStep === 'data-source' && 'Choose Setup Method'}
            {currentStep === 'csv-import' && 'Import Bank CSV'}
            {currentStep === 'accounts' && 'Add Your Accounts'}
            {currentStep === 'envelopes' && 'Create Budget Envelopes'}
            {currentStep === 'income-setup' && 'Configure Income Allocation'}
            {currentStep === 'get-paid-setup' && 'Set Up Get Paid'}
            {currentStep === 'complete' && 'Setup Complete'}
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 'welcome' && renderWelcome()}
        {currentStep === 'data-source' && renderDataSource()}
        {currentStep === 'csv-import' && renderCsvImport()}
        {currentStep === 'accounts' && renderAccounts()}
        {currentStep === 'envelopes' && renderEnvelopes()}
        {currentStep === 'income-setup' && renderIncomeSetup()}
        {currentStep === 'get-paid-setup' && renderGetPaidSetup()}
        {currentStep === 'complete' && renderComplete()}
      </div>
    </div>
  );
}