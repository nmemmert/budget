'use client';

import { useState } from 'react';

interface RecurringTransactionManagerProps {
  transactions: Array<{
    id: string;
    description: string;
    amount: number;
    isRecurring?: boolean;
    recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
    lastAppliedDate?: string;
  }>;
  onApplyRecurring: (transactions: any[]) => void;
}

export default function RecurringTransactionManager({ transactions, onApplyRecurring }: RecurringTransactionManagerProps) {
  const [expanded, setExpanded] = useState(false);

  const getNextRecurringDate = (lastDate: string | undefined, frequency: string | undefined): Date | null => {
    if (!lastDate || !frequency) return null;
    const last = new Date(lastDate);
    const now = new Date();

    switch (frequency) {
      case 'weekly':
        const nextWeek = new Date(last);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek <= now ? nextWeek : null;
      case 'monthly':
        const nextMonth = new Date(last);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth <= now ? nextMonth : null;
      case 'yearly':
        const nextYear = new Date(last);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear <= now ? nextYear : null;
      default:
        return null;
    }
  };

  const recurringTransactions = transactions.filter(t => t.isRecurring);
  const upcomingTransactions = recurringTransactions.filter(t => getNextRecurringDate(t.lastAppliedDate, t.recurringFrequency));

  if (recurringTransactions.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex justify-between items-center font-semibold text-blue-900 hover:text-blue-700"
      >
        <span>🔄 Recurring Transactions ({recurringTransactions.length})</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-blue-800">
            You have <strong>{upcomingTransactions.length}</strong> recurring transaction(s) that are due to be applied.
          </p>

          {upcomingTransactions.map(tx => (
            <div key={tx.id} className="bg-white p-3 rounded border border-blue-100">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">{tx.description}</p>
                  <p className="text-xs text-gray-500">
                    Frequency: <span className="capitalize font-semibold">{tx.recurringFrequency}</span>
                  </p>
                </div>
                <p className={`font-semibold ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${Math.abs(tx.amount).toFixed(2)}
                </p>
              </div>
            </div>
          ))}

          {upcomingTransactions.length > 0 && (
            <button
              onClick={() => {
                const newTransactions = upcomingTransactions.map(tx => ({
                  ...tx,
                  lastAppliedDate: new Date().toISOString().split('T')[0],
                }));
                onApplyRecurring(newTransactions);
                setExpanded(false);
              }}
              className="w-full mt-3 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Apply Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}
