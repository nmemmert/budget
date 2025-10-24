'use client';

import { useState } from 'react';
import FileUpload, { ParsedTransaction } from './FileUpload';
import ManualEntry from './ManualEntry';

interface DataInputProps {
  onTransactionsAdded: (transactions: Array<{
    id: string;
    envelopeId?: string;
    amount: number;
    description: string;
    date: Date;
    accountId: string;
  }>) => void;
  envelopes: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}

type InputMode = 'file' | 'manual';

export default function DataInput({ onTransactionsAdded, envelopes, accounts }: DataInputProps) {
  const [inputMode, setInputMode] = useState<InputMode>('manual');

  const handleFileTransactionsParsed = (parsedTransactions: ParsedTransaction[]) => {
    const transactions = parsedTransactions.map((t, index) => ({
      id: `imported-${Date.now()}-${index}`,
      amount: t.amount,
      description: t.description,
      date: t.date,
      envelopeId: undefined, // User can assign envelopes later
      accountId: accounts?.[0]?.id || 'default-account', // Default to first account
    }));

    onTransactionsAdded(transactions);
  };

  const handleManualTransactionAdded = (transaction: {
    amount: number;
    description: string;
    date: Date;
    envelopeId?: string;
    accountId: string;
  }) => {
    const newTransaction = {
      id: `manual-${Date.now()}`,
      ...transaction,
    };

    onTransactionsAdded([newTransaction]);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Add Transactions</h2>

        {/* Mode Selection */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setInputMode('manual')}
            className={`px-4 py-2 rounded-md font-medium ${
              inputMode === 'manual'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setInputMode('file')}
            className={`px-4 py-2 rounded-md font-medium ${
              inputMode === 'file'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Import from File
          </button>
        </div>
      </div>

      {/* Content based on selected mode */}
      {inputMode === 'manual' ? (
        <ManualEntry
          onTransactionAdded={handleManualTransactionAdded}
          envelopes={envelopes}
          accounts={accounts}
        />
      ) : (
        <FileUpload onTransactionsParsed={handleFileTransactionsParsed} accounts={accounts} />
      )}

      {/* Help Text */}
      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Tips:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Manual Entry:</strong> Perfect for quick transactions and cash expenses</li>
          <li>• <strong>File Import:</strong> Great for bulk transactions from your bank statements</li>
          <li>• You can assign transactions to envelopes immediately or categorize them later</li>
          <li>• Negative amounts are expenses, positive amounts are income</li>
        </ul>
      </div>
    </div>
  );
}