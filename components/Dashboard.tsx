
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { User } from '../types';
import { ShirtIcon, CheckCircleIcon, HeartIcon, HomeIcon, LayoutGridIcon, CreditCardIcon, SettingsIcon, LogOutIcon, Trash2Icon, PlusIcon } from './icons';
import { db } from '../lib/db';

interface DashboardProps {
    user: User;
    onLaunchApp: () => void;
    onUpgrade: () => void;
    onLogout: () => void;
}

type DashboardView = 'home' | 'gallery' | 'billing' | 'settings';

const Dashboard: React.FC<DashboardProps> = ({ user: initialUser, onLaunchApp, onUpgrade, onLogout }) => {
    const [view, setView] = useState<DashboardView>('home');
    const [user, setUser] = useState(initialUser);

    const refreshUser = async () => {
        const u = await db.getCurrentUser();
        if (u) setUser(u);
    };

    const handleDeleteOutfit = async (outfitId: string) => {
        if (confirm('Are you sure you want to delete this outfit?')) {
            const updatedUser = await db.deleteOutfit(user.id, outfitId);
            setUser(updatedUser);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const updatedUser = await db.updateUser(user.id, { name });
        setUser(updatedUser);
        alert('Profile updated!');
    };

    // --- Sub-Components for Views ---

    const HomeView = () => (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-serif font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500">Welcome back, {user.name}.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg md:col-span-2 relative overflow-hidden">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2">Create New Look</h2>
                        <p className="text-indigo-100 mb-6 max-w-md">Try on any garment instantly with our AI model generator.</p>
                        <button onClick={onLaunchApp} className="bg-white text-indigo-900 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center gap-2">
                           <PlusIcon className="w-5 h-5"/> Start Designing
                        </button>
                    </div>
                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
                        <ShirtIcon className="w-64 h-64" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900">Subscription Status</h3>
                        <div className="mt-4 flex items-center gap-2">
                             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${user.plan === 'pro' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                {user.plan}
                            </span>
                        </div>
                    </div>
                    {user.plan === 'free' ? (
                        <button onClick={onUpgrade} className="mt-4 w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800">
                            Upgrade to Pro
                        </button>
                    ) : (
                        <p className="text-xs text-green-600 mt-2 font-medium">Auto-renew active</p>
                    )}
                </div>
            </div>

            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Recent Outfits</h2>
                    <button onClick={() => setView('gallery')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View All</button>
                </div>
                {user.savedOutfits && user.savedOutfits.length > 0 ? (
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {user.savedOutfits.slice(0, 4).map(outfit => (
                             <div key={outfit.id} className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 relative group">
                                <img src={outfit.imageUrl} className="w-full h-full object-cover" alt="Outfit" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <p className="text-white text-xs font-medium">{new Date(outfit.date).toLocaleDateString()}</p>
                                </div>
                             </div>
                        ))}
                     </div>
                ) : (
                    <div className="text-center py-10 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">No recent outfits.</p>
                    </div>
                )}
            </div>
        </div>
    );

    const GalleryView = () => (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-serif font-bold text-gray-900">My Gallery</h1>
                <p className="text-gray-500">All your saved creations.</p>
            </header>
            
            {user.savedOutfits && user.savedOutfits.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {user.savedOutfits.map((outfit) => (
                        <div key={outfit.id} className="group relative bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="aspect-[3/4] overflow-hidden bg-gray-100 relative">
                                <img src={outfit.imageUrl} alt="Saved outfit" className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => handleDeleteOutfit(outfit.id)}
                                    className="absolute top-2 right-2 p-2 bg-white/80 rounded-full text-red-500 hover:bg-white hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    title="Delete Outfit"
                                >
                                    <Trash2Icon className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-3">
                                <p className="text-xs text-gray-500 mb-1">{new Date(outfit.date).toLocaleDateString()}</p>
                                <p className="text-sm font-semibold text-gray-900 truncate" title={outfit.garmentNames.join(', ')}>
                                    {outfit.garmentNames.join(', ')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <HeartIcon className="w-8 h-8 text-gray-300" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No saved outfits yet</h3>
                    <p className="text-gray-500 mb-6">Start mixing and matching to build your collection.</p>
                    <button onClick={onLaunchApp} className="bg-gray-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                        Go to Studio
                    </button>
                </div>
            )}
        </div>
    );

    const BillingView = () => (
        <div className="space-y-6 max-w-4xl">
             <header>
                <h1 className="text-3xl font-serif font-bold text-gray-900">Billing & Plan</h1>
                <p className="text-gray-500">Manage your subscription and payment methods.</p>
            </header>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Current Plan</h3>
                        <p className="text-sm text-gray-500">{user.plan === 'free' ? 'Basic limited access' : 'Unlimited Pro Access'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide ${user.plan === 'pro' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {user.plan}
                    </span>
                </div>
                <div className="p-6 bg-gray-50">
                    {user.plan === 'free' ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-gray-900 mb-1">Upgrade to Pro</p>
                                <p className="text-sm text-gray-600">$4.99/month for unlimited generations.</p>
                            </div>
                            <button onClick={onUpgrade} className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-800">
                                Upgrade Now
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                             <div>
                                <p className="font-semibold text-gray-900 mb-1">Pro Plan Active</p>
                                <p className="text-sm text-gray-600">Next billing date: {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
                            </div>
                            <button className="text-red-600 text-sm font-medium hover:underline">Cancel Subscription</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Payment History</h3>
                <div className="space-y-4">
                    {user.plan === 'pro' && (
                        <div className="flex items-center justify-between py-3 border-b border-gray-100">
                            <div>
                                <p className="font-medium text-gray-900">Pro Monthly Subscription</p>
                                <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
                            </div>
                            <p className="font-bold text-gray-900">$4.99</p>
                        </div>
                    )}
                    <div className="text-center py-4 text-sm text-gray-400 italic">
                        {user.plan === 'pro' ? 'No prior history.' : 'No payment history available.'}
                    </div>
                </div>
            </div>
        </div>
    );

    const SettingsView = () => (
        <div className="space-y-6 max-w-2xl">
            <header>
                <h1 className="text-3xl font-serif font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500">Update your profile information.</p>
            </header>
            
            <form onSubmit={handleUpdateProfile} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-center gap-6">
                     <img src={user.avatar} alt="Avatar" className="w-20 h-20 rounded-full bg-gray-100" />
                     <div>
                         <button type="button" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Change Avatar</button>
                         <p className="text-xs text-gray-400 mt-1">Avatars are currently generated automatically.</p>
                     </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input 
                        name="name"
                        defaultValue={user.name} 
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input 
                        disabled 
                        defaultValue={user.email} 
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" 
                    />
                </div>
                
                <div className="pt-4">
                    <button type="submit" className="bg-gray-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );

    // --- Main Layout ---

    return (
        <div className="min-h-screen bg-gray-50 flex font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-20 hidden md:flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <ShirtIcon className="w-8 h-8 text-indigo-600" />
                        <span className="text-xl font-serif font-bold tracking-tight text-gray-900">Fit Check</span>
                    </div>
                </div>
                
                <nav className="flex-1 p-4 space-y-1">
                    <button 
                        onClick={() => setView('home')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${view === 'home' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <HomeIcon className="w-5 h-5" /> Home
                    </button>
                    <button 
                         onClick={() => setView('gallery')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${view === 'gallery' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <LayoutGridIcon className="w-5 h-5" /> Gallery
                    </button>
                    <button 
                         onClick={() => setView('billing')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${view === 'billing' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <CreditCardIcon className="w-5 h-5" /> Billing
                    </button>
                    <button 
                         onClick={() => setView('settings')}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${view === 'settings' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <SettingsIcon className="w-5 h-5" /> Settings
                    </button>
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-2 mb-4">
                        <img src={user.avatar} className="w-8 h-8 rounded-full bg-gray-100" alt="avatar" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-red-600 py-2">
                        <LogOutIcon className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Nav Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-20 flex items-center justify-between px-4">
                 <div className="flex items-center gap-2">
                    <ShirtIcon className="w-6 h-6 text-indigo-600" />
                    <span className="font-serif font-bold text-gray-900">Fit Check</span>
                </div>
                <button onClick={onLogout} className="text-sm text-gray-500">Sign Out</button>
            </div>
            
            {/* Bottom Mobile Tab Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-20 flex justify-around p-2 pb-safe">
                 <button onClick={() => setView('home')} className={`p-2 rounded-lg flex flex-col items-center ${view === 'home' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <HomeIcon className="w-6 h-6" />
                    <span className="text-[10px] mt-1">Home</span>
                 </button>
                 <button onClick={() => setView('gallery')} className={`p-2 rounded-lg flex flex-col items-center ${view === 'gallery' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <LayoutGridIcon className="w-6 h-6" />
                    <span className="text-[10px] mt-1">Gallery</span>
                 </button>
                  <button onClick={() => setView('billing')} className={`p-2 rounded-lg flex flex-col items-center ${view === 'billing' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <CreditCardIcon className="w-6 h-6" />
                    <span className="text-[10px] mt-1">Plan</span>
                 </button>
                 <button onClick={() => setView('settings')} className={`p-2 rounded-lg flex flex-col items-center ${view === 'settings' ? 'text-indigo-600' : 'text-gray-400'}`}>
                    <SettingsIcon className="w-6 h-6" />
                    <span className="text-[10px] mt-1">Settings</span>
                 </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 md:ml-64 p-6 pt-24 md:pt-10 pb-24 md:pb-10 overflow-y-auto">
                <div className="max-w-6xl mx-auto">
                    {view === 'home' && <HomeView />}
                    {view === 'gallery' && <GalleryView />}
                    {view === 'billing' && <BillingView />}
                    {view === 'settings' && <SettingsView />}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
