
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

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-gray-900 selection:text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
            <ShirtIcon className="w-8 h-8 text-gray-900" />
            <span className="text-xl font-serif font-bold tracking-tight">Fit Check SaaS</span>
        </div>
        <div className="flex items-center gap-4">
            <button onClick={onLogin} className="text-sm font-semibold hover:text-gray-600 transition-colors">
                Log In
            </button>
            <button onClick={onGetStarted} className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition-transform active:scale-95">
                Get Started
            </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 px-6">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1 space-y-8 text-center lg:text-left">
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-6xl md:text-7xl font-serif font-bold leading-[1.1]"
                >
                    Try before you <br className="hidden lg:block"/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">buy, virtually.</span>
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    className="text-xl text-gray-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
                >
                    Upload a photo, choose a garment, and see the magic happen. The most advanced AI virtual try-on technology, now available for everyone.
                </motion.p>
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="flex items-center justify-center lg:justify-start gap-4"
                >
                    <button onClick={onGetStarted} className="bg-gray-900 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-800 transition-all hover:shadow-lg hover:-translate-y-1">
                        Start Your Free Trial
                    </button>
                    <button onClick={onGetStarted} className="px-8 py-4 rounded-full text-lg font-semibold border border-gray-200 hover:border-gray-900 transition-colors">
                        View Demo
                    </button>
                </motion.div>
                <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-sm text-gray-500">
                    <span className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-green-600"/> No credit card required</span>
                    <span className="flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-green-600"/> 4K Ultra-Realistic</span>
                </div>
            </div>
            
            {/* Visual Demo */}
            <div className="flex-1 w-full max-w-md lg:max-w-full flex justify-center">
                 <div className="relative p-4 bg-gray-100 rounded-[2rem] shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                     <Compare
                        firstImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon.jpg"
                        secondImage="https://storage.googleapis.com/gemini-95-icons/asr-tryon-model.png"
                        slideMode="drag"
                        className="w-[300px] h-[450px] sm:w-[350px] sm:h-[525px] rounded-2xl bg-gray-200"
                      />
                      <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-xl shadow-lg border border-gray-100 animate-bounce">
                          <p className="font-serif font-bold text-lg">AI Generated ✨</p>
                      </div>
                 </div>
            </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-gray-50">
          <div className="max-w-7xl mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-4xl font-serif font-bold mb-4">Simple, Transparent Pricing</h2>
                  <p className="text-gray-600">One plan, everything included. Cancel anytime.</p>
              </div>

              <div className="max-w-md mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200">
                  <div className="p-8 sm:p-12">
                      <h3 className="text-2xl font-bold text-gray-900">Pro Creator</h3>
                      <div className="mt-6 flex items-baseline">
                          <span className="text-5xl font-bold tracking-tight text-gray-900">$4.99</span>
                          <span className="ml-2 text-xl font-medium text-gray-500">/month</span>
                      </div>
                      <p className="mt-4 text-gray-600">Perfect for fashion enthusiasts, content creators, and shoppers.</p>
                      
                      <ul className="mt-8 space-y-4">
                          {[
                              "Unlimited Virtual Try-Ons",
                              "High-Resolution Downloads",
                              "Custom Wardrobe Storage",
                              "Advanced Pose Variations",
                              "Priority Support",
                              "Commercial Usage Rights"
                          ].map((feature) => (
                              <li key={feature} className="flex items-start">
                                  <CheckCircleIcon className="w-5 h-5 text-gray-900 flex-shrink-0 mr-3" />
                                  <span className="text-gray-600">{feature}</span>
                              </li>
                          ))}
                      </ul>

                      <button 
                        onClick={onGetStarted}
                        className="mt-10 w-full bg-gray-900 text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
                      >
                          Get Started Now
                      </button>
                      <p className="mt-4 text-xs text-center text-gray-400">Secure payment via PayPal</p>
                  </div>
              </div>
          </div>
      </section>

      <footer className="bg-gray-900 text-white py-12 px-6 border-t border-gray-800">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-2">
                  <ShirtIcon className="w-6 h-6 text-gray-400" />
                  <span className="font-serif font-bold">Fit Check SaaS</span>
              </div>
              <p className="text-gray-500 text-sm">© 2024 Fit Check SaaS. All rights reserved.</p>
          </div>
      </footer>
    </div>
  );
};

export default LandingPage;
