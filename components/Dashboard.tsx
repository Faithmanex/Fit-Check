
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useCallback, useEffect, useState } from 'react';
import { User } from '../types';
import { LookEntry, LookPage } from '../types';
import { ShirtIcon, CheckCircleIcon, HeartIcon, HomeIcon, LayoutGridIcon, CreditCardIcon, SettingsIcon, LogOutIcon, Trash2Icon, PlusIcon, DownloadIcon, SparklesIcon, SunIcon, MoonIcon } from './icons';
import Pagination from './ui/Pagination';
import { ConfirmDialog } from './ui/Modal';
import { useToast } from './ui/Toast';
import { db } from '../lib/db';
import { downloadDataUrl, formatDateRelative } from '../lib/utils';
import { getTheme, setTheme, type Theme } from '../lib/theme';

const GALLERY_PAGE_SIZE = 12;

interface DashboardProps {
    user: User;
    onLaunchApp: () => void;
    /** Open the studio seeded with a saved look as the model image. */
    onUseLookAsModel: (lookUrl: string) => void;
    onUpgrade: () => void;
    onLogout: () => void;
}

type DashboardView = 'home' | 'gallery' | 'billing' | 'settings';

const Dashboard: React.FC<DashboardProps> = ({ user: initialUser, onLaunchApp, onUseLookAsModel, onUpgrade, onLogout }) => {
    const [view, setView] = useState<DashboardView>('home');
    const [user, setUser] = useState<User>(initialUser);
    const [looks, setLooks] = useState<LookPage>({ items: [], total: 0, page: 1, pageSize: GALLERY_PAGE_SIZE, totalPages: 1 });
    const [page, setPage] = useState(1);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [theme, setThemeState] = useState<Theme>(() => getTheme());
    const toast = useToast();

    useEffect(() => {
        document.title = `Fit Check — Dashboard`;
        return () => { document.title = 'Fit Check — AI Virtual Try-On'; };
    }, []);

    const refreshUser = useCallback(async () => {
        const u = await db.getCurrentUser();
        if (u) setUser(u);
    }, []);

    // Load paginated look history whenever page or view needs fresh data
    useEffect(() => {
        let disposed = false;
        (async () => {
            const result = await db.getLooksPage(user.id, page, GALLERY_PAGE_SIZE);
            if (!disposed) setLooks(result);
        })();
        return () => { disposed = true; };
    }, [user.id, page, view]);

    const handleDeleteOutfit = async () => {
        if (!pendingDeleteId) return;
        try {
            await db.deleteLook(user.id, pendingDeleteId);
            await refreshUser();
            const result = await db.getLooksPage(user.id, page, GALLERY_PAGE_SIZE);
            setLooks(result);
            toast.success('Look deleted');
        } catch (e) {
            console.error(e);
            toast.error('Could not delete that look.');
        } finally {
            setPendingDeleteId(null);
        }
    };

    const handleToggleFavorite = async (look: LookEntry) => {
        const updated = await db.setLookFavorite(user.id, look.id, !look.favorite);
        if (!updated) {
            toast.error('Could not update that favorite.');
            return;
        }
        setLooks(prev => ({
            ...prev,
            items: prev.items.map(l => (l.id === updated.id ? updated : l)),
        }));
    };

    const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = (formData.get('name') as string)?.trim();
        if (!name) {
            toast.error('Name cannot be empty.');
            return;
        }
        const updatedUser = await db.updateUser(user.id, { name });
        setUser(updatedUser);
        toast.success('Profile updated');
    };

    const handleToggleTheme = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        setThemeState(next);
    };

    const navItems: { id: DashboardView; label: string; icon: React.ReactNode }[] = [
        { id: 'home', label: 'Home', icon: <HomeIcon className="w-5 h-5" aria-hidden="true" /> },
        { id: 'gallery', label: 'My Looks', icon: <LayoutGridIcon className="w-5 h-5" aria-hidden="true" /> },
        { id: 'billing', label: 'Billing', icon: <CreditCardIcon className="w-5 h-5" aria-hidden="true" /> },
        { id: 'settings', label: 'Settings', icon: <SettingsIcon className="w-5 h-5" aria-hidden="true" /> },
    ];

    const pendingLook = looks.items.find(l => l.id === pendingDeleteId);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-[#0b0d12] flex font-sans">
            <a href="#dashboard-main" className="skip-link">Skip to main content</a>

            {/* Sidebar */}
            <aside aria-label="Dashboard navigation" className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 fixed inset-y-0 left-0 z-20 hidden md:flex flex-col">
                <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <ShirtIcon className="w-8 h-8 text-indigo-600" aria-hidden="true" />
                        <span className="text-xl font-serif font-bold tracking-tight text-gray-900 dark:text-white">Fit Check</span>
                    </div>
                </div>

                <nav aria-label="Primary" className="flex-1 p-4 space-y-1">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setView(item.id)}
                            aria-current={view === item.id ? 'page' : undefined}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 min-h-[44px] text-sm font-medium rounded-xl transition-colors duration-150 ${
                                view === item.id
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                        >
                            {item.icon} {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3 px-2 mb-4">
                        <img src={user.avatar} alt={`${user.name}'s avatar`} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 min-h-[44px] text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 transition-colors">
                        <LogOutIcon className="w-4 h-4" aria-hidden="true" /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Mobile Nav Header */}
            <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-20 flex items-center justify-between px-4">
                 <div className="flex items-center gap-2">
                    <ShirtIcon className="w-6 h-6 text-indigo-600" aria-hidden="true" />
                    <span className="font-serif font-bold text-gray-900 dark:text-white">Fit Check</span>
                 </div>
                 <div className="flex items-center gap-1">
                    <button onClick={handleToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} className="p-2.5 min-w-[44px] min-h-[44px] rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors">
                        {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={onLogout} className="px-3 min-h-[44px] text-sm text-gray-500 dark:text-gray-400">Sign Out</button>
                 </div>
            </header>

            {/* Bottom Mobile Tab Bar */}
            <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-20 flex justify-around p-1">
                 {navItems.map(item => (
                     <button
                        key={item.id}
                        type="button"
                        onClick={() => setView(item.id)}
                        aria-current={view === item.id ? 'page' : undefined}
                        className={`p-2 min-h-[48px] min-w-[64px] rounded-lg flex flex-col items-center justify-center transition-colors ${view === item.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}
                        aria-label={item.label}
                     >
                        {item.icon}
                        <span className="text-[10px] mt-0.5">{item.label}</span>
                     </button>
                 ))}
            </nav>

            {/* Main Content Area */}
            <main id="dashboard-main" tabIndex={-1} className="flex-1 md:ml-64 p-4 sm:p-6 pt-20 md:pt-8 pb-24 md:pb-10 md:pr-8 overflow-y-auto focus:outline-none">
                <div className="max-w-6xl mx-auto">
                    {view === 'home' && (
                        <div className="space-y-6">
                            <header>
                                <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-white">Welcome back, {user.name}.</h1>
                                <p className="text-gray-500 dark:text-gray-400">What are we styling today?</p>
                            </header>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white shadow-lg md:col-span-2 relative overflow-hidden">
                                    <div className="relative z-10">
                                        <h2 className="text-2xl font-bold mb-2">Create New Look</h2>
                                        <p className="text-indigo-100 mb-6 max-w-md">Try on any garment instantly with our AI model generator.</p>
                                        <button onClick={onLaunchApp} className="bg-white text-indigo-900 px-6 py-2.5 min-h-[44px] rounded-xl font-bold hover:bg-indigo-50 active:scale-95 transition-all inline-flex items-center gap-2">
                                           <PlusIcon className="w-5 h-5" aria-hidden="true" /> Start Designing
                                        </button>
                                    </div>
                                    <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4" aria-hidden="true">
                                        <ShirtIcon className="w-64 h-64" />
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Subscription</h3>
                                        <div className="mt-4 flex items-center gap-2">
                                             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${user.plan === 'pro' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                                                {user.plan}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{looks.total} look{looks.total === 1 ? '' : 's'} generated</span>
                                        </div>
                                    </div>
                                    {user.plan === 'free' ? (
                                        <button onClick={onUpgrade} className="mt-4 w-full min-h-[44px] bg-gray-900 dark:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-800 dark:hover:bg-indigo-400 transition-colors">
                                            Upgrade to Pro
                                        </button>
                                    ) : (
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">Auto-renew active</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Looks</h2>
                                    <button onClick={() => setView('gallery')} className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium min-h-[44px] px-2">
                                        View all ({looks.total})
                                    </button>
                                </div>
                                {looks.items.length > 0 ? (
                                     <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 list-none p-0 m-0">
                                         {looks.items.slice(0, 4).map(look => (
                                             <li key={look.id} className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 relative group border border-gray-200 dark:border-gray-800">
                                                <img src={look.imageUrl} alt={`Look wearing ${(look.garmentNames.slice(0, 3).join(', ') || 'base model').toLowerCase()}`} className="w-full h-full object-cover" loading="lazy" />
                                                {look.favorite && (
                                                    <span className="absolute top-2 left-2 inline-flex items-center bg-red-500/95 text-white text-[10px] font-semibold px-1.5 py-1 rounded-full" title="Favorited">
                                                        <HeartIcon className="w-3 h-3 fill-white" aria-hidden="true" />
                                                        <span className="sr-only">Favorited</span>
                                                    </span>
                                                )}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 flex items-end justify-center pb-2 pointer-events-none">
                                                    <p className="text-white text-xs font-medium">{formatDateRelative(look.timestamp)}</p>
                                                </div>
                                             </li>
                                         ))}
                                     </ul>
                                ) : (
                                    <div className="text-center py-10 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                        <HeartIcon className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" aria-hidden="true" />
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">No looks yet — your first try-on will appear here.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {view === 'gallery' && (
                        <div className="space-y-6">
                            <header>
                                <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-white">My Looks</h1>
                                <p className="text-gray-500 dark:text-gray-400">All your AI-generated try-ons.</p>
                            </header>

                            {looks.total > 0 ? (
                                <>
                                    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 list-none p-0 m-0">
                                        {looks.items.map((look) => (
                                            <li key={look.id} className="group relative bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow duration-150">
                                                <div className="aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                                                    <img src={look.imageUrl} alt={`Look wearing ${(look.garmentNames.slice(0, 3).join(', ') || 'base model').toLowerCase()}`} className="w-full h-full object-cover" loading="lazy" />

                                                    {look.favorite && (
                                                        <span className="absolute top-2 left-2 inline-flex items-center bg-red-500/95 text-white text-[10px] font-semibold px-1.5 py-1 rounded-full" title="Favorited">
                                                            <HeartIcon className="w-3 h-3 fill-white" aria-hidden="true" />
                                                            <span className="sr-only">Favorited</span>
                                                        </span>
                                                    )}

                                                    {/* Hover/focus action bar */}
                                                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100 transition-opacity duration-150">
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleToggleFavorite(look)}
                                                            aria-pressed={!!look.favorite}
                                                            aria-label={look.favorite ? 'Remove this look from favorites' : 'Add this look to favorites'}
                                                            title={look.favorite ? 'Remove from favorites' : 'Add to favorites'}
                                                            className={`p-2 min-w-[36px] min-h-[36px] bg-white/95 dark:bg-gray-800/95 rounded-full shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors ${
                                                                look.favorite ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'
                                                            }`}
                                                        >
                                                            <HeartIcon className={`w-4 h-4 ${look.favorite ? 'fill-red-500' : ''}`} aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onUseLookAsModel(look.imageUrl)}
                                                            title="Use as model"
                                                            aria-label="Continue styling this look"
                                                            className="p-2 min-w-[36px] min-h-[36px] bg-white/95 dark:bg-gray-800/95 rounded-full text-gray-700 dark:text-gray-200 shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                                        >
                                                            <SparklesIcon className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => downloadDataUrl(look.imageUrl, `fit-check-look-${new Date(look.timestamp).toISOString().slice(0, 10)}.png`)}
                                                            title="Download"
                                                            aria-label="Download this look"
                                                            className="p-2 min-w-[36px] min-h-[36px] bg-white/95 dark:bg-gray-800/95 rounded-full text-gray-700 dark:text-gray-200 shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                                        >
                                                            <DownloadIcon className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setPendingDeleteId(look.id)}
                                                            title="Delete"
                                                            aria-label="Delete this look"
                                                            className="p-2 min-w-[36px] min-h-[36px] bg-white/95 dark:bg-gray-800/95 rounded-full text-red-500 shadow-sm hover:bg-white dark:hover:bg-gray-700 transition-colors"
                                                        >
                                                            <Trash2Icon className="w-4 h-4" aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="p-3">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{formatDateRelative(look.timestamp)}</p>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" title={look.garmentNames.join(', ')}>
                                                        {look.garmentNames.join(', ')}
                                                    </p>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                    <Pagination
                                        label="My Looks pagination"
                                        variant="full"
                                        page={page}
                                        totalPages={looks.totalPages}
                                        totalItems={looks.total}
                                        pageSize={GALLERY_PAGE_SIZE}
                                        onPageChange={(next) => {
                                            setPage(next);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                    />
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                        <HeartIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" aria-hidden="true" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">No saved looks yet</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs text-center text-sm">Every outfit you generate is kept here automatically. Start mixing and matching!</p>
                                    <button onClick={onLaunchApp} className="bg-gray-900 dark:bg-indigo-500 text-white px-6 py-2.5 min-h-[44px] rounded-xl text-sm font-medium hover:bg-gray-800 dark:hover:bg-indigo-400 transition-colors">
                                        Go to Studio
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'billing' && (
                        <div className="space-y-6 max-w-4xl">
                             <header>
                                <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-white">Billing &amp; Plan</h1>
                                <p className="text-gray-500 dark:text-gray-400">Manage your subscription.</p>
                            </header>

                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center gap-4 flex-wrap">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Current Plan</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.plan === 'free' ? 'Basic limited access' : 'Unlimited Pro Access'}</p>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wide ${user.plan === 'pro' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                                        {user.plan}
                                    </span>
                                </div>
                                <div className="p-6 bg-gray-50 dark:bg-gray-900/60">
                                    {user.plan === 'free' ? (
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white mb-1">Upgrade to Pro</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300">$4.99/month for unlimited generations.</p>
                                            </div>
                                            <button onClick={onUpgrade} className="bg-gray-900 dark:bg-indigo-500 text-white px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-bold hover:bg-gray-800 dark:hover:bg-indigo-400 transition-colors">
                                                Upgrade Now
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                             <div>
                                                <p className="font-semibold text-gray-900 dark:text-white mb-1">Pro Plan Active</p>
                                                <p className="text-sm text-gray-600 dark:text-gray-300">Next billing date: {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
                                             </div>
                                             <button onClick={() => toast.info('To cancel, manage your subscription in PayPal.')} className="text-red-600 text-sm font-medium hover:underline min-h-[44px] px-2">
                                                 Cancel Subscription
                                             </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Payment History</h3>
                                {user.plan === 'pro' && (
                                    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">Pro Monthly Subscription</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{new Date().toLocaleDateString()}</p>
                                        </div>
                                        <p className="font-bold text-gray-900 dark:text-white">$4.99</p>
                                    </div>
                                )}
                                <div className="text-center pt-4 text-sm text-gray-400 dark:text-gray-500 italic">
                                    {user.plan === 'pro' ? 'No prior history.' : 'No payment history available.'}
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'settings' && (
                        <div className="space-y-6 max-w-2xl">
                            <header>
                                <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-white">Settings</h1>
                                <p className="text-gray-500 dark:text-gray-400">Profile and preferences.</p>
                            </header>

                            <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
                                <div className="flex items-center gap-6">
                                     <img src={user.avatar} alt={`${user.name}'s avatar`} className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800" />
                                     <div>
                                         <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Change Avatar</p>
                                         <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Avatars are currently generated automatically.</p>
                                     </div>
                                </div>

                                <div>
                                    <label htmlFor="settings-name" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Full Name</label>
                                    <input
                                        id="settings-name"
                                        name="name"
                                        defaultValue={user.name}
                                        autoComplete="name"
                                        className="w-full min-h-[44px] px-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="settings-email" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email Address</label>
                                    <input
                                        id="settings-email"
                                        disabled
                                        defaultValue={user.email}
                                        aria-describedby="settings-email-note"
                                        className="w-full min-h-[44px] px-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                                    />
                                    <p id="settings-email-note" className="text-xs text-gray-400 mt-1">Email can't be changed in demo mode.</p>
                                </div>

                                <div className="pt-2">
                                    <button type="submit" className="bg-gray-900 dark:bg-indigo-500 text-white px-6 py-2.5 min-h-[44px] rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-indigo-400 transition-colors">
                                        Save Changes
                                    </button>
                                </div>
                            </form>

                            <section aria-labelledby="appearance-heading" className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
                                <h2 id="appearance-heading" className="text-lg font-bold text-gray-900 dark:text-white mb-1">Appearance</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose how Fit Check looks to you.</p>
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                                        {theme === 'dark' ? <MoonIcon className="w-5 h-5" aria-hidden="true" /> : <SunIcon className="w-5 h-5" aria-hidden="true" />}
                                        {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                                    </span>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={theme === 'dark'}
                                        onClick={handleToggleTheme}
                                        className={`relative w-14 h-8 min-w-[44px] min-h-[44px] rounded-full transition-colors duration-150 ${theme === 'dark' ? 'bg-indigo-500' : 'bg-gray-300'}`}
                                        aria-label={`Dark mode is ${theme === 'dark' ? 'on' : 'off'}`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow transition-all duration-150 ${theme === 'dark' ? 'left-[calc(100%-1.75rem)]' : 'left-1'}`}
                                        />
                                    </button>
                                </div>
                            </section>

                            <section className="flex items-start gap-3 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/60 rounded-xl p-4">
                                <CheckCircleIcon className="w-5 h-5 shrink-0 text-green-600 mt-0.5" aria-hidden="true" />
                                <span>Your data lives locally in your browser (IndexedDB) — nothing is uploaded except what's needed to generate a look.</span>
                            </section>
                        </div>
                    )}
                </div>
            </main>

            <ConfirmDialog
                isOpen={!!pendingDeleteId}
                title="Delete this look?"
                description={pendingLook ? `This permanently removes “${pendingLook.garmentNames.join(', ')}” (${formatDateRelative(pendingLook.timestamp)}).` : 'This look will be permanently removed.'}
                confirmLabel="Delete Look"
                onCancel={() => setPendingDeleteId(null)}
                onConfirm={() => void handleDeleteOutfit()}
            />
        </div>
    );
};

export default Dashboard;
