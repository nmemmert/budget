'use client';

import { useState } from 'react';

interface SharedAccountManagerProps {
  userId: string;
  accountId: string;
  accountName: string;
}

export default function SharedAccountManager({ userId, accountId, accountName }: SharedAccountManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'view' | 'edit'>('view');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sharedUsers, setSharedUsers] = useState<Array<{ email: string; role: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleShareAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch('/api/share/account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ accountId, email: shareEmail, role: shareRole }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to share account');
      }

      setMessage({ type: 'success', text: `Account shared with ${shareEmail}` });
      setShareEmail('');
      setSharedUsers([...sharedUsers, { email: shareEmail, role: shareRole }]);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to share account',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex justify-between items-center w-full font-semibold text-gray-900 hover:text-gray-700"
      >
        <span>👥 Share Account</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <form onSubmit={handleShareAccount} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permission Level
              </label>
              <select
                value={shareRole}
                onChange={(e) => setShareRole(e.target.value as 'view' | 'edit')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
              >
                <option value="view">View Only</option>
                <option value="edit">Can Edit</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || !shareEmail}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sharing...' : 'Share Account'}
            </button>
          </form>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          {sharedUsers.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-900 mb-2">Shared With:</p>
              <ul className="space-y-2">
                {sharedUsers.map((user) => (
                  <li key={user.email} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{user.email}</span>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded capitalize">
                      {user.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
            💡 <strong>Note:</strong> Shared accounts will appear in the recipient's Capsule app. They can view or edit based on the permissions you set.
          </p>
        </div>
      )}
    </div>
  );
}
