'use client';

import { useState, useEffect } from 'react';

interface EnvelopeEditProps {
  envelope: {
    id: string;
    name: string;
    allocated: number;
    spent: number;
    color: string;
    accountId: string;
    incomeAllocation?: number;
    incomeAllocationType?: 'percentage' | 'fixed';
  };
  accounts: { id: string; name: string }[];
  onEnvelopeUpdated: (envelope: {
    id: string;
    name: string;
    allocated: number;
    spent: number;
    color: string;
    accountId: string;
    incomeAllocation?: number;
    incomeAllocationType?: 'percentage' | 'fixed';
  }) => void;
  onCancel: () => void;
}

const colorOptions = [
  { value: 'bg-green-500', label: 'Green', color: '#10B981' },
  { value: 'bg-blue-500', label: 'Blue', color: '#3B82F6' },
  { value: 'bg-purple-500', label: 'Purple', color: '#8B5CF6' },
  { value: 'bg-orange-500', label: 'Orange', color: '#F97316' },
  { value: 'bg-red-500', label: 'Red', color: '#EF4444' },
  { value: 'bg-yellow-500', label: 'Yellow', color: '#EAB308' },
  { value: 'bg-pink-500', label: 'Pink', color: '#EC4899' },
  { value: 'bg-indigo-500', label: 'Indigo', color: '#6366F1' },
];

export default function EnvelopeEdit({ envelope, onEnvelopeUpdated, onCancel, accounts }: EnvelopeEditProps) {
  const [name, setName] = useState(envelope.name);
  const [allocated, setAllocated] = useState(envelope.allocated.toString());
  const [selectedColor, setSelectedColor] = useState(envelope.color);
  const [selectedAccount, setSelectedAccount] = useState(envelope.accountId);
  const [incomeAllocationType, setIncomeAllocationType] = useState<'percentage' | 'fixed'>(envelope.incomeAllocationType || 'percentage');
  const [incomeAllocation, setIncomeAllocation] = useState(envelope.incomeAllocation?.toString() || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numAllocated = parseFloat(allocated);
    if (!name.trim() || isNaN(numAllocated) || numAllocated <= 0) {
      alert('Please enter a valid envelope name and positive allocated amount');
      return;
    }

    // Validate income allocation
    if (incomeAllocation) {
      const allocationValue = parseFloat(incomeAllocation);
      if (isNaN(allocationValue) || allocationValue < 0) {
        alert('Please enter a valid income allocation amount');
        return;
      }
      if (incomeAllocationType === 'percentage' && allocationValue > 100) {
        alert('Percentage allocation cannot exceed 100%');
        return;
      }
    }

    const updatedEnvelope = {
      ...envelope,
      name: name.trim(),
      allocated: numAllocated,
      color: selectedColor,
      accountId: selectedAccount,
      incomeAllocation: incomeAllocation ? parseFloat(incomeAllocation) : undefined,
      incomeAllocationType: incomeAllocation ? incomeAllocationType : undefined,
    };

    onEnvelopeUpdated(updatedEnvelope);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Envelope</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Envelope Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Groceries, Transportation"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allocated Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={allocated}
                onChange={(e) => setAllocated(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="grid grid-cols-4 gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-12 h-12 rounded-full border-2 ${
                    selectedColor === color.value ? 'border-gray-800' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.color }}
                  title={color.label}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Selected: {colorOptions.find(c => c.value === selectedColor)?.label}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Income Allocation (Optional)
            </label>
            <div className="space-y-2">
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="allocationType"
                    value="percentage"
                    checked={incomeAllocationType === 'percentage'}
                    onChange={(e) => setIncomeAllocationType(e.target.value as 'percentage' | 'fixed')}
                    className="mr-2"
                  />
                  Percentage
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="allocationType"
                    value="fixed"
                    checked={incomeAllocationType === 'fixed'}
                    onChange={(e) => setIncomeAllocationType(e.target.value as 'percentage' | 'fixed')}
                    className="mr-2"
                  />
                  Fixed Amount
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  {incomeAllocationType === 'percentage' ? '%' : '$'}
                </span>
                <input
                  type="number"
                  step={incomeAllocationType === 'percentage' ? '1' : '0.01'}
                  min="0"
                  max={incomeAllocationType === 'percentage' ? '100' : undefined}
                  value={incomeAllocation}
                  onChange={(e) => setIncomeAllocation(e.target.value)}
                  placeholder={incomeAllocationType === 'percentage' ? 'e.g., 25' : 'e.g., 100.00'}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                {incomeAllocationType === 'percentage'
                  ? 'Percentage of income to allocate to this envelope automatically'
                  : 'Fixed dollar amount to allocate to this envelope automatically'
                }
              </p>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Update Envelope
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