
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { PayPalButtons } from '@paypal/react-paypal-js';
import { db } from './lib/db';
import { User } from './types';
import { applyThemeToDocument, getTheme } from './lib/theme';
import LandingPage from './components/LandingPage';
import AuthModal from './components/AuthModal';
import Dashboard from './components/Dashboard';
import VirtualTryOn from './components/VirtualTryOn';
import Modal from './components/ui/Modal';
import { ToastProvider, useToast } from './components/ui/Toast';
import { CheckCircleIcon } from './components/icons';
import Spinner from './components/Spinner';

type ViewState = 'landing' | 'dashboard' | 'app';

/** Theme bootstrap + sync across screens. */
const useThemeInit = (): void => {
  useEffect(() => {
    applyThemeToDocument(getTheme());
  }, []);
};

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('landing');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Look handed over from the Dashboard gallery into the studio ("Use as model")
  const [pendingModelUrl, setPendingModelUrl] = useState<string | null>(null);

  const toast = useToast();
  useThemeInit();

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
        try {
            const currentUser = await db.getCurrentUser();
            if (currentUser) {
                setUser(currentUser);
                setCurrentView('dashboard');
            }
        } catch (e) {
            console.error('Session restore failed', e);
        }
    };
    checkSession();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    setShowAuthModal(false);
    setCurrentView('dashboard');
    toast.success(`Welcome back, ${loggedInUser.name}!`);
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
      setCurrentView('app');
  };

  const handleUseLookAsModel = (lookUrl: string) => {
      setPendingModelUrl(lookUrl);
      setCurrentView('app');
  };

  const handleApprove = async (_data: unknown, _actions: unknown) => {
    await handleUpgrade();
  };

  const handleCreateSubscription = (_data: unknown, actions: any) => {
      return actions.subscription.create({
          plan_id: import.meta.env.VITE_PAYPAL_PLAN_ID || 'P-XXXXXXXXXXXXXXXXXXXXXXXX'
      });
  };

  const handleUpgrade = async () => {
      if (!user) return;
      setIsProcessingPayment(true);
      try {
          const updatedUser = await db.upgradeSubscription(user.id);
          setUser(updatedUser);
          setShowPaymentModal(false);
          toast.success('Welcome to Pro — unlimited generations unlocked!');
      } catch (e) {
          console.error(e);
          toast.error('Upgrade could not be completed. Please try again.');
      } finally {
          setIsProcessingPayment(false);
      }
  };

  return (
    <div className="antialiased text-gray-900 dark:text-gray-100 bg-white dark:bg-[#0b0d12] min-h-screen">
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
              onUseLookAsModel={handleUseLookAsModel}
              onUpgrade={() => setShowPaymentModal(true)}
              onLogout={handleLogout}
            />
        )}

        {currentView === 'app' && user && (
            <VirtualTryOn
              key={pendingModelUrl ?? 'studio'}
              user={user}
              initialModelUrl={pendingModelUrl}
              onBack={async () => {
                  const updatedUser = await db.getCurrentUser();
                  if (updatedUser) setUser(updatedUser);
                  setPendingModelUrl(null);
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
        <Modal
          isOpen={showPaymentModal}
          onClose={() => {
              if (!isProcessingPayment) setShowPaymentModal(false);
          }}
          title="Upgrade to Pro"
          description="Unlimited generations, full-quality downloads and more."
          size="md"
        >
            <div className="mb-6">
                <div className="flex items-baseline mb-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">$4.99</span>
                    <span className="text-gray-500 ml-2">/month</span>
                </div>
                <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0"/> Unlimited Generations</li>
                    <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0"/> Full-Quality Downloads</li>
                    <li className="flex gap-2"><CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0"/> Support Indie Dev</li>
                </ul>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
                <p className="text-xs text-gray-500 mb-3 text-center">Secure checkout with PayPal · Cancel anytime</p>

                {isProcessingPayment ? (
                    <div className="flex flex-col items-center justify-center py-6" role="status">
                        <Spinner />
                        <p className="text-sm text-gray-500 mt-4">Processing payment…</p>
                    </div>
                ) : (
                    <PayPalButtons
                        createSubscription={handleCreateSubscription}
                        onApprove={handleApprove}
                        onError={(err) => {
                            console.error("PayPal Checkout Error", err);
                            toast.error('An error occurred during checkout. Please try again.');
                            setIsProcessingPayment(false);
                        }}
                        style={{ layout: "vertical", shape: "rect", color: "blue" }}
                    />
                )}
            </div>
        </Modal>
    </div>
  );
};

const App: React.FC = () => (
  <MotionConfig reducedMotion="user">
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  </MotionConfig>
);

export default App;
