'use client';

import { useEffect, useState } from 'react';
import { AuthService } from '../lib/authService';

interface SharedUser {
  shareId: string;
  email: string;
  role: string;
}

interface SharedAccountManagerProps {
  accountId: string;
  accountName: string;
}

export default function SharedAccountManager({ accountId, accountName }: SharedAccountManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'view' | 'edit'>('view');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setLoadingShares(true);
    const token = AuthService.getSessionToken();
    fetch('/api/share/list', { headers: { 'x-session-token': token ?? '' } })
      .then(r => r.json())
      .then(data => {
        const forThisAccount: SharedUser[] = (data.owned ?? [])
          .filter((s: any) => s.accountId === accountId)
          .map((s: any) => ({ shareId: s.shareId, email: s.targetEmail, role: s.role }));
        setSharedUsers(forThisAccount);
      })
      .catch(() => {})
      .finally(() => setLoadingShares(false));
  }, [expanded, accountId]);

  const handleShareAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const token = AuthService.getSessionToken();
      const response = await fetch('/api/share/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token ?? '' },
        body: JSON.stringify({ accountId, email: shareEmail, role: shareRole }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to share account');

      setMessage({ type: 'success', text: `Account shared with ${shareEmail}` });
      setSharedUsers(prev => [...prev, { shareId: result.shareId, email: shareEmail, role: shareRole }]);
      setShareEmail('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to share account' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (shareId: string) => {
    if (!confirm('Remove this person\'s access?')) return;
    try {
      const token = AuthService.getSessionToken();
      const response = await fetch('/api/share/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token ?? '' },
        body: JSON.stringify({ shareId }),
      });
      if (!response.ok) throw new Error('Failed to revoke');
      setSharedUsers(prev => prev.filter(u => u.shareId !== shareId));
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove access' });
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex justify-between items-center w-full font-semibold text-gray-900 hover:text-gray-700 text-sm"
      >
        <span>👥 Share "{accountName}"</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <form onSubmit={handleShareAccount} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
                placeholder="user@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Permission</label>
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value as 'view' | 'edit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
              >
                <option value="view">View Only</option>
                <option value="edit">Can Edit</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !shareEmail}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              {loading ? 'Sharing…' : 'Share Account'}
            </button>
          </form>

          {message && (
            <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {message.text}
            </div>
          )}

          {loadingShares ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : sharedUsers.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Shared with:</p>
              <ul className="space-y-2">
                {sharedUsers.map((u) => (
                  <li key={u.shareId} className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded">
                    <div>
                      <span className="text-gray-800">{u.email}</span>
                      <span className="ml-2 text-xs bg-gray-200 px-1.5 py-0.5 rounded capitalize">{u.role}</span>
                    </div>
                    <button onClick={() => handleRevoke(u.shareId)} className="text-xs text-red-600 hover:text-red-800">Remove</button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Not shared with anyone yet.</p>
          )}

          <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            The recipient must already have a Capsule account. They'll see this account in their "Shared with me" section.
          </p>
        </div>
      )}
    </div>
  );
}
