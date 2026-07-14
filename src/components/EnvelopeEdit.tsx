'use client';

import { useState, useEffect } from 'react';

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

interface EnvelopeEditProps {
  envelope: Envelope;
  accounts: { id: string; name: string }[];
  onEnvelopeUpdated: (envelope: Envelope) => void;
  onEnvelopeDeleted?: (envelopeId: string) => void;
  onCancel: () => void;
}

const colorOptions = [
  { label: 'Green',  color: '#10B981' },
  { label: 'Blue',   color: '#3B82F6' },
  { label: 'Purple', color: '#8B5CF6' },
  { label: 'Orange', color: '#F97316' },
  { label: 'Red',    color: '#EF4444' },
  { label: 'Yellow', color: '#EAB308' },
  { label: 'Pink',   color: '#EC4899' },
  { label: 'Indigo', color: '#6366F1' },
];

export default function EnvelopeEdit({ envelope, onEnvelopeUpdated, onEnvelopeDeleted, onCancel, accounts }: EnvelopeEditProps) {
  const [name, setName] = useState(envelope.name);
  const [allocated, setAllocated] = useState(envelope.allocated.toString());
  const [selectedColor, setSelectedColor] = useState(envelope.color);
  const [selectedAccount, setSelectedAccount] = useState(envelope.accountId);
  const [incomeAllocationType, setIncomeAllocationType] = useState<'percentage' | 'fixed'>(envelope.incomeAllocationType || 'percentage');
  const [incomeAllocation, setIncomeAllocation] = useState(envelope.incomeAllocation?.toString() || '');
  const [rollover, setRollover] = useState(envelope.rollover ?? false);

  useEffect(() => {
    setName(envelope.name);
    setAllocated(envelope.allocated.toString());
    setSelectedColor(envelope.color);
    setSelectedAccount(envelope.accountId);
    setIncomeAllocationType(envelope.incomeAllocationType || 'percentage');
    setIncomeAllocation(envelope.incomeAllocation?.toString() || '');
    setRollover(envelope.rollover ?? false);
  }, [envelope]);

  const handleDelete = () => {
    if (confirm(`Delete envelope "${envelope.name}"? Transactions will be unassigned.`)) {
      onEnvelopeDeleted?.(envelope.id);
      onCancel();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAllocated = parseFloat(allocated);
    if (!name.trim() || isNaN(numAllocated) || numAllocated <= 0) {
      alert('Please enter a valid envelope name and positive allocated amount');
      return;
    }
    if (incomeAllocation) {
      const v = parseFloat(incomeAllocation);
      if (isNaN(v) || v < 0) { alert('Please enter a valid income allocation amount'); return; }
      if (incomeAllocationType === 'percentage' && v > 100) { alert('Percentage allocation cannot exceed 100%'); return; }
    }
    onEnvelopeUpdated({
      ...envelope,
      name: name.trim(),
      allocated: numAllocated,
      color: selectedColor,
      accountId: selectedAccount,
      incomeAllocation: incomeAllocation ? parseFloat(incomeAllocation) : undefined,
      incomeAllocationType: incomeAllocation ? incomeAllocationType : undefined,
      rollover,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Envelope</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Envelope Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Groceries, Transportation"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allocated Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input type="number" step="0.01" min="0" value={allocated} onChange={e => setAllocated(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map(c => (
                <button key={c.color} type="button" onClick={() => setSelectedColor(c.color)}
                  className={`w-10 h-10 rounded-full border-2 transition-transform ${selectedColor === c.color ? 'border-gray-800 scale-110' : 'border-gray-200'}`}
                  style={{ backgroundColor: c.color }} title={c.label} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
            <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Rollover toggle */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <p className="text-sm font-medium text-gray-700">Roll over unspent funds</p>
              <p className="text-xs text-gray-500">Unspent money carries into next month instead of resetting.</p>
            </div>
            <button type="button" onClick={() => setRollover(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${rollover ? 'bg-blue-600' : 'bg-gray-300'}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rollover ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Income Allocation (Optional)</label>
            <div className="space-y-2">
              <div className="flex space-x-4">
                {(['percentage', 'fixed'] as const).map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="allocationType" value={type}
                      checked={incomeAllocationType === type} onChange={() => setIncomeAllocationType(type)} />
                    {type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                  </label>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  {incomeAllocationType === 'percentage' ? '%' : '$'}
                </span>
                <input type="number" step={incomeAllocationType === 'percentage' ? '1' : '0.01'}
                  min="0" max={incomeAllocationType === 'percentage' ? '100' : undefined}
                  value={incomeAllocation} onChange={e => setIncomeAllocation(e.target.value)}
                  placeholder={incomeAllocationType === 'percentage' ? 'e.g., 25' : 'e.g., 100.00'}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-xs text-gray-500">
                {incomeAllocationType === 'percentage'
                  ? 'Percentage of income to auto-allocate here'
                  : 'Fixed dollar amount to auto-allocate here'}
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleDelete}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 text-sm font-medium">
              Delete
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm font-medium">
              Update
            </button>
            <button type="button" onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
