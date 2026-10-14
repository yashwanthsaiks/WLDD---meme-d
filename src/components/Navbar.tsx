import React from 'react';
import { User, DatabaseStatus } from '../api';
import { Sparkles, UserCircle, LogOut, Layers, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';

interface NavbarProps {
  user: User | null;
  activeTab: 'campaigns' | 'brand' | 'creator' | 'simulator' | 'scaling';
  setActiveTab: (tab: 'campaigns' | 'brand' | 'creator' | 'simulator' | 'scaling') => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onSwitchUser: (user: User) => void;
  demoUsers: User[];
  dbStatus: DatabaseStatus | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onLogout,
  onSwitchUser,
  demoUsers,
  dbStatus,
}) => {
  const navItems = [
    { id: 'campaigns', label: 'Explore Campaigns' },
    { id: 'brand', label: 'Brand Hub' },
    { id: 'creator', label: 'Creator Hub' },
    { id: 'simulator', label: 'Live View Simulator' },
    { id: 'scaling', label: 'Scaling Blueprint' },
  ] as const;

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-16">
          {/* Zone 1: Brand Wordmark with pastel badge */}
          <button
            onClick={() => setActiveTab('campaigns')}
            className="flex items-center gap-2.5 shrink-0 group text-left cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-200 via-teal-100 to-indigo-200 flex items-center justify-center shadow-sm border border-emerald-300/40 group-hover:scale-105 transition-transform">
              <span className="text-emerald-800 font-extrabold text-sm tracking-tighter">M’d</span>
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                Meme’d
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                PAYOUTS
              </span>
            </div>
          </button>

          {/* Zone 2: Animated Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    isActive ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTabBadge"
                      className="absolute inset-0 bg-white rounded-lg shadow-xs border border-slate-200/80"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary action or user session switch */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Quick Demo Switcher Dropdown */}
            {demoUsers.length > 0 && (
              <div className="relative group">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-purple-50/70 border border-purple-200/70 rounded-lg hover:bg-purple-100/60 transition-all cursor-pointer shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span className="hidden lg:inline">Switch Demo User</span>
                  <span className="lg:hidden">Demos</span>
                </button>

                <div className="absolute right-0 mt-1 w-64 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-50">
                  <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase tracking-wider font-mono border-b border-slate-100">
                    Switch Test Account
                  </div>
                  {demoUsers.map((u) => {
                    const isCurrent = user?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => onSwitchUser(u)}
                        className={`w-full text-left px-3.5 py-2 text-xs hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer ${
                          isCurrent ? 'bg-emerald-50/60' : ''
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-800">{u.name}</div>
                          <div className="text-[10px] text-slate-500 capitalize">{u.role} Account</div>
                        </div>
                        {isCurrent ? (
                          <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 capitalize">
                            Switch →
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-bold text-slate-900 leading-tight">{user.name}</div>
                  <div className="text-[10px] font-mono font-semibold text-emerald-700 capitalize">
                    {user.role}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all shadow-sm hover:shadow cursor-pointer"
              >
                Sign In / Join
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
