'use client';

import { useState, useEffect } from 'react';
import { AuthService } from '../lib/authService';
import { DataService } from '../lib/dataService';

interface SettingsProps {
  user: { userId: string; email: string };
  onAccountDeleted: () => void;
}

export default function Settings({ user, onAccountDeleted }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'password' | 'export' | 'delete'>('password');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [clearDataInput, setClearDataInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFASetupData, setTwoFASetupData] = useState<{ secret: string; qrDataUrl: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const [twoFAMessage, setTwoFAMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const token = AuthService.getSessionToken();
    if (!token) return;
    fetch('/api/auth/2fa/status', { headers: { 'x-session-token': token } })
      .then(r => r.json())
      .then(d => setTwoFAEnabled(d.enabled ?? false))
      .catch(() => {});
  }, []);

  const handleSetup2FA = async () => {
    setTwoFALoading(true);
    setTwoFAMessage(null);
    try {
      const token = AuthService.getSessionToken();
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST', headers: { 'x-session-token': token ?? '' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTwoFASetupData({ secret: data.secret, qrDataUrl: data.qrDataUrl });
      setTwoFACode('');
    } catch (e: any) {
      setTwoFAMessage({ type: 'error', text: e.message });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFALoading(true);
    setTwoFAMessage(null);
    try {
      const token = AuthService.getSessionToken();
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token ?? '' },
        body: JSON.stringify({ code: twoFACode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTwoFAEnabled(true);
      setTwoFASetupData(null);
      setTwoFACode('');
      setTwoFAMessage({ type: 'success', text: '2FA enabled successfully!' });
    } catch (e: any) {
      setTwoFAMessage({ type: 'error', text: e.message });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFALoading(true);
    setTwoFAMessage(null);
    try {
      const token = AuthService.getSessionToken();
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token ?? '' },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTwoFAEnabled(false);
      setDisableCode('');
      setTwoFAMessage({ type: 'success', text: '2FA disabled.' });
    } catch (e: any) {
      setTwoFAMessage({ type: 'error', text: e.message });
    } finally {
      setTwoFALoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    setLoading(true);
    try {
      // Verify current password by attempting login
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: currentPassword }),
      });
      if (!loginRes.ok) {
        setMessage({ type: 'error', text: 'Current password is incorrect.' });
        return;
      }
      // Generate a reset token and use it to set the new password
      const tokenRes = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: user.email }),
      });
      if (!tokenRes.ok) throw new Error('Failed to initiate password change');
      const { token } = await tokenRes.json();
      const resetRes = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', token, newPassword }),
      });
      if (!resetRes.ok) {
        const err = await resetRes.json();
        throw new Error(err.error || 'Password change failed');
      }
      setMessage({ type: 'success', text: 'Password changed successfully! Signing out...' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => AuthService.signOut(), 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Password change failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      const userData = await DataService.loadUserData();
      if (!userData) throw new Error('No data to export');

      let content: string;
      let filename: string;

      if (format === 'json') {
        content = JSON.stringify(userData, null, 2);
        filename = `capsule-backup-${new Date().toISOString().split('T')[0]}.json`;
      } else {
        // CSV export for transactions
        const rows = [['Date', 'Description', 'Amount', 'Type', 'Account']];
        userData.transactions?.forEach((t: any) => {
          rows.push([
            new Date(t.date).toLocaleDateString(),
            t.description,
            Math.abs(t.amount).toString(),
            t.amount < 0 ? 'Expense' : 'Income',
            userData.accounts?.find((a: any) => a.id === t.accountId)?.name || 'Unknown',
          ]);
        });

        content = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        filename = `capsule-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      }

      const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Data exported successfully as ${format.toUpperCase()}` });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Export failed',
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE' || !showDeleteConfirm) return;

    setLoading(true);
    try {
      const token = AuthService.getSessionToken();
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': token ?? '',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Account deletion failed');
      }

      setMessage({ type: 'success', text: 'Account deleted successfully. Signing out...' });
      setTimeout(async () => {
        await AuthService.signOut();
        onAccountDeleted();
      }, 2000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Account deletion failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    if (clearDataInput !== 'CLEAR ALL' || !showClearDataConfirm) return;

    setLoading(true);
    try {
      await DataService.saveUserData({
        accounts: [],
        envelopes: [],
        transactions: [],
        setupCompleted: false,
      });

      setMessage({ type: 'success', text: 'All data cleared successfully. Reloading app...' });
      setClearDataInput('');
      setShowClearDataConfirm(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to clear data',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8" aria-label="Settings tabs">
          {[
            { id: 'password', label: 'Password & Security' },
            { id: 'export', label: 'Data & Export' },
            { id: 'delete', label: 'Account' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setMessage(null);
              }}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <div className="space-y-6 max-w-md">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Change Password</h3>
          <p className="text-sm text-gray-500 mb-4">Signed in as <strong>{user.email}</strong></p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder="••••••••" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder="Min. 8 characters" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-opacity">
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* 2FA Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {twoFAEnabled ? '🔐 2FA is enabled — your account is protected.' : 'Add an extra layer of security with an authenticator app.'}
              </p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${twoFAEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {twoFAEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          {twoFAMessage && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${twoFAMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {twoFAMessage.text}
            </div>
          )}

          {!twoFAEnabled && !twoFASetupData && (
            <button onClick={handleSetup2FA} disabled={twoFALoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-opacity text-sm">
              {twoFALoading ? 'Generating…' : 'Enable 2FA'}
            </button>
          )}

          {!twoFAEnabled && twoFASetupData && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700">Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app:</p>
              <div className="flex justify-center">
                <img src={twoFASetupData.qrDataUrl} alt="2FA QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                <code className="block bg-gray-100 px-3 py-2 rounded text-sm font-mono break-all text-gray-800 select-all">{twoFASetupData.secret}</code>
              </div>
              <form onSubmit={handleVerify2FA} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enter the 6-digit code to confirm</label>
                  <input type="text" inputMode="numeric"
                    value={twoFACode}
                    onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    required />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setTwoFASetupData(null); setTwoFACode(''); }}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 text-sm">Cancel</button>
                  <button type="submit" disabled={twoFALoading || twoFACode.length !== 6}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm">
                    {twoFALoading ? 'Verifying…' : 'Verify & Enable'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {twoFAEnabled && (
            <form onSubmit={handleDisable2FA} className="space-y-3">
              <p className="text-sm text-gray-600">Enter your current 2FA code to disable:</p>
              <input type="text" inputMode="numeric"
                value={disableCode}
                onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-red-400 bg-white text-gray-900"
                required />
              <button type="submit" disabled={twoFALoading || disableCode.length !== 6}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 text-sm">
                {twoFALoading ? 'Disabling…' : 'Disable 2FA'}
              </button>
            </form>
          )}
        </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Your Data</h3>
            <p className="text-gray-600 mb-4">
              Download a backup of your budget data in your preferred format.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleExportData('json')}
                className="w-full text-white py-3 px-4 rounded-md hover:opacity-90 transition-opacity text-left flex justify-between items-center"
                style={{ backgroundColor: 'var(--color-finance-green)' }}
              >
                <span>📋 Export as JSON (Full Backup)</span>
                <span className="text-sm">Recommended</span>
              </button>
              <button
                onClick={() => handleExportData('csv')}
                className="w-full text-white py-3 px-4 rounded-md hover:opacity-90 transition-opacity text-left"
                style={{ backgroundColor: 'var(--color-primary-blue)' }}
              >
                📊 Export Transactions as CSV
              </button>
            </div>

            <div className="mt-6 p-4 rounded-md border" style={{ backgroundColor: 'rgba(30, 115, 190, 0.05)', borderColor: 'var(--color-cloud-blue)' }}>
              <p className="text-sm" style={{ color: 'var(--color-primary-blue)' }}>
                <strong>💡 Tip:</strong> Regularly export your data as a backup. You can import it later if needed.
              </p>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-900 mb-4">⚠️ Clear All Data</h3>

            {!showClearDataConfirm ? (
              <div className="space-y-4">
                <p className="text-sm text-orange-800">
                  This will delete all your accounts, envelopes, and transactions, but your account will remain active. You can set up new data after clearing.
                </p>
                <button
                  onClick={() => setShowClearDataConfirm(true)}
                  className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 transition-colors"
                >
                  I understand, Clear All Data
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-orange-100 border border-orange-300 rounded-md p-3">
                  <p className="text-sm font-medium text-orange-900 mb-2">
                    To confirm clearing all data, type "<strong>CLEAR ALL</strong>" below:
                  </p>
                  <input
                    type="text"
                    value={clearDataInput}
                    onChange={(e) => setClearDataInput(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-gray-900"
                    placeholder="Type CLEAR ALL"
                    autoFocus
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowClearDataConfirm(false);
                      setClearDataInput('');
                    }}
                    className="flex-1 bg-gray-200 text-gray-900 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearData}
                    disabled={clearDataInput !== 'CLEAR ALL' || loading}
                    className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Clearing...' : 'Clear All Data'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Tab */}
      {activeTab === 'delete' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-red-900 mb-4">⚠️ Delete Account</h3>

          {!showDeleteConfirm ? (
            <div className="space-y-4">
              <p className="text-sm text-red-800">
                Deleting your account is permanent and cannot be undone. All your budget data, transactions, and envelopes will be permanently deleted.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
              >
                I understand, Delete My Account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-100 border border-red-300 rounded-md p-3">
                <p className="text-sm font-medium text-red-900 mb-2">
                  To confirm deletion, type "<strong>DELETE</strong>" below:
                </p>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-white text-gray-900"
                  placeholder="Type DELETE"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteInput('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-900 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteInput !== 'DELETE' || loading}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Deleting...' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
