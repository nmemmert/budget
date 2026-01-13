'use client';

import { useState, useEffect } from 'react';

interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'mortgage' | 'investment' | 'loan';
  balance: number;
  color: string;
  isActive: boolean;
}

interface Envelope {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  color: string;
  accountId: string;
  isRecurring?: boolean;
  recurringFrequency?: 'weekly' | 'monthly' | 'yearly';
  lastRecurringDate?: string;
}

interface DemoWizardProps {
  onApplyDemo: (accounts: Account[], envelopes: Envelope[]) => void;
  onSkip: () => void;
  accountId?: string;
}

const DEMO_DATA = {
  accounts: [
    {
      id: crypto.randomUUID(),
      name: 'Main Checking',
      type: 'checking' as const,
      balance: 5000,
      color: 'bg-blue-500',
      isActive: true,
    },
    {
      id: crypto.randomUUID(),
      name: 'Emergency Fund',
      type: 'savings' as const,
      balance: 10000,
      color: 'bg-green-500',
      isActive: true,
    },
  ],
  envelopes: [
    { name: 'Rent', allocated: 1500, color: 'bg-red-500', isRecurring: true, recurringFrequency: 'monthly' as const },
    { name: 'Groceries', allocated: 400, color: 'bg-green-500', isRecurring: true, recurringFrequency: 'monthly' as const },
    { name: 'Utilities', allocated: 150, color: 'bg-yellow-500', isRecurring: true, recurringFrequency: 'monthly' as const },
    { name: 'Entertainment', allocated: 200, color: 'bg-purple-500', isRecurring: false },
    { name: 'Dining Out', allocated: 250, color: 'bg-pink-500', isRecurring: false },
    { name: 'Car Payment', allocated: 350, color: 'bg-indigo-500', isRecurring: true, recurringFrequency: 'monthly' as const },
  ],
};

export default function DemoWizard({ onApplyDemo, onSkip, accountId }: DemoWizardProps) {
  const [showDemo, setShowDemo] = useState(false);

  const handleApplyDemo = () => {
    // Use first account as default, or create new ones
    const firstAccountId = accountId || DEMO_DATA.accounts[0].id;
    
    const envelopes = DEMO_DATA.envelopes.map((env) => ({
      id: crypto.randomUUID(),
      ...env,
      accountId: firstAccountId,
      spent: 0,
    }));

    onApplyDemo(DEMO_DATA.accounts, envelopes);
  };

  if (!showDemo) {
    return (
      <div className="text-center space-y-4">
        <div className="text-6xl mb-4">📊</div>
        <h2 className="text-2xl font-bold text-gray-900">Want to See a Demo?</h2>
        <p className="text-gray-600 max-w-md mx-auto">
          We can populate your budget with sample accounts and envelopes to help you get started and explore the app's features.
        </p>
        <div className="flex gap-3 justify-center pt-4">
          <button
            onClick={() => setShowDemo(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Show Me Demo Data
          </button>
          <button
            onClick={onSkip}
            className="bg-gray-200 text-gray-900 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Skip for Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Demo Budget Setup</h2>
        <p className="text-gray-600 mb-6">
          Here's what we'll create for you:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">🏦 Accounts</h3>
          <ul className="space-y-2">
            {DEMO_DATA.accounts.map((acc) => (
              <li key={acc.name} className="text-sm text-blue-800">
                <span className="font-medium">{acc.name}</span> - ${acc.balance.toLocaleString()}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h3 className="font-semibold text-green-900 mb-3">📦 Envelopes</h3>
          <ul className="space-y-2">
            {DEMO_DATA.envelopes.map((env) => (
              <li key={env.name} className="text-sm text-green-800">
                <span className="font-medium">{env.name}</span> - ${env.allocated}/mo
                {env.isRecurring && (
                  <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded">Recurring</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>💡 Tip:</strong> You can always edit or delete these envelopes and accounts later. This is just a starting point!
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setShowDemo(false)}
          className="flex-1 bg-gray-200 text-gray-900 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={handleApplyDemo}
          className="flex-1 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-semibold"
        >
          Apply Demo Data →
        </button>
      </div>
    </div>
  );
}
