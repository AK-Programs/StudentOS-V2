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
  ExternalLink,
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
        return <Mail className="w-5 h-5 text-indigo-500" />;
      case 'Globe':
        return <Globe className="w-5 h-5 text-emerald-500" />;
      case 'Headphones':
        return <Headphones className="w-5 h-5 text-purple-500" />;
      case 'Phone':
        return <Phone className="w-5 h-5 text-amber-500" />;
      case 'Share2':
        return <Share2 className="w-5 h-5 text-cyan-500" />;
      default:
        return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const { founder, teamCredits, channels } = CONTACT_CONFIG;

  return (
    <div className="min-h-full pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-br from-white via-slate-50/70 to-indigo-50/40 dark:from-slate-900/90 dark:via-slate-900/60 dark:to-indigo-950/30 p-8 sm:p-12 shadow-sm backdrop-blur-md"
      >
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100/80 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Platform Information & Directory</span>
            </div>

            <div className="flex items-center gap-4">
              <BrandLogo size="lg" className="shadow-lg rounded-2xl p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
              <div>
                <h1 className="text-3xl sm:text-4xl font-brand font-extrabold tracking-tight text-slate-900 dark:text-white">
                  About {BRAND_CONFIG.name}
                </h1>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Version {BRAND_CONFIG.version} &bull; Verified Institutional Directory
                </p>
              </div>
            </div>

            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Official contact channels, platform leadership, and engineering credits for the {BRAND_CONFIG.name} ecosystem.
            </p>
          </div>

          {/* Quick Info Capsule */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0 bg-white/70 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Verification</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Authorized Release</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-400/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Platform Core</div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Unified School Architecture</div>
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
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Platform Founder
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Platform creator and principal architect of {BRAND_CONFIG.name}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-indigo-200/80 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/40 dark:from-slate-900/90 dark:via-indigo-950/20 dark:to-purple-950/30 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-lg ring-4 ring-white dark:ring-slate-800">
                  {founder.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-slate-800 shadow-sm" title="Verified Founder">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  {founder.badge}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {founder.name}
                </h3>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {founder.role} &bull; {founder.title}
                </p>
                {founder.email && (
                  <div className="pt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
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
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-500/20"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Message</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('founder-email', founder.email!)}
                  title="Copy email address"
                  className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {copiedId === 'founder-email' ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
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
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Official Contact Channels
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
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
                    ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700'
                    : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-80'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      {getChannelIcon(channel.iconName)}
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {channel.label}
                      </div>

                      {isClickable ? (
                        <a
                          href={channel.actionUrl}
                          target={channel.actionUrl?.startsWith('http') ? '_blank' : undefined}
                          rel={channel.actionUrl?.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="group inline-flex items-center gap-1.5 text-base font-semibold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mt-0.5 break-all"
                        >
                          <span>{channel.value}</span>
                          <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      ) : (
                        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 italic">
                          {channel.value}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                        channel.isConfigured
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                      }`}
                    >
                      {channel.statusBadge || (channel.isConfigured ? 'Active' : 'Unconfigured')}
                    </span>

                    {channel.isConfigured && (
                      <button
                        type="button"
                        onClick={() => handleCopy(channel.id, channel.value)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Copy to clipboard"
                      >
                        {copiedId === channel.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {!channel.isConfigured && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    <span>Editable placeholder in <code>src/config/contactConfig.ts</code></span>
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
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Credits & Platform Roles
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
                  ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      member.isFounder
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {member.badge}
                  </span>
                  {member.isPlaceholder && (
                    <span className="text-[10px] text-slate-400 font-mono">Placeholder</span>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {member.name}
                  </h3>
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {member.role}
                  </div>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {member.title}
                </p>
              </div>

              {member.email && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <a
                    href={`mailto:${member.email}`}
                    className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-mono text-[11px] truncate block"
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
        className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <FileCode2 className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              Centralized Brand & Directory Architecture
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Contact channels and roles can be updated in <code>src/config/contactConfig.ts</code> and logo assets in <code>public/brand/</code>.
            </p>
          </div>
        </div>

        {onNavigateTab && (
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="shrink-0 text-xs font-semibold px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
          >
            Return to Dashboard
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default AboutVeylentraPage;
