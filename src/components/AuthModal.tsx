'use client';

import { useState } from 'react';
import { AuthService } from '../lib/authService';
import { DataService } from '../lib/dataService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 2FA step
  const [totpStep, setTotpStep] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const user = await AuthService.signIn(email, password);
        DataService.setUserId(user.userId);
        onAuthSuccess();
        onClose();
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        const user = await AuthService.signUp(email, password);
        DataService.setUserId(user.userId);
        onAuthSuccess();
        onClose();
      }
    } catch (err: any) {
      if (err.requiresTOTP) {
        setTempToken(err.tempToken);
        setTotpStep(true);
      } else {
        let msg = err.message;
        if (msg === 'Invalid credentials') msg = 'The email or password you entered is incorrect.';
        else if (msg === 'User already exists') msg = 'An account with this email already exists. Try signing in instead.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await AuthService.signInWithTOTP(tempToken, totpCode.trim());
      DataService.setUserId(user.userId);
      onAuthSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {totpStep ? 'Two-Factor Authentication' : isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {totpStep ? (
          <form onSubmit={handleTOTPSubmit} className="space-y-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              🔐 Enter the 6-digit code from your authenticator app.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Authentication Code</label>
              <input
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={loading || totpCode.length !== 6}
              className="w-full text-white py-2 px-4 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--color-primary-blue)' }}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button type="button" onClick={() => { setTotpStep(false); setTotpCode(''); setError(''); }}
              className="w-full text-gray-600 hover:text-gray-800 text-sm">
              ← Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required minLength={6} />
            </div>
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required minLength={6} />
              </div>
            )}
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full text-white py-2 px-4 rounded-md hover:opacity-90 focus:outline-none focus:ring-2 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: 'var(--color-primary-blue)' }}>
              {loading ? 'Please wait…' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        )}

        {!totpStep && (
          <div className="mt-4 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:text-blue-800 text-sm">
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
