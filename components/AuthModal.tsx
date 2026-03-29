
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XIcon } from './icons';
import Spinner from './Spinner';
import { db } from '../lib/db';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  initialMode?: 'login' | 'signup';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, initialMode = 'login' }) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
        let user;
        if (mode === 'login') {
            user = await db.login(email);
        } else {
            if (!name) throw new Error('Name is required');
            user = await db.signup(email, name);
        }
        onSuccess(user);
    } catch (err: any) {
        setError(err.message || 'Authentication failed');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                <h3 className="text-2xl font-serif font-bold text-gray-900">
                    {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                </h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                    <XIcon className="w-6 h-6" />
                </button>
            </div>
            
            <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}
                    
                    {mode === 'signup' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input 
                                type="text" 
                                required 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                                placeholder="John Doe"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <input 
                            type="email" 
                            required 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition-all"
                            placeholder="you@example.com"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-70"
                    >
                        {isLoading ? <Spinner /> : (mode === 'login' ? 'Log In' : 'Sign Up')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    {mode === 'login' ? (
                        <p>Don't have an account? <button onClick={() => setMode('signup')} className="font-bold text-gray-900 hover:underline">Sign up</button></p>
                    ) : (
                        <p>Already have an account? <button onClick={() => setMode('login')} className="font-bold text-gray-900 hover:underline">Log in</button></p>
                    )}
                </div>
                
                {/* Mock Note */}
                <div className="mt-8 pt-6 border-t border-gray-100 text-xs text-gray-400 text-center">
                    <p>Demo Mode: You can use any email. Try "user@example.com"</p>
                </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
