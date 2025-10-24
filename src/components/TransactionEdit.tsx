'use client';

import { useState } from 'react';

interface Transaction {
  id: string;
  envelopeId?: string;
  amount: number;
  description: string;
  date: Date;
  accountId: string;
}

interface TransactionEditProps {
  transaction: Transaction;
  envelopes: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
  onSave: (updatedTransaction: Transaction) => void;
  onCancel: () => void;
}

export default function TransactionEdit({ transaction, envelopes, accounts, onSave, onCancel }: TransactionEditProps) {
  const [amount, setAmount] = useState(Math.abs(transaction.amount).toString());
  const [description, setDescription] = useState(transaction.description);
  const [date, setDate] = useState(transaction.date.toISOString().split('T')[0]);
  const [selectedEnvelope, setSelectedEnvelope] = useState(transaction.envelopeId || '');
  const [selectedAccount, setSelectedAccount] = useState(transaction.accountId);
  const [isExpense, setIsExpense] = useState(transaction.amount < 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || !description.trim()) {
      alert('Please enter a valid amount and description');
      return;
    }

    const transactionAmount = isExpense ? -Math.abs(numAmount) : Math.abs(numAmount);

    onSave({
      ...transaction,
      amount: transactionAmount,
      description: description.trim(),
      date: new Date(date),
      envelopeId: selectedEnvelope || undefined,
      accountId: selectedAccount,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Transaction</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              Assign to Envelope
            </label>
            <select
              value={selectedEnvelope}
              onChange={(e) => setSelectedEnvelope(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No envelope</option>
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
            >
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

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}