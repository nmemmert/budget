'use client';

import { useState } from 'react';
import type { TransactionRule } from '../app/page';

interface Envelope { id: string; name: string; color: string }

interface Props {
  rules: TransactionRule[];
  envelopes: Envelope[];
  onRulesChange: (rules: TransactionRule[]) => void;
}

export default function TransactionRulesManager({ rules, envelopes, onRulesChange }: Props) {
  const [keyword, setKeyword] = useState('');
  const [envelopeId, setEnvelopeId] = useState(envelopes[0]?.id ?? '');
  const [matchCase, setMatchCase] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = () => {
    if (!keyword.trim()) { setError('Keyword is required.'); return; }
    if (!envelopeId) { setError('Select an envelope.'); return; }
    onRulesChange([...rules, { id: crypto.randomUUID(), keyword: keyword.trim(), envelopeId, matchCase }]);
    setKeyword(''); setError('');
  };

  const handleDelete = (id: string) => onRulesChange(rules.filter(r => r.id !== id));

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Auto-Categorization Rules</h2>
        <p className="text-gray-500 text-sm mt-1">
          When a new expense is added, if its description contains a keyword below, it's automatically assigned to the linked envelope.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-base font-medium text-gray-900 mb-4">Add a rule</h3>
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Keyword</label>
            <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder='e.g. "Whole Foods", "Netflix"'
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">Assign to envelope</label>
            <select value={envelopeId} onChange={e => setEnvelopeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {envelopes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <input type="checkbox" id="matchCase" checked={matchCase} onChange={e => setMatchCase(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded" />
            <label htmlFor="matchCase" className="text-sm text-gray-600 whitespace-nowrap">Match case</label>
          </div>
          <button onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium whitespace-nowrap">
            Add Rule
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <div className="text-3xl mb-2">⚡</div>
          <p className="text-gray-500 text-sm">No rules yet. Add one above to auto-categorize transactions.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keyword</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Envelope</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Case</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rules.map(r => {
                const env = envelopes.find(e => e.id === r.envelopeId);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-900">"{r.keyword}"</td>
                    <td className="px-4 py-3">
                      {env ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: env.color }} />
                          {env.name}
                        </span>
                      ) : <span className="text-red-400 italic">Deleted envelope</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.matchCase ? 'Sensitive' : 'Insensitive'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-800 text-xs font-medium">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
        <strong>How rules work:</strong> When you add a new expense, its description is checked against all rules in order.
        The first matching rule wins. Rules only apply to expenses (negative amounts) without an already-assigned envelope.
      </div>
    </div>
  );
}
