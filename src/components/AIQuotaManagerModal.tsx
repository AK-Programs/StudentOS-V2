import React, { useState } from 'react';
import { Sparkles, Shield, Gift, Zap, Clock, CheckCircle, AlertCircle, X, ArrowUpRight } from 'lucide-react';
import { AIUsageState, BASE_ROLE_LIMITS, redeemAIVoucher, submitQuotaRequest } from '../lib/aiUsageManager';

interface AIQuotaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  usageState: AIUsageState;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  onQuotaUpdated: (newState: AIUsageState) => void;
}

export default function AIQuotaManagerModal({
  isOpen,
  onClose,
  usageState,
  userId,
  userName,
  userEmail,
  userRole = 'student',
  onQuotaUpdated
}: AIQuotaManagerModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'redeem' | 'request'>('status');
  const [voucherCode, setVoucherCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  const [requestReason, setRequestReason] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  if (!isOpen) return null;

  const percentUsed = Math.min(100, Math.round((usageState.used / Math.max(1, usageState.limit)) * 100));
  const isExhausted = usageState.remaining <= 0;

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;
    setRedeemLoading(true);
    setRedeemFeedback(null);

    const res = await redeemAIVoucher(voucherCode, userId, userRole);
    setRedeemLoading(false);
    setRedeemFeedback({ success: res.success, message: res.message });

    if (res.success) {
      setVoucherCode('');
      onQuotaUpdated({
        ...usageState,
        limit: res.newLimit || (usageState.limit + (res.bonusAdded || 0)),
        remaining: Math.max(0, (res.newLimit || (usageState.limit + (res.bonusAdded || 0))) - usageState.used),
        bonus: usageState.bonus + (res.bonusAdded || 0)
      });
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim()) return;
    setRequestLoading(true);
    setRequestFeedback(null);

    const res = await submitQuotaRequest(userId, userName, userEmail || '', requestReason);
    setRequestLoading(false);
    setRequestFeedback({ success: res.success, message: res.message });

    if (res.success) {
      setRequestReason('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">AI Buddy Limits & Quota Upgrade</h2>
              <p className="text-xs text-slate-400">Rolling 24-hour limits and academic boost options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/30 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'status'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Quota Status
          </button>
          <button
            onClick={() => setActiveTab('redeem')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'redeem'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Gift className="w-3.5 h-3.5" /> Redeem Boost Voucher
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'request'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" /> Request Expansion
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6">
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Main Gauge Card */}
              <div className="p-5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Current Role Tier</span>
                    <h3 className="text-lg font-black text-white capitalize">{userRole} Tier</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Available Today</span>
                    <p className={`text-xl font-black ${isExhausted ? 'text-red-400' : 'text-emerald-400'}`}>
                      {usageState.remaining} <span className="text-xs font-medium text-slate-400">/ {usageState.limit} queries</span>
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isExhausted 
                          ? 'bg-red-500' 
                          : percentUsed > 80 
                            ? 'bg-amber-500' 
                            : 'bg-indigo-500'
                      }`}
                      style={{ width: `${percentUsed}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>{usageState.used} used</span>
                    <span>{percentUsed}% capacity</span>
                  </div>
                </div>

                {/* Active Bonus badge */}
                {usageState.bonus > 0 && (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-indigo-400" />
                    <span>Active Academic Bonus: <strong>+{usageState.bonus} queries/day</strong> unlocked via voucher</span>
                  </div>
                )}

                {/* Reset Information */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Rolling 24h Window
                  </span>
                  <span>
                    {isExhausted && usageState.nextAvailableInMinutes
                      ? `Next query unlocks in ~${usageState.nextAvailableInMinutes} min`
                      : 'Queries replenish dynamically after 24 hours'}
                  </span>
                </div>
              </div>

              {/* Tier Comparison Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Institution AI Tiers</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { role: 'Student', limit: BASE_ROLE_LIMITS.student, color: 'border-white/10' },
                    { role: 'Teacher', limit: BASE_ROLE_LIMITS.teacher, color: 'border-indigo-500/30 bg-indigo-950/20' },
                    { role: 'Coordinator', limit: BASE_ROLE_LIMITS.coordinator, color: 'border-white/10' },
                    { role: 'Admin', limit: BASE_ROLE_LIMITS.admin, color: 'border-white/10' }
                  ].map((t) => (
                    <div
                      key={t.role}
                      className={`p-3 rounded-xl border text-center ${t.color} ${
                        userRole.toLowerCase() === t.role.toLowerCase() ? 'ring-1 ring-indigo-400' : 'bg-slate-950/40'
                      }`}
                    >
                      <p className="text-[10px] uppercase font-bold text-slate-400">{t.role}</p>
                      <p className="text-sm font-black text-white mt-0.5">{t.limit} <span className="text-[9px] text-slate-400 font-normal">/ day</span></p>
                      {userRole.toLowerCase() === t.role.toLowerCase() && (
                        <span className="inline-block mt-1 text-[8px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-bold uppercase">
                          Current
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'redeem' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-200 leading-relaxed">
                <p className="font-bold text-white mb-1">🎁 Got a Study Voucher or Academic Sprint Pass?</p>
                Enter your code below to instantly unlock bonus daily AI queries for your account. Bonus queries remain active on your rolling daily allocation.
              </div>

              <form onSubmit={handleRedeem} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Voucher / Access Code</label>
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value)}
                    placeholder="e.g. STUDENTOS-PRO or EXAM-PREP"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono uppercase tracking-wider text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5 space-y-1 text-[11px] text-slate-400">
                  <span className="font-bold text-slate-300">💡 Available Academic Sprint Codes:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {['STUDENTOS-PRO', 'EXAM-PREP', 'SCHOLAR-PASS'].map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setVoucherCode(c)}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-mono text-indigo-300 hover:text-white"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={redeemLoading || !voucherCode.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {redeemLoading ? 'Validating Voucher...' : 'Redeem Code'}
                </button>
              </form>

              {redeemFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${
                    redeemFeedback.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {redeemFeedback.success ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>{redeemFeedback.message}</span>
                </div>
              )}
            </div>
          )}

          {activeTab === 'request' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 text-xs text-slate-300 leading-relaxed">
                <p className="font-bold text-white mb-1">📋 Requesting Academic Quota Expansion</p>
                Need additional query quota for competitive exams, Olympiad preparation, or thesis research? Submit a direct quota expansion request to your teachers.
              </div>

              <form onSubmit={handleRequest} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Reason for Request</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Preparing for upcoming CBSE Board Physics / JEE examination; require additional derivation checks..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={requestLoading || !requestReason.trim()}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {requestLoading ? 'Submitting Request...' : 'Send Request to Instructors'}
                </button>
              </form>

              {requestFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-fadeIn ${
                    requestFeedback.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border-red-500/30 text-red-300'
                  }`}
                >
                  {requestFeedback.success ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>{requestFeedback.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950/80 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
          <span>StudentOS AI Safety & Fair Quota Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
