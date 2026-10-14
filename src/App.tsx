import React, { useState, useEffect } from 'react';
import {
  User,
  Campaign,
  Submission,
  DatabaseStatus,
  fetchHealth,
  fetchDemoUsers,
  fetchCurrentUser,
  fetchCampaigns,
  fetchSubmissions,
  loginUser,
  authStorage,
} from './api';
import { Navbar } from './components/Navbar';
import { CampaignsDirectory } from './components/CampaignsDirectory';
import { BrandDashboard } from './components/BrandDashboard';
import { CreatorDashboard } from './components/CreatorDashboard';
import { ViewSimulatorLab } from './components/ViewSimulatorLab';
import { ScalingArchitectureDoc } from './components/ScalingArchitectureDoc';
import { AuthModal } from './components/AuthModal';
import { CreateCampaignModal } from './components/CreateCampaignModal';
import { Database, ShieldCheck, CheckCircle2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'campaigns' | 'brand' | 'creator' | 'simulator' | 'scaling'>('campaigns');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCreateCampaignOpen, setIsCreateCampaignOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [health, camps, subs, demos, currentUser] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchCampaigns().catch(() => []),
        fetchSubmissions().catch(() => []),
        fetchDemoUsers().catch(() => []),
        fetchCurrentUser().catch(() => null),
      ]);

      if (health) setDbStatus(health.db);
      setCampaigns(camps);
      setSubmissions(subs);
      setDemoUsers(demos);

      if (currentUser) {
        setUser(currentUser);
      } else if (demos.length > 0 && !authStorage.getToken()) {
        // Auto-select first demo user (Nike Brand) on first visit for zero friction
        handleSwitchUser(demos[0]);
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSwitchUser = async (targetUser: User) => {
    try {
      const res = await loginUser(targetUser.email, 'demo1234');
      setUser(res.user);
      if (res.user.role === 'brand' && activeTab === 'creator') {
        setActiveTab('brand');
      } else if (res.user.role === 'creator' && activeTab === 'brand') {
        setActiveTab('creator');
      }
      loadData();
    } catch (err) {
      console.error('Switch user failed:', err);
    }
  };

  const handleLogout = () => {
    authStorage.clearToken();
    setUser(null);
  };

  const handleCampaignCreated = (newCamp: Campaign) => {
    setCampaigns((prev) => [newCamp, ...prev]);
    setActiveTab('brand');
    loadData();
  };

  const handleSelectCampaignForSubmission = (campaignId: string) => {
    setActiveTab('creator');
  };

  return (
    <div className="min-h-screen text-slate-900 flex flex-col font-sans selection:bg-purple-200 selection:text-purple-900">
      {/* Top Navigation */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        demoUsers={demoUsers}
        dbStatus={dbStatus}
      />

      {/* Modern Pastel Sub-header Status Bar */}
      <div className="bg-white/60 backdrop-blur-md border-b border-slate-200/60 px-4 py-2 text-[11px] font-mono shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-slate-500">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-purple-600" />
              <span>Database:</span>
              <strong className="text-slate-800 font-semibold">
                {dbStatus?.mode === 'mongodb'
                  ? 'MongoDB Atlas (Connected)'
                  : dbStatus?.hasMongoUriEnv
                  ? 'Atlas Detected (Allow 0.0.0.0/0 in Atlas Network Access) · Resilient Store'
                  : 'Embedded Store (Ready for MONGODB_URI)'}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Auth: <strong className="text-slate-800">JWT Bearer</strong></span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Concurrency: <strong className="text-emerald-700">Atomic Mutex Guarded</strong></span>
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span>Session:</span>
            {user ? (
              <span className="text-purple-800 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200/60">
                {user.name} ({user.role})
              </span>
            ) : (
              <span className="text-slate-400">Guest Visitor</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Viewport with Animated Transitions */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="inline-block animate-spin w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full mb-3" />
            <div className="text-xs font-mono text-slate-500">Loading Meme’d Marketplace...</div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === 'campaigns' && (
                <CampaignsDirectory
                  campaigns={campaigns}
                  submissions={submissions}
                  onSelectCampaignForSubmission={handleSelectCampaignForSubmission}
                  onOpenCreateCampaign={() => setIsCreateCampaignOpen(true)}
                  isBrand={user?.role === 'brand'}
                />
              )}

              {activeTab === 'brand' && (
                <BrandDashboard
                  campaigns={campaigns}
                  submissions={submissions}
                  onRefresh={loadData}
                  onOpenCreateCampaign={() => setIsCreateCampaignOpen(true)}
                  brandUserId={user?.role === 'brand' ? user.id : undefined}
                />
              )}

              {activeTab === 'creator' && (
                <CreatorDashboard
                  campaigns={campaigns}
                  submissions={submissions}
                  onRefresh={loadData}
                  creatorUserId={user?.role === 'creator' ? user.id : undefined}
                />
              )}

              {activeTab === 'simulator' && (
                <ViewSimulatorLab
                  submissions={submissions}
                  campaigns={campaigns}
                  onRefresh={loadData}
                />
              )}

              {activeTab === 'scaling' && (
                <ScalingArchitectureDoc />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Pastel Modern Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 backdrop-blur-md py-6 text-xs text-slate-500 font-mono mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-800">
              M
            </div>
            <span>© 2026 Meme’d Creator Marketplace · Milestone Payout Tracker</span>
          </div>

          <div className="flex items-center gap-4 text-slate-600 font-medium">
            <button onClick={() => setActiveTab('simulator')} className="hover:text-purple-700 transition-colors cursor-pointer">
              Live Simulator
            </button>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <button onClick={() => setActiveTab('scaling')} className="hover:text-purple-700 transition-colors cursor-pointer">
              10K Scaling Blueprint
            </button>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <button onClick={() => setIsCreateCampaignOpen(true)} className="hover:text-purple-700 transition-colors cursor-pointer">
              Create Campaign
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          loadData();
        }}
        demoUsers={demoUsers}
        onSelectDemoUser={handleSwitchUser}
      />

      <CreateCampaignModal
        isOpen={isCreateCampaignOpen}
        onClose={() => setIsCreateCampaignOpen(false)}
        onSuccess={handleCampaignCreated}
      />
    </div>
  );
}
