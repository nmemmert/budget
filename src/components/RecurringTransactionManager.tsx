'use client';

import { useState } from 'react';

interface RecurringTx {
  id: string;
  description: string;
  amount: number;
  accountId: string;
  envelopeId?: string;
  date: Date;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  lastAppliedDate?: string;
}

interface RecurringTransactionManagerProps {
  transactions: RecurringTx[];
  onApplyRecurring: (due: RecurringTx[]) => void;
}

function nextDate(tx: RecurringTx): Date | null {
  const last = tx.lastAppliedDate ? new Date(tx.lastAppliedDate) : (tx.date instanceof Date ? tx.date : new Date(tx.date));
  const next = new Date(last);
  switch (tx.recurringFrequency) {
    case 'weekly':    next.setDate(next.getDate() + 7); break;
    case 'biweekly':  next.setDate(next.getDate() + 14); break;
    case 'monthly':   next.setMonth(next.getMonth() + 1); break;
    case 'yearly':    next.setFullYear(next.getFullYear() + 1); break;
    default: return null;
  }
  return next;
}

export default function RecurringTransactionManager({ transactions, onApplyRecurring }: RecurringTransactionManagerProps) {
  const [expanded, setExpanded] = useState(false);

  const recurring = transactions.filter(t => t.isRecurring && t.recurringFrequency);
  const now = new Date();

  const due = recurring.filter(t => {
    const n = nextDate(t);
    return n && n <= now;
  });

  const upcoming = recurring.filter(t => {
    const n = nextDate(t);
    return n && n > now;
  }).sort((a, b) => {
    const na = nextDate(a)!.getTime();
    const nb = nextDate(b)!.getTime();
    return na - nb;
  });

  if (recurring.length === 0) return null;

  return (
    <div className={`border rounded-lg p-4 mb-6 ${due.length > 0 ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-200'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex justify-between items-center font-semibold text-gray-900 hover:text-gray-700"
      >
        <span className="flex items-center gap-2">
          <span>↻ Recurring Transactions</span>
          {due.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">{due.length} due</span>
          )}
        </span>
        <span className="text-gray-500 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {due.length > 0 && (
            <div>
              <p className="text-sm font-medium text-amber-900 mb-2">Due now ({due.length})</p>
              <div className="space-y-2">
                {due.map(tx => (
                  <div key={tx.id} className="bg-white border border-amber-200 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{tx.description}</p>
                      <p className="text-xs text-gray-500 capitalize">{tx.recurringFrequency} · was due {nextDate(tx)?.toLocaleDateString()}</p>
                    </div>
                    <p className={`font-semibold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => onApplyRecurring(due)}
                className="w-full mt-3 bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
              >
                Apply {due.length} overdue transaction{due.length > 1 ? 's' : ''} now
              </button>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <p className="text-sm font-medium text-blue-900 mb-2">Upcoming</p>
              <div className="space-y-2">
                {upcoming.slice(0, 5).map(tx => (
                  <div key={tx.id} className="bg-white border border-blue-100 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{tx.description}</p>
                      <p className="text-xs text-gray-500 capitalize">{tx.recurringFrequency} · next: {nextDate(tx)?.toLocaleDateString()}</p>
                    </div>
                    <p className={`font-semibold text-sm ${tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
