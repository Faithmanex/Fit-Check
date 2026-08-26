
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState } from 'react';
import Modal from './ui/Modal';
import Spinner from './Spinner';
import { db } from '../lib/db';
import { User } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
  initialMode?: 'login' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep internal mode in sync when opened from different entry points
  React.useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

  const errorId = 'auth-error-message';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
        let user: User;
        if (mode === 'login') {
            user = await db.login(email.trim());
        } else {
            if (!name.trim()) throw new Error('Name is required');
            user = await db.signup(email.trim(), name.trim());
        }
        onSuccess(user);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        setError(
          message === 'User not found'
            ? 'No account exists for that email yet. Create one below.'
            : message === 'Email already exists'
              ? 'That email is already registered — try logging in instead.'
              : message
        );
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'login' ? 'Welcome Back' : 'Create Account'}
      description={mode === 'login' ? 'Log in to access your studio.' : 'Sign up free and start trying on looks.'}
      size="md"
    >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div aria-live="assertive">
                {error && (
                    <div id={errorId} role="alert" className="bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 p-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}
            </div>

            {mode === 'signup' && (
                <div>
                    <label htmlFor="auth-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Full Name
                    </label>
                    <input
                        id="auth-name"
                        type="text"
                        required
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-invalid={!!error && !name}
                        data-autofocus
                        className="w-full min-h-[44px] px-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-900 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
                        placeholder="John Doe"
                    />
                </div>
            )}

            <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                    Email Address
                </label>
                <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!error && !!email}
                    aria-describedby={error ? errorId : undefined}
                    {...(mode === 'login' ? { 'data-autofocus': true } : {})}
                    className="w-full min-h-[44px] px-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-gray-900 dark:focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
                    placeholder="you@example.com"
                />
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full min-h-[44px] bg-gray-900 dark:bg-indigo-500 text-white py-2.5 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-indigo-400 transition-colors flex items-center justify-center disabled:opacity-70"
            >
                {isLoading ? <Spinner /> : (mode === 'login' ? 'Log In' : 'Sign Up')}
            </button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-600 dark:text-gray-300">
            {mode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(null); }} className="font-bold text-gray-900 dark:text-indigo-300 hover:underline">
                    Sign up
                  </button>
                </p>
            ) : (
                <p>
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(null); }} className="font-bold text-gray-900 dark:text-indigo-300 hover:underline">
                    Log in
                  </button>
                </p>
            )}
        </div>

        {/* Demo note */}
        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 text-center">
            <p>Demo Mode: You can use any email. Try "user@example.com"</p>
        </div>
    </Modal>
  );
};

export default AuthModal;
