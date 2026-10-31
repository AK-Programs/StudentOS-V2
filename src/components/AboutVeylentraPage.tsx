import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Mail,
  Globe,
  Headphones,
  Phone,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  Award,
  Sparkles,
  Info,
  Layers,
  FileCode2,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import { BRAND_CONFIG } from '../config/branding';
import { CONTACT_CONFIG, ContactChannel, ProfileCredit } from '../config/contactConfig';
import BrandLogo from './brand/BrandLogo';

interface AboutVeylentraPageProps {
  onNavigateTab?: (tab: string) => void;
}

export const AboutVeylentraPage: React.FC<AboutVeylentraPageProps> = ({ onNavigateTab }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const getChannelIcon = (iconName: ContactChannel['iconName']) => {
    switch (iconName) {
      case 'Mail':
        return <Mail className="w-5 h-5 text-indigo-400" />;
      case 'Globe':
        return <Globe className="w-5 h-5 text-emerald-400" />;
      case 'Headphones':
        return <Headphones className="w-5 h-5 text-purple-400" />;
      case 'Phone':
        return <Phone className="w-5 h-5 text-amber-400" />;
      case 'Share2':
        return <Share2 className="w-5 h-5 text-cyan-400" />;
      default:
        return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const { founder, teamCredits, channels } = CONTACT_CONFIG;

  return (
    <div className="min-h-full pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10 text-slate-100">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-10 shadow-2xl smart-glass"
      >
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-500/20 via-cyan-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Official Platform Information & Directory</span>
            </div>

            <div className="flex items-center gap-4">
              <BrandLogo size="lg" className="shrink-0" />
              <div>
                <h1 className="text-3xl sm:text-4xl font-brand font-extrabold tracking-tight">
                  About {BRAND_CONFIG.name}
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-400 mt-0.5">
                  Version {BRAND_CONFIG.version} &bull; Verified Institutional Directory
                </p>
              </div>
            </div>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Official contact channels, platform leadership, and engineering credits for the {BRAND_CONFIG.name} ecosystem.
            </p>
          </div>

          {/* Quick Info Capsule */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0 bg-slate-950/60 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Verification</div>
                <div className="text-sm font-bold text-white">Authorized Release</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform Core</div>
                <div className="text-sm font-bold text-white">Unified School Architecture</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Founder Profile Section */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              Platform Founder
            </h2>
            <p className="text-xs text-slate-400">
              Platform creator and principal architect of {BRAND_CONFIG.name}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 smart-glass p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-lg ring-4 ring-slate-800">
                  {founder.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-white ring-2 ring-slate-900 shadow-sm" title="Verified Founder">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {founder.badge}
                </div>
                <h3 className="text-2xl font-black text-white">
                  {founder.name}
                </h3>
                <p className="text-sm font-semibold text-slate-300">
                  {founder.role} &bull; {founder.title}
                </p>
                {founder.email && (
                  <div className="pt-1 flex items-center gap-2 text-xs text-indigo-300 font-mono">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{founder.email}</span>
                  </div>
                )}
              </div>
            </div>

            {founder.email && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <a
                  href={`mailto:${founder.email}`}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Message</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('founder-email', founder.email!)}
                  title="Copy email address"
                  className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
                >
                  {copiedId === 'founder-email' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      {/* Official Contact Details Section */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
        className="space-y-4"
      >
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-400" />
            Official Contact Channels
          </h2>
          <p className="text-xs text-slate-400">
            Direct communication channels and support routing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const isClickable = channel.isConfigured && !!channel.actionUrl;
            return (
              <div
                key={channel.id}
                className={`relative rounded-2xl border p-5 transition-all duration-200 ${
                  channel.isConfigured
                    ? 'border-white/10 smart-glass hover:border-indigo-500/50'
                    : 'border-dashed border-white/10 bg-slate-950/40 opacity-70'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0">
                      {getChannelIcon(channel.iconName)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        {channel.label}
                      </div>

                      {isClickable ? (
                        <a
                          href={channel.actionUrl}
                          target={channel.actionUrl?.startsWith('http') ? '_blank' : undefined}
                          rel={channel.actionUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="group inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-white hover:text-indigo-300 transition-colors mt-0.5 break-all"
                        >
                          <span>{channel.value}</span>
                          <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-indigo-400 shrink-0" />
                        </a>
                      ) : (
                        <div className="text-xs sm:text-sm font-medium text-slate-400 mt-1 italic">
                          {channel.value}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        channel.isConfigured
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {channel.statusBadge || (channel.isConfigured ? 'Active' : 'Unconfigured')}
                    </span>

                    {channel.isConfigured && (
                      <button
                        type="button"
                        onClick={() => handleCopy(channel.id, channel.value)}
                        className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10 cursor-pointer"
                        title="Copy to clipboard"
                      >
                        {copiedId === channel.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {!channel.isConfigured && (
                  <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Editable placeholder in <code className="text-slate-300">src/config/contactConfig.ts</code></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Credits Area: Team & Owner Profiles with Roles */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Credits & Platform Roles
            </h2>
            <p className="text-xs text-slate-400">
              Engineering, architecture, and functional responsibilities across {BRAND_CONFIG.name}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teamCredits.map((member: ProfileCredit) => (
            <div
              key={member.id}
              className={`rounded-2xl border p-5 flex flex-col justify-between ${
                member.isFounder
                  ? 'border-indigo-500/40 bg-indigo-950/20'
                  : 'border-white/10 smart-glass'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      member.isFounder
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {member.badge}
                  </span>
                  {member.isPlaceholder && (
                    <span className="text-[10px] text-slate-500 font-mono">Placeholder</span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {member.name}
                  </h3>
                  <div className="text-xs font-bold text-indigo-400 mt-0.5">
                    {member.role}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {member.title}
                </p>
              </div>

              {member.email && (
                <div className="mt-4 pt-3 border-t border-white/10 text-xs">
                  <a
                    href={`mailto:${member.email}`}
                    className="text-slate-300 hover:text-indigo-300 font-mono text-[11px] truncate block"
                  >
                    {member.email}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.section>

      {/* Configuration & Developer Guide Notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.4 }}
        className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center shrink-0">
            <FileCode2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              Centralized Brand & Directory Architecture
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Contact channels and roles can be updated in <code className="text-slate-300">src/config/contactConfig.ts</code> and logo assets in <code className="text-slate-300">public/brand/</code>.
            </p>
          </div>
        </div>

        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default AboutVeylentraPage;
