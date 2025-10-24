'use client';

import { useState } from 'react';

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
}

interface Transaction {
  id: string;
  envelopeId?: string;
  amount: number;
  description: string;
  date: Date;
  accountId: string;
}

interface GetPaidProps {
  accounts: Account[];
  envelopes: Envelope[];
  onIncomeAdded: (transactions: Transaction[]) => void;
  onAccountUpdate?: (account: Account) => void;
}

export default function GetPaid({ accounts, envelopes, onIncomeAdded, onAccountUpdate }: GetPaidProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [description, setDescription] = useState('Paycheck');
  const [distributionMethod, setDistributionMethod] = useState<'proportional' | 'equal' | 'custom'>('proportional');
  const [customAllocations, setCustomAllocations] = useState<{ [envelopeId: string]: number }>({});
  const [showDefaultAmountField, setShowDefaultAmountField] = useState(false);
  const [defaultAmountInput, setDefaultAmountInput] = useState('');

  if (!accounts || accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Get Paid</h3>
        <p className="text-gray-600">Please add an account first to record paychecks.</p>
      </div>
    );
  }

  if (!envelopes) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Get Paid</h3>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const accountEnvelopes = selectedAccountId ? envelopes.filter(env => env.accountId === selectedAccountId) : [];
  const totalAllocated = accountEnvelopes.reduce((sum, env) => sum + env.allocated, 0);

  const calculateDistribution = () => {
    const paycheckAmount = parseFloat(amount);
    if (!paycheckAmount || accountEnvelopes.length === 0) return {};

    const distribution: { [envelopeId: string]: number } = {};

    if (distributionMethod === 'equal') {
      const equalAmount = paycheckAmount / accountEnvelopes.length;
      accountEnvelopes.forEach(env => {
        distribution[env.id] = equalAmount;
      });
    } else if (distributionMethod === 'proportional') {
      accountEnvelopes.forEach(env => {
        const proportion = env.allocated / totalAllocated;
        distribution[env.id] = paycheckAmount * proportion;
      });
    } else if (distributionMethod === 'custom') {
      return customAllocations;
    }

    return distribution;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const paycheckAmount = parseFloat(amount);
    if (!paycheckAmount || !selectedAccountId) {
      alert('Please enter a valid amount and select an account');
      return;
    }

    const distribution = calculateDistribution();
    const transactions: Transaction[] = [];

    // Add the main paycheck transaction to the account
    transactions.push({
      id: `paycheck-${Date.now()}`,
      amount: paycheckAmount,
      description: description || 'Paycheck',
      date: new Date(),
      accountId: selectedAccountId,
    });

    // Add allocation transactions to envelopes
    Object.entries(distribution).forEach(([envelopeId, allocatedAmount]) => {
      if (allocatedAmount > 0) {
        transactions.push({
          id: `allocation-${envelopeId}-${Date.now()}`,
          envelopeId,
          amount: allocatedAmount,
          description: `Paycheck allocation - ${envelopes.find(e => e.id === envelopeId)?.name}`,
          date: new Date(),
          accountId: selectedAccountId,
        });
      }
    });

    onIncomeAdded(transactions);
    setIsOpen(false);
    setAmount('');
    setDescription('Paycheck');
    setCustomAllocations({});
    setShowDefaultAmountField(false);
    setDefaultAmountInput('');
  };

  const handleSetDefaultAmount = () => {
    const defaultAmount = parseFloat(defaultAmountInput);
    if (!defaultAmount || defaultAmount <= 0) {
      alert('Please enter a valid default amount');
      return;
    }

    const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
    if (!selectedAccount) return;

    const updatedAccount = {
      ...selectedAccount,
      defaultPaycheckAmount: defaultAmount
    };

    if (onAccountUpdate) {
      onAccountUpdate(updatedAccount);
      alert(`Default paycheck amount set to $${defaultAmount.toFixed(2)} for this account`);
      setShowDefaultAmountField(false);
      setDefaultAmountInput('');
    } else {
      alert('Unable to save default amount - account update not available');
    }
  };

  const handleUseDefaultAmount = () => {
    const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
    if (selectedAccount?.defaultPaycheckAmount) {
      setAmount(selectedAccount.defaultPaycheckAmount.toString());
    }
  };

  const distribution = calculateDistribution();
  const totalDistributed = Object.values(distribution).reduce((sum, amt) => sum + amt, 0);
  const remaining = parseFloat(amount) - totalDistributed;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center space-x-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
        <span>Get Paid</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Record Paycheck</h3>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paycheck Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {selectedAccountId && accounts.find(acc => acc.id === selectedAccountId)?.defaultPaycheckAmount && (
                    <button
                      type="button"
                      onClick={handleUseDefaultAmount}
                      className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      Use default: ${accounts.find(acc => acc.id === selectedAccountId)?.defaultPaycheckAmount?.toFixed(2)}
                    </button>
                  )}
                  {selectedAccountId && (
                    <button
                      type="button"
                      onClick={() => setShowDefaultAmountField(!showDefaultAmountField)}
                      className="mt-1 ml-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                      {showDefaultAmountField ? 'Cancel' : 'Set default amount'}
                    </button>
                  )}
                  {showDefaultAmountField && (
                    <div className="mt-2 flex space-x-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={defaultAmountInput}
                          onChange={(e) => setDefaultAmountInput(e.target.value)}
                          className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded"
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSetDefaultAmount}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Set
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Account</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select account...</option>
                    {accounts.filter(acc => acc.type !== 'credit_card' && acc.type !== 'mortgage' && acc.type !== 'loan').map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.type.replace('_', ' ')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Paycheck description"
                />
              </div>

              {/* Distribution Method */}
              {selectedAccountId && accountEnvelopes.length > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Income Distribution Method</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="proportional"
                          checked={distributionMethod === 'proportional'}
                          onChange={(e) => setDistributionMethod(e.target.value as 'proportional')}
                          className="mr-2"
                        />
                        <span className="text-sm">Proportional to envelope allocations</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="equal"
                          checked={distributionMethod === 'equal'}
                          onChange={(e) => setDistributionMethod(e.target.value as 'equal')}
                          className="mr-2"
                        />
                        <span className="text-sm">Equal distribution to all envelopes</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          value="custom"
                          checked={distributionMethod === 'custom'}
                          onChange={(e) => setDistributionMethod(e.target.value as 'custom')}
                          className="mr-2"
                        />
                        <span className="text-sm">Custom amounts</span>
                      </label>
                    </div>
                  </div>

                  {/* Distribution Preview */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Income Distribution Preview</h4>
                    <div className="space-y-2">
                      {accountEnvelopes.map((envelope) => {
                        const allocatedAmount = distribution[envelope.id] || 0;
                        const percentage = parseFloat(amount) > 0 ? (allocatedAmount / parseFloat(amount)) * 100 : 0;

                        return (
                          <div key={envelope.id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${envelope.color}`}></div>
                              <span className="text-sm text-gray-700">{envelope.name}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {distributionMethod === 'custom' ? (
                                <input
                                  type="number"
                                  step="0.01"
                                  value={customAllocations[envelope.id] || ''}
                                  onChange={(e) => setCustomAllocations(prev => ({
                                    ...prev,
                                    [envelope.id]: parseFloat(e.target.value) || 0
                                  }))}
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                                  placeholder="0.00"
                                />
                              ) : (
                                <span className="text-sm font-medium">${allocatedAmount.toFixed(2)}</span>
                              )}
                              <span className="text-xs text-gray-500">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Total Distributed:</span>
                        <span className={`font-medium ${Math.abs(remaining) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                          ${totalDistributed.toFixed(2)}
                        </span>
                      </div>
                      {Math.abs(remaining) >= 0.01 && (
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">Remaining:</span>
                          <span className={`font-medium ${remaining >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                            ${remaining.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Default Amount */}
              {selectedAccountId && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowDefaultAmountField(!showDefaultAmountField)}
                    className="text-sm text-blue-600 hover:underline mb-2"
                  >
                    {showDefaultAmountField ? 'Hide' : 'Set'} Default Paycheck Amount
                  </button>

                  {showDefaultAmountField && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h4 className="font-medium text-gray-900 mb-3">Default Paycheck Amount</h4>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          step="0.01"
                          value={defaultAmountInput}
                          onChange={(e) => setDefaultAmountInput(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                        <button
                          type="button"
                          onClick={handleSetDefaultAmount}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Set Default
                        </button>
                      </div>

                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleUseDefaultAmount}
                          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        >
                          Use Default Amount
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!amount || !selectedAccountId || (accountEnvelopes.length > 0 && Math.abs(remaining) >= 0.01)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  Record Paycheck
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}