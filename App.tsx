
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { db } from './lib/db';
import { User } from './types';
import LandingPage from './components/LandingPage';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard';
import VirtualTryOn from './components/VirtualTryOn';
import { CheckCircleIcon, XIcon } from './components/icons';

type ViewState = 'landing' | 'dashboard' | 'app';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
        const currentUser = await db.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
            setCurrentView('dashboard');
        }
    };
    checkSession();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setShowAuthModal(false);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    await db.logout();
    setUser(null);
    setCurrentView('landing');
  };

  const handleStartAuth = (mode: 'login' | 'signup') => {
    if (user) {
        setCurrentView('dashboard');
        return;
    }
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleLaunchApp = () => {
      // If user is free, check if they can access (simple gate)
      // For this demo, we allow access but the App component itself will gate features
      setCurrentView('app');
  };

  const handleUpgrade = async () => {
      setIsProcessingPayment(true);
      try {
          if (!user) return;
          const updatedUser = await db.upgradeSubscription(user.id);
          setUser(updatedUser);
          setShowPaymentModal(false);
          // Optional: Show success toast
      } catch (e) {
          console.error(e);
      } finally {
          setIsProcessingPayment(false);
      }
  };

  // Paypal Button Mock
  const PayPalButton = () => (
      <button 
        onClick={handleUpgrade}
        disabled={isProcessingPayment}
        className="w-full bg-[#0070BA] hover:bg-[#003087] text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        {isProcessingPayment ? (
            <span>Processing...</span>
        ) : (
            <>
                <span className="italic font-serif">Pay</span>
                <span className="font-bold">Pal</span>
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded text-sm">$4.99</span>
            </>
        )}
      </button>
  );

  return (
    <>
      <div className="antialiased text-gray-900 bg-white">
          {currentView === 'landing' && (
              <LandingPage 
                onGetStarted={() => handleStartAuth('signup')} 
                onLogin={() => handleStartAuth('login')}
              />
          )}

          {currentView === 'dashboard' && user && (
              <Dashboard 
                user={user}
                onLaunchApp={handleLaunchApp}
                onUpgrade={() => setShowPaymentModal(true)}
                onLogout={handleLogout}
              />
          )}

          {currentView === 'app' && user && (
              <VirtualTryOn 
                user={user}
                onBack={async () => {
                    // Refresh user data (e.g. for saved outfits) from DB before returning
                    const updatedUser = await db.getCurrentUser();
                    if (updatedUser) setUser(updatedUser);
                    setCurrentView('dashboard');
                }}
                onUpgradeRequired={() => setShowPaymentModal(true)}
              />
          )}

          {/* Global Auth Modal */}
          <AuthModal 
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={handleLogin}
            initialMode={authMode}
          />

          {/* Payment Modal */}
          <AnimatePresence>
              {showPaymentModal && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                  >
                      <motion.div 
                        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                        className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                      >
                          <div className="p-6 bg-gray-900 text-white flex justify-between items-center">
                              <h3 className="text-xl font-serif font-bold">Upgrade to Pro</h3>
                              <button onClick={() => setShowPaymentModal(false)}><XIcon className="w-6 h-6 text-gray-400 hover:text-white"/></button>
                          </div>
                          <div className="p-8">
                                <div className="mb-6">
                                    <div className="flex items-baseline mb-4">
                                        <span className="text-4xl font-bold text-gray-900">$4.99</span>
                                        <span className="text-gray-500 ml-2">/month</span>
                                    </div>
                                    <ul className="space-y-3 text-sm text-gray-600">
                                        <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-green-600"/> Unlimited Generations</li>
                                        <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-green-600"/> High Quality Downloads</li>
                                        <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-green-600"/> Support Indie Dev</li>
                                    </ul>
                                </div>
                                
                                <div className="border-t pt-6">
                                    <p className="text-xs text-gray-500 mb-3 text-center">Secure checkout with PayPal</p>
                                    <PayPalButton />
                                    <p className="text-[10px] text-gray-400 mt-4 text-center">
                                        This is a simulated transaction for the MVP. No real money will be charged.
                                    </p>
                                </div>
                          </div>
                      </motion.div>
                  </motion.div>
              )}
          </AnimatePresence>
      </div>
    </>
  );
};

export default App;
