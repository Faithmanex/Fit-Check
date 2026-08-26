
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ShirtIcon, CheckCircleIcon } from './icons';
import { Compare } from './ui/compare';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

const FEATURES = [
    "Unlimited Virtual Try-Ons",
    "Full-Quality Downloads",
    "Custom Wardrobe Storage",
    "Advanced Pose Variations",
    "AI Colorway Studio",
    "My Looks History & Favorites"
];

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const handleViewDemo = () => {
    const demo = document.getElementById('landing-demo');
    if (!demo) return;
    demo.scrollIntoView({ block: 'center' }); // CSS honors prefers-reduced-motion
    demo.focus({ preventScroll: true });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0b0d12] dark:text-gray-100 text-gray-900 font-sans selection:bg-gray-900 selection:text-white">
      <a href="#landing-main" className="skip-link">Skip to main content</a>

      {/* Navbar */}
      <nav aria-label="Main navigation" className="flex items-center justify-between p-5 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
            <ShirtIcon className="w-8 h-8 text-gray-900 dark:text-white" aria-hidden="true" />
            <span className="text-xl font-serif font-bold tracking-tight">Fit Check</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={onLogin} className="min-h-[44px] px-4 text-sm font-semibold hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg focus-visible:ring-2">
                Log In
            </button>
            <button onClick={onGetStarted} className="bg-gray-900 dark:bg-indigo-500 text-white px-5 py-2.5 min-h-[44px] rounded-full text-sm font-semibold hover:bg-gray-800 dark:hover:bg-indigo-400 transition-transform active:scale-95">
                Get Started
            </button>
        </div>
      </nav>

      {/* Hero */}
      <main id="landing-main" tabIndex={-1} className="focus:outline-none">
      <section className="pt-16 pb-32 px-6" aria-labelledby="hero-heading">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8 text-center lg:text-left">
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    id="hero-heading"
                    className="text-6xl md:text-7xl font-serif font-bold leading-[1.1]"
                >
                    Try before you <br className="hidden lg:block"/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">buy, virtually.</span>
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
                >
                    Upload a photo, choose a garment, and see the magic happen. The most advanced AI virtual try-on technology, now available for everyone.
                </motion.p>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-wrap items-center justify-center lg:justify-start gap-4"
                >
                    <button onClick={onGetStarted} className="bg-gray-900 dark:bg-indigo-500 text-white px-8 py-3 min-h-[48px] rounded-full text-lg font-semibold hover:bg-gray-800 dark:hover:bg-indigo-400 transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0">
                        Start Your Free Trial
                    </button>
                    <button onClick={handleViewDemo} className="px-8 py-3 min-h-[48px] rounded-full text-lg font-semibold border border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-300 transition-colors">
                        View Demo
                    </button>
                </motion.div>
                <ul className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400 list-none p-0 m-0">
                    <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-green-600" aria-hidden="true"/> No credit card required</li>
                    <li className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-green-600" aria-hidden="true"/> AI-generated previews in seconds</li>
                </ul>
            </div>

            {/* Visual Demo */}
            <div className="flex-1 w-full max-w-md lg:max-w-full flex justify-center">
                 <figure
                    id="landing-demo"
                    tabIndex={-1}
                    className="relative p-4 bg-gray-100 dark:bg-gray-900 rounded-[2rem] shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-200 focus:outline-none"
                 >
                      <Compare
                        firstImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg"
                        secondImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon-model.png"
                        firstLabel="Original outfit"
                        secondLabel="AI try-on result"
                        sliderLabel="Demo comparison slider. Use the Left and Right arrow keys to move the divider, or drag with mouse or touch."
                        slideMode="drag"
                        className="w-[300px] h-[450px] sm:w-[350px] sm:h-[525px] rounded-2xl bg-gray-200 dark:bg-gray-800"
                      />
                      <figcaption className="absolute -bottom-6 -right-6 bg-white dark:bg-gray-900 p-3 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800 flex items-center gap-1.5">
                          <span aria-hidden="true">✨</span> <p className="font-serif font-bold">AI Generated</p>
                      </figcaption>
                 </figure>
            </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-gray-50 dark:bg-gray-950/60" aria-labelledby="pricing-heading">
          <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 id="pricing-heading" className="text-4xl font-serif font-bold mb-4">Simple, Transparent Pricing</h2>
                  <p className="text-gray-600 dark:text-gray-400">One plan, everything included. Cancel anytime.</p>
              </div>

              <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-800">
                  <div className="p-8 sm:p-12">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Pro Creator</h3>
                      <div className="mt-6 flex items-baseline">
                          <span className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">$4.99</span>
                          <span className="ml-2 text-xl font-medium text-gray-500 dark:text-gray-400">/month</span>
                      </div>
                      <p className="mt-4 text-gray-600 dark:text-gray-300">Perfect for fashion enthusiasts, content creators, and shoppers.</p>

                      <ul className="mt-8 space-y-4 list-none p-0 m-0">
                          {FEATURES.map((feature) => (
                              <li key={feature} className="flex items-start">
                                  <CheckCircleIcon className="w-5 h-5 text-gray-900 dark:text-indigo-400 flex-shrink-0 mr-3 mt-0.5" aria-hidden="true" />
                                  <span className="text-gray-600 dark:text-gray-300">{feature}</span>
                              </li>
                          ))}
                      </ul>

                      <button
                        onClick={onGetStarted}
                        className="mt-10 w-full min-h-[48px] bg-gray-900 dark:bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-indigo-400 transition-colors shadow-lg"
                      >
                          Get Started Now
                      </button>
                      <p className="mt-4 text-xs text-center text-gray-400">Secure payment via PayPal · Cancel anytime</p>
                  </div>
              </div>
          </div>
      </section>
      </main>

      <footer className="bg-gray-900 dark:bg-black text-white py-12 px-6 border-t border-gray-800">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                  <ShirtIcon className="w-6 h-6 text-gray-400" aria-hidden="true" />
                  <span className="font-serif font-bold">Fit Check</span>
              </div>
              <p className="text-gray-400 text-sm">© {new Date().getFullYear()} Fit Check. All rights reserved.</p>
          </div>
      </footer>
    </div>
  );
};

export default LandingPage;
