'use client';

import { useEffect, useState } from 'react';

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

type DistributionMethod = 'proportional' | 'equal' | 'custom';
type AllocationMap = Record<string, number>;

interface PaycheckSchedule {
  frequency: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
  dayOfWeek?: number; // 0-6, for weekly/biweekly
  dayOfMonth?: number; // 1-31, for monthly/semimonthly
  dayOfMonth2?: number; // for semimonthly second date
}

interface PaycheckTemplate {
  amount: number;
  selectedAccountId: string;
  description: string;
  distributionMethod: DistributionMethod;
  customAllocations: AllocationMap;
  schedule?: PaycheckSchedule;
}

interface GetPaidProps {
  accounts: Account[];
  envelopes: Envelope[];
  onIncomeAdded: (transactions: Transaction[]) => void;
  onAccountUpdate?: (account: Account) => void;
  autoOpen?: boolean;
}

export default function GetPaid({
  accounts,
  envelopes,
  onIncomeAdded,
  onAccountUpdate,
  autoOpen = false,
}: GetPaidProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [showPreview, setShowPreview] = useState(false);
  const [amount, setAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [description, setDescription] = useState('Paycheck');
  const [distributionMethod, setDistributionMethod] = useState<DistributionMethod>('proportional');
  const [customAllocations, setCustomAllocations] = useState<AllocationMap>({});
  const [previewAllocations, setPreviewAllocations] = useState<AllocationMap>({});
  const [showDefaultAmountField, setShowDefaultAmountField] = useState(false);
  const [defaultAmountInput, setDefaultAmountInput] = useState('');
  const [saveTemplate, setSaveTemplate] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState<PaycheckTemplate | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedule, setSchedule] = useState<PaycheckSchedule>({ frequency: 'biweekly', dayOfWeek: 5 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const template = localStorage.getItem('paycheckTemplate');
    if (!template) return;

    try {
      const parsed = JSON.parse(template) as PaycheckTemplate;
      setSavedTemplate(parsed);
    } catch (error) {
      console.error('Error loading saved template', error);
    }
  }, []);

  const accountEnvelopes = selectedAccountId
    ? envelopes.filter((env) => env.accountId === selectedAccountId)
    : [];

  const totalAllocated = accountEnvelopes.reduce((sum, env) => sum + env.allocated, 0);

  const calculateDistribution = (): AllocationMap => {
    const paycheckAmount = parseFloat(amount);
    if (!paycheckAmount || accountEnvelopes.length === 0) return {};

    if (distributionMethod === 'custom') {
      const sanitized: AllocationMap = {};
      accountEnvelopes.forEach((env) => {
        sanitized[env.id] = Math.max(0, customAllocations[env.id] || 0);
      });
      return sanitized;
    }

    const distribution: AllocationMap = {};

    if (distributionMethod === 'equal') {
      const equalAmount = paycheckAmount / accountEnvelopes.length;
      accountEnvelopes.forEach((env) => {
        distribution[env.id] = equalAmount;
      });
      return distribution;
    }

    accountEnvelopes.forEach((env) => {
      const proportion = totalAllocated > 0 ? env.allocated / totalAllocated : 0;
      distribution[env.id] = paycheckAmount * proportion;
    });

    return distribution;
  };

  const applySavedTemplate = () => {
    if (!savedTemplate) return;
    setAmount(savedTemplate.amount?.toString() || '');
    setSelectedAccountId(savedTemplate.selectedAccountId || '');
    setDescription(savedTemplate.description || 'Paycheck');
    setDistributionMethod(savedTemplate.distributionMethod || 'proportional');
    setCustomAllocations(savedTemplate.customAllocations || {});
    if (savedTemplate.schedule) setSchedule(savedTemplate.schedule);
  };

  const computeNextPayday = (sched: PaycheckSchedule): Date => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(today);

    if (sched.frequency === 'weekly' || sched.frequency === 'biweekly') {
      const dow = sched.dayOfWeek ?? 5;
      const diff = (dow - today.getDay() + 7) % 7 || (sched.frequency === 'biweekly' ? 14 : 7);
      next.setDate(today.getDate() + diff);
    } else if (sched.frequency === 'semimonthly') {
      const d1 = sched.dayOfMonth ?? 1;
      const d2 = sched.dayOfMonth2 ?? 15;
      const thisMonthD1 = new Date(today.getFullYear(), today.getMonth(), d1);
      const thisMonthD2 = new Date(today.getFullYear(), today.getMonth(), d2);
      const nextMonthD1 = new Date(today.getFullYear(), today.getMonth() + 1, d1);
      const candidates = [thisMonthD1, thisMonthD2, nextMonthD1].filter(d => d > today);
      return candidates.sort((a, b) => a.getTime() - b.getTime())[0] ?? nextMonthD1;
    } else {
      const dom = sched.dayOfMonth ?? 1;
      next.setDate(dom);
      if (next <= today) next.setMonth(next.getMonth() + 1);
    }
    return next;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const paycheckAmount = parseFloat(amount);
    if (!paycheckAmount || !selectedAccountId) {
      alert('Please enter a valid amount and select an account');
      return;
    }

    if (paycheckAmount <= 0 || paycheckAmount > 999999999) {
      alert('Please enter a valid paycheck amount ($0 - $999,999,999)');
      return;
    }

    const distribution = calculateDistribution();
    setPreviewAllocations(distribution);
    setShowPreview(true);
  };

  const handleConfirmPaycheck = () => {
    const paycheckAmount = parseFloat(amount);
    if (!paycheckAmount || !selectedAccountId) return;

    const transactions: Transaction[] = [];

    transactions.push({
      id: crypto.randomUUID(),
      amount: paycheckAmount,
      description: description || 'Paycheck',
      date: new Date(),
      accountId: selectedAccountId,
    });

    Object.entries(previewAllocations).forEach(([envelopeId, allocatedAmount]) => {
      if (allocatedAmount > 0) {
        transactions.push({
          id: crypto.randomUUID(),
          envelopeId,
          amount: allocatedAmount,
          description: `${description} → ${envelopes.find((env) => env.id === envelopeId)?.name || 'Envelope'}`,
          date: new Date(),
          accountId: selectedAccountId,
        });
      }
    });

    if (saveTemplate && typeof window !== 'undefined') {
      const template: PaycheckTemplate = {
        amount: paycheckAmount,
        selectedAccountId,
        description,
        distributionMethod,
        customAllocations: previewAllocations,
        schedule: showSchedule ? schedule : undefined,
      };
      localStorage.setItem('paycheckTemplate', JSON.stringify(template));
      setSavedTemplate(template);
    }

    onIncomeAdded(transactions);

    setIsOpen(false);
    setShowPreview(false);
    setAmount('');
    setSelectedAccountId('');
    setDescription('Paycheck');
    setCustomAllocations({});
    setPreviewAllocations({});
    setShowDefaultAmountField(false);
    setDefaultAmountInput('');
    setSaveTemplate(false);
  };

  const handleEditAllocation = (envelopeId: string, newAmount: string) => {
    const numAmount = parseFloat(newAmount);
    if (Number.isNaN(numAmount) || numAmount < 0) return;

    setPreviewAllocations((prev) => ({
      ...prev,
      [envelopeId]: numAmount,
    }));
  };

  const handleSetDefaultAmount = () => {
    const defaultAmount = parseFloat(defaultAmountInput);
    if (!defaultAmount || defaultAmount <= 0) {
      alert('Please enter a valid default amount');
      return;
    }

    const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);
    if (!selectedAccount) return;

    const updatedAccount = { ...selectedAccount, defaultPaycheckAmount: defaultAmount };

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
    const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId);
    if (selectedAccount?.defaultPaycheckAmount) {
      setAmount(selectedAccount.defaultPaycheckAmount.toString());
    }
  };

  const distribution = calculateDistribution();
  const numericAmount = parseFloat(amount || '0') || 0;
  const totalDistributed = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const remaining = numericAmount - totalDistributed;

  return (
    <>
      {!autoOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="text-white px-4 py-2 rounded-md hover:opacity-90 flex items-center space-x-2 transition-opacity"
          style={{ backgroundColor: 'var(--color-finance-green)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
            />
          </svg>
          <span>Get Paid</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Record Paycheck</h3>

            {savedTemplate && (
              <div className="rounded-lg p-3 mb-4 border" style={{ backgroundColor: 'rgba(30, 115, 190, 0.05)', borderColor: 'var(--color-cloud-blue)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Saved Template Available</p>
                    <p className="text-xs text-gray-600">
                      Amount: ${savedTemplate.amount?.toFixed(2)} • {savedTemplate.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applySavedTemplate}
                    className="px-3 py-1 text-sm text-white rounded hover:opacity-90 whitespace-nowrap transition-opacity"
                    style={{ backgroundColor: 'var(--color-primary-blue)' }}
                  >
                    Use Template
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paycheck Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {selectedAccountId &&
                    accounts.find((acc) => acc.id === selectedAccountId)?.defaultPaycheckAmount && (
                      <button
                        type="button"
                        onClick={handleUseDefaultAmount}
                        className="mt-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        Use default: $
                        {accounts
                          .find((acc) => acc.id === selectedAccountId)
                          ?.defaultPaycheckAmount?.toFixed(2)}
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
                          onChange={(event) => setDefaultAmountInput(event.target.value)}
                          className="w-full pl-8 pr-3 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-400"
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSetDefaultAmount}
                        className="px-3 py-1 text-sm text-white rounded hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: 'var(--color-primary-blue)' }}
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
                    onChange={(event) => setSelectedAccountId(event.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    required
                  >
                    <option value="">Select account...</option>
                    {accounts.map((account) => (
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
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Paycheck description"
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="saveTemplate" checked={saveTemplate} onChange={e => setSaveTemplate(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-700">Save this information to use next time</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showSchedule} onChange={e => setShowSchedule(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-700">Set a paycheck schedule (shows next payday)</span>
                </label>
                {showSchedule && (
                  <div className="ml-6 p-3 bg-green-50 border border-green-200 rounded-lg space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
                      <select value={schedule.frequency} onChange={e => setSchedule(s => ({ ...s, frequency: e.target.value as PaycheckSchedule['frequency'] }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900">
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly (every 2 weeks)</option>
                        <option value="semimonthly">Semi-monthly (twice a month)</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    {(schedule.frequency === 'weekly' || schedule.frequency === 'biweekly') && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Payday</label>
                        <select value={schedule.dayOfWeek ?? 5} onChange={e => setSchedule(s => ({ ...s, dayOfWeek: parseInt(e.target.value) }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900">
                          {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                            <option key={i} value={i}>{d}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {schedule.frequency === 'semimonthly' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">First payday</label>
                          <input type="number" min={1} max={31} value={schedule.dayOfMonth ?? 1}
                            onChange={e => setSchedule(s => ({ ...s, dayOfMonth: parseInt(e.target.value) }))}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Second payday</label>
                          <input type="number" min={1} max={31} value={schedule.dayOfMonth2 ?? 15}
                            onChange={e => setSchedule(s => ({ ...s, dayOfMonth2: parseInt(e.target.value) }))}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900" />
                        </div>
                      </div>
                    )}
                    {schedule.frequency === 'monthly' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Day of month</label>
                        <input type="number" min={1} max={31} value={schedule.dayOfMonth ?? 1}
                          onChange={e => setSchedule(s => ({ ...s, dayOfMonth: parseInt(e.target.value) }))}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white text-gray-900" />
                      </div>
                    )}
                    <p className="text-xs text-green-800 font-medium">
                      Next payday: {computeNextPayday(schedule).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                )}
              </div>

              {selectedAccountId && accountEnvelopes.length > 0 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-800 mb-2">Income Distribution Method</label>
                    <div className="space-y-2 text-gray-900">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="proportional"
                          checked={distributionMethod === 'proportional'}
                          onChange={(event) =>
                            setDistributionMethod(event.target.value as DistributionMethod)
                          }
                          className="accent-blue-600"
                        />
                        <span className="text-sm font-medium">Proportional to envelope allocations</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="equal"
                          checked={distributionMethod === 'equal'}
                          onChange={(event) => setDistributionMethod(event.target.value as DistributionMethod)}
                          className="accent-blue-600"
                        />
                        <span className="text-sm font-medium">Equal distribution to all envelopes</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="custom"
                          checked={distributionMethod === 'custom'}
                          onChange={(event) => setDistributionMethod(event.target.value as DistributionMethod)}
                          className="accent-blue-600"
                        />
                        <span className="text-sm font-medium">Custom amounts</span>
                      </label>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Income Distribution Preview</h4>
                    <div className="space-y-2">
                      {accountEnvelopes.map((envelope) => {
                        const allocatedAmount = distribution[envelope.id] || 0;
                        const percentage = numericAmount > 0 ? (allocatedAmount / numericAmount) * 100 : 0;

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
                                  value={customAllocations[envelope.id] ?? ''}
                                  onChange={(event) =>
                                    setCustomAllocations((prev) => ({
                                      ...prev,
                                      [envelope.id]: parseFloat(event.target.value) || 0,
                                    }))
                                  }
                                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded bg-white text-gray-900 placeholder-gray-400"
                                  placeholder="0.00"
                                />
                              ) : (
                                <span className="text-sm font-semibold text-gray-900">${allocatedAmount.toFixed(2)}</span>
                              )}
                              <span className="text-xs font-semibold text-gray-700">({percentage.toFixed(1)}%)</span>
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

              {selectedAccountId && accountEnvelopes.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-sm text-gray-700" style={{ borderColor: 'var(--color-cloud-blue)' }}>
                  No envelopes are linked to this account. Create envelopes for this account to distribute income here.
                </div>
              )}

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
                  className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  style={{ backgroundColor: 'var(--color-finance-green)' }}
                >
                  Review & Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Paycheck Allocation</h3>

            <div className="mb-6">
              <div className="rounded-lg p-4 border" style={{ backgroundColor: 'rgba(30, 115, 190, 0.05)', borderColor: 'var(--color-cloud-blue)' }}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Paycheck Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">${numericAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm text-gray-600">Deposit to:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {accounts.find((acc) => acc.id === selectedAccountId)?.name}
                  </span>
                </div>
                {description && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-gray-600">Description:</span>
                    <span className="text-sm text-gray-900">{description}</span>
                  </div>
                )}
              </div>
            </div>

            <h4 className="font-semibold text-gray-900 mb-3">Envelope Allocations</h4>
            <p className="text-sm text-gray-600 mb-4">Review and adjust how this paycheck will be distributed:</p>

            <div className="space-y-3 mb-6">
              {accountEnvelopes.map((envelope) => {
                const allocatedAmount = previewAllocations[envelope.id] || 0;
                const percentage = numericAmount > 0 ? (allocatedAmount / numericAmount) * 100 : 0;

                return (
                  <div key={envelope.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full ${envelope.color}`}></div>
                        <span className="font-medium text-gray-900">{envelope.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">{percentage.toFixed(1)}% of paycheck</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-700 font-medium">Amount:</span>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 font-semibold">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={allocatedAmount.toFixed(2)}
                          onChange={(event) => handleEditAllocation(envelope.id, event.target.value)}
                          className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg p-4 mb-6 border" style={{ backgroundColor: 'rgba(40, 167, 69, 0.05)', borderColor: 'var(--color-finance-green)' }}>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total Allocated:</span>
                <span className="text-xl font-bold" style={{ color: 'var(--color-finance-green)' }}>
                  ${Object.values(previewAllocations).reduce((sum, value) => sum + value, 0).toFixed(2)}
                </span>
              </div>
              {(() => {
                const totalAllocatedPreview = Object.values(previewAllocations).reduce(
                  (sum, value) => sum + value,
                  0,
                );
                const remainingAmount = numericAmount - totalAllocatedPreview;

                if (Math.abs(remainingAmount) >= 0.01) {
                  return (
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-gray-600">Unallocated:</span>
                      <span
                        className={`text-sm font-medium ${remainingAmount >= 0 ? 'text-orange-600' : 'text-red-600'}`}
                      >
                        ${remainingAmount.toFixed(2)} {remainingAmount < 0 && '(over allocated!)'}
                      </span>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Go Back
              </button>
              <button
                type="button"
                onClick={handleConfirmPaycheck}
                disabled={(() => {
                  const totalAllocatedPreview = Object.values(previewAllocations).reduce(
                    (sum, value) => sum + value,
                    0,
                  );
                  const remainingAmount = numericAmount - totalAllocatedPreview;
                  return Math.abs(remainingAmount) >= 0.01;
                })()}
                className="px-4 py-2 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                style={{ backgroundColor: 'var(--color-finance-green)' }}
              >
                Confirm & Apply Paycheck
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

