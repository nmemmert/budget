'use client';

import { useState, useEffect } from 'react';

interface ManualEntryProps {
  onTransactionAdded: (transaction: {
    amount: number;
    description: string;
    date: Date;
    envelopeId?: string;
    accountId: string;
  }) => void;
  envelopes: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}

export default function ManualEntry({ onTransactionAdded, envelopes, accounts }: ManualEntryProps) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEnvelope, setSelectedEnvelope] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(accounts?.[0]?.id || '');
  const [isExpense, setIsExpense] = useState(true);

  // Update selected account when accounts change
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccount) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts, selectedAccount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || !description.trim()) {
      alert('Please enter a valid amount and description');
      return;
    }

    const transactionAmount = isExpense ? -Math.abs(numAmount) : Math.abs(numAmount);

    onTransactionAdded({
      amount: transactionAmount,
      description: description.trim(),
      date: new Date(date),
      envelopeId: selectedEnvelope || undefined,
      accountId: selectedAccount,
    });

    // Reset form
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedEnvelope('');
    setSelectedAccount(accounts?.[0]?.id || '');
  };

  if (!accounts || accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Transaction Entry</h3>
        <p className="text-gray-600">Please add an account first to enter transactions.</p>
      </div>
    );
  }

  if (!envelopes) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Transaction Entry</h3>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Transaction Entry</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter transaction description"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assign to Envelope (Optional)
          </label>
          <select
            value={selectedEnvelope}
            onChange={(e) => setSelectedEnvelope(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an envelope...</option>
            {envelopes.map((envelope) => (
              <option key={envelope.id} value={envelope.id}>
                {envelope.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assign to Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select an account...</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              checked={isExpense}
              onChange={() => setIsExpense(true)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Expense</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              checked={!isExpense}
              onChange={() => setIsExpense(false)}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Income</span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          Add Transaction
        </button>
      </form>
    </div>
  );
}