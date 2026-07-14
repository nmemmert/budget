'use client';

import { useState } from 'react';
import type { Goal } from '../app/page';

interface Account {
  id: string;
  name: string;
  balance: number;
  color: string;
}

interface GoalsManagerProps {
  goals: Goal[];
  accounts: Account[];
  onGoalsChange: (goals: Goal[]) => void;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export default function GoalsManager({ goals, accounts, onGoalsChange }: GoalsManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState({ name: '', targetAmount: '', currentAmount: '', accountId: '', targetDate: '', color: COLORS[0] });
  const [error, setError] = useState('');

  const openCreate = () => {
    setForm({ name: '', targetAmount: '', currentAmount: '', accountId: accounts[0]?.id ?? '', targetDate: '', color: COLORS[0] });
    setEditingGoal(null);
    setShowForm(true);
  };

  const openEdit = (g: Goal) => {
    setForm({
      name: g.name, targetAmount: g.targetAmount.toString(), currentAmount: g.currentAmount.toString(),
      accountId: g.accountId, targetDate: g.targetDate ?? '', color: g.color,
    });
    setEditingGoal(g);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.targetAmount) { setError('Name and target amount are required.'); return; }
    const goal: Goal = {
      id: editingGoal?.id ?? crypto.randomUUID(),
      name: form.name.trim(),
      targetAmount: parseFloat(form.targetAmount),
      currentAmount: parseFloat(form.currentAmount || '0'),
      accountId: form.accountId,
      targetDate: form.targetDate || undefined,
      color: form.color,
    };
    onGoalsChange(editingGoal
      ? goals.map(g => g.id === editingGoal.id ? goal : g)
      : [...goals, goal]);
    setShowForm(false);
    setError('');
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this goal?')) onGoalsChange(goals.filter(g => g.id !== id));
  };

  const updateAmount = (goal: Goal, delta: number) => {
    const next = Math.max(0, goal.currentAmount + delta);
    onGoalsChange(goals.map(g => g.id === goal.id ? { ...g, currentAmount: next } : g));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Goals</h2>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
          + Add Goal
        </button>
      </div>

      {goals.length === 0 && !showForm && (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No goals yet</h3>
          <p className="text-gray-500 text-sm mb-4">Create a savings goal and track your progress.</p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium">Add your first goal</button>
        </div>
      )}

      {showForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">{editingGoal ? 'Edit Goal' : 'New Goal'}</h3>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Goal name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Emergency Fund, Vacation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target amount ($)</label>
              <input type="number" min="0" step="0.01" value={form.targetAmount} onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current amount ($)</label>
              <input type="number" min="0" step="0.01" value={form.currentAmount} onChange={e => setForm(f => ({ ...f, currentAmount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked account (optional)</label>
              <select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">None</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target date (optional)</label>
              <input type="date" value={form.targetDate} onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 ${form.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">Save</button>
            <button onClick={() => { setShowForm(false); setError(''); }} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(g => {
          const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
          const remaining = Math.max(0, g.targetAmount - g.currentAmount);
          const linkedAcc = accounts.find(a => a.id === g.accountId);
          const daysLeft = g.targetDate ? Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000) : null;

          return (
            <div key={g.id} className="bg-white shadow rounded-lg overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: g.color }} />
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-900">{g.name}</h3>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(g)} className="text-indigo-600 hover:text-indigo-900 text-xs">Edit</button>
                    <button onClick={() => handleDelete(g.id)} className="text-red-500 hover:text-red-800 text-xs">Delete</button>
                  </div>
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>${g.currentAmount.toFixed(2)} saved</span>
                    <span>{Math.round(pct)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>${remaining.toFixed(2)} to go</span>
                    <span>Goal: ${g.targetAmount.toFixed(2)}</span>
                  </div>
                </div>

                {linkedAcc && (
                  <p className="text-xs text-gray-400 mb-2">Linked to: {linkedAcc.name}</p>
                )}
                {daysLeft !== null && (
                  <p className={`text-xs mb-3 ${daysLeft < 30 ? 'text-red-500' : 'text-gray-400'}`}>
                    {daysLeft > 0 ? `${daysLeft} days until target` : 'Target date passed'}
                  </p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => {
                    const v = parseFloat(prompt('Add amount ($):', '0') ?? '0');
                    if (!isNaN(v) && v > 0) updateAmount(g, v);
                  }}
                    className="flex-1 text-xs py-1.5 bg-green-50 border border-green-200 text-green-700 rounded hover:bg-green-100">
                    + Add funds
                  </button>
                  <button onClick={() => {
                    const v = parseFloat(prompt('Withdraw amount ($):', '0') ?? '0');
                    if (!isNaN(v) && v > 0) updateAmount(g, -v);
                  }}
                    className="flex-1 text-xs py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded hover:bg-gray-100">
                    − Withdraw
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
