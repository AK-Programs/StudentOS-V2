/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Whiteboard Unified Asset Hub ("AI Board")
 * Sections:
 * A. Ready-made 3D Models (Verified models only)
 * B. Ready-made SVGs (Verified educational SVGs only)
 * C. Request Models & SVGs (Persistent StudentOS request workflow with school isolation)
 * Zero arbitrary AI 3D generation.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Box,
  Image as ImageIcon,
  Sparkles,
  Plus,
  Check,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  Filter,
  Layers,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import {
  ALL_VERIFIED_ASSETS,
  VerifiedAssetItem,
  searchVerifiedAssets
} from '../lib/whiteboardAssetRegistry';
import { Scene3DData } from './Whiteboard2';
import {
  WhiteboardVisualRequest,
  submitVisualRequest,
  fetchVisualRequests,
  updateVisualRequestStatus
} from '../lib/supabaseWhiteboardRequests';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd3DModel: (scene: Scene3DData) => void;
  onAddSvgDiagram: (svgString: string, title: string) => void;
  currentUser?: {
    id?: string;
    name?: string;
    role?: string;
    school_id?: string;
    school_name?: string;
  };
  initialQuery?: string;
  initialCategory?: string;
}

export const WhiteboardAssetDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  onAdd3DModel,
  onAddSvgDiagram,
  currentUser,
  initialQuery = '',
  initialCategory = '3d'
}) => {
  // Main Section Tab: '3d' | 'svg' | 'request'
  const [activeSection, setActiveSection] = useState<'3d' | 'svg' | 'request'>(() => {
    if (initialCategory === 'SVGs' || initialCategory === 'svg') return 'svg';
    if (initialCategory === 'request') return 'request';
    return '3d';
  });

  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [addedAssetId, setAddedAssetId] = useState<string | null>(null);

  // Request Form States
  const [reqType, setReqType] = useState<'3d' | 'svg'>('3d');
  const [reqName, setReqName] = useState('');
  const [reqSubject, setReqSubject] = useState('Biology');
  const [reqGrade, setReqGrade] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqWhyNeeded, setReqWhyNeeded] = useState('');
  const [reqUrgency, setReqUrgency] = useState<'normal' | 'urgent'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);
  const [submitErrorMsg, setSubmitErrorMsg] = useState<string | null>(null);

  // Request Management / Listing
  const [requestsList, setRequestsList] = useState<WhiteboardVisualRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ready'>('all');

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setSearchQuery(initialQuery);
      }
      if (initialCategory === 'SVGs' || initialCategory === 'svg') {
        setActiveSection('svg');
      } else if (initialCategory === 'request') {
        setActiveSection('request');
      } else {
        setActiveSection('3d');
      }
    }
  }, [isOpen, initialQuery, initialCategory]);

  // Load existing requests when Request section is active
  useEffect(() => {
    if (isOpen && activeSection === 'request') {
      loadRequests();
    }
  }, [isOpen, activeSection]);

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const items = await fetchVisualRequests({
        schoolId: currentUser?.school_id,
        requesterId: currentUser?.id,
        role: currentUser?.role
      });
      setRequestsList(items);
    } finally {
      setLoadingRequests(false);
    }
  };

  // Pre-fill request form from search
  const handleTriggerRequest = (type: '3d' | 'svg', topic: string) => {
    setReqType(type);
    setReqName(topic);
    setReqDescription(`Educational ${type === '3d' ? '3D representation' : 'SVG diagram'} of ${topic}`);
    setSubmitSuccessMsg(null);
    setSubmitErrorMsg(null);
    setActiveSection('request');
  };

  // Filtered Assets based on current active section (Section A = 3d, Section B = svg)
  const filteredAssets = useMemo(() => {
    const targetType = activeSection === '3d' ? '3d' : 'svg';
    const query = searchQuery.trim().toLowerCase();

    return ALL_VERIFIED_ASSETS.filter((item) => {
      if (item.type !== targetType) return false;
      if (selectedSubject !== 'All' && item.subject !== selectedSubject) return false;
      if (!query) return true;

      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.subject.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    });
  }, [activeSection, searchQuery, selectedSubject]);

  // Available subjects for current asset type
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    set.add('All');
    const targetType = activeSection === '3d' ? '3d' : 'svg';
    for (const a of ALL_VERIFIED_ASSETS) {
      if (a.type === targetType && a.subject) {
        set.add(a.subject);
      }
    }
    return Array.from(set);
  }, [activeSection]);

  // Counts
  const verified3DCount = useMemo(() => ALL_VERIFIED_ASSETS.filter(a => a.type === '3d').length, []);
  const verifiedSvgCount = useMemo(() => ALL_VERIFIED_ASSETS.filter(a => a.type === 'svg').length, []);

  const handleAddAsset = (asset: VerifiedAssetItem) => {
    if (asset.type === '3d' && asset.scene3D) {
      onAdd3DModel(asset.scene3D);
    } else if (asset.type === 'svg' && asset.svgContent) {
      onAddSvgDiagram(asset.svgContent, asset.title);
    }
    setAddedAssetId(asset.id);
    setTimeout(() => {
      setAddedAssetId(null);
      onClose();
    }, 400);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqName.trim()) {
      setSubmitErrorMsg('Please provide a name / topic for the request.');
      return;
    }

    setIsSubmitting(true);
    setSubmitSuccessMsg(null);
    setSubmitErrorMsg(null);

    const res = await submitVisualRequest({
      requestType: reqType,
      topic: reqName,
      subject: reqSubject,
      description: reqDescription,
      grade: reqGrade,
      whyNeeded: reqWhyNeeded,
      urgency: reqUrgency,
      requesterId: currentUser?.id,
      requesterName: currentUser?.name || 'Authenticated User',
      requesterRole: currentUser?.role || 'Student',
      schoolId: currentUser?.school_id || 'school_default',
      schoolName: currentUser?.school_name || 'StudentOS Academy'
    });

    setIsSubmitting(false);

    if (res.success && res.request) {
      setSubmitSuccessMsg(
        `✅ ${reqType === '3d' ? '3D Model' : 'SVG Diagram'} request for "${reqName}" submitted! Persisted to StudentOS and queued for review.`
      );
      // Prepend to requests list
      setRequestsList(prev => [res.request!, ...prev]);
      // Reset form
      setReqName('');
      setReqDescription('');
      setReqGrade('');
      setReqWhyNeeded('');
    } else {
      setSubmitErrorMsg(res.error || 'Failed to submit request. Please try again.');
    }
  };

  const handleUpdateStatus = async (id: string, status: WhiteboardVisualRequest['status']) => {
    const ok = await updateVisualRequestStatus(id, status);
    if (ok) {
      setRequestsList(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl bg-slate-900 border border-indigo-500/35 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-scaleUp text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-white/10 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500/25 to-violet-500/25 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-display flex items-center gap-2">
                <span>AI Board</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono font-bold tracking-normal normal-case">
                  Verified Visuals &amp; Requests
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                Verified educational models &amp; SVGs. Zero arbitrary geometry.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
            title="Close Dialog"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Major Sections Navigation Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-slate-950 border-b border-white/10 overflow-x-auto gap-2">
          <div className="flex items-center gap-2">
            {/* Section A: Ready-made 3D Models */}
            <button
              onClick={() => {
                setActiveSection('3d');
                setSelectedSubject('All');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSection === '3d'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box className="w-4 h-4 text-sky-300" />
              <span>Ready-made 3D Models</span>
              <span className="px-1.5 py-0.5 rounded-full bg-white/15 text-[10px] font-mono">
                {verified3DCount}
              </span>
            </button>

            {/* Section B: Ready-made SVGs */}
            <button
              onClick={() => {
                setActiveSection('svg');
                setSelectedSubject('All');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSection === 'svg'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-[1.02]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-violet-300" />
              <span>Ready-made SVGs</span>
              <span className="px-1.5 py-0.5 rounded-full bg-white/15 text-[10px] font-mono">
                {verifiedSvgCount}
              </span>
            </button>

            {/* Section C: Request Models & SVGs */}
            <button
              onClick={() => setActiveSection('request')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeSection === 'request'
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/30 scale-[1.02]'
                  : 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20'
              }`}
            >
              <FileQuestion className="w-4 h-4 text-amber-300" />
              <span>Request Models &amp; SVGs</span>
              {requestsList.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-[10px] font-mono text-amber-200">
                  {requestsList.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <span>Verified StudentOS Hub</span>
          </div>
        </div>

        {/* Content Body */}
        {activeSection !== 'request' ? (
          /* =========================================================================
             SECTIONS A & B: Ready-Made Assets (3D or SVG)
             ========================================================================= */
          <>
            {/* Search Bar & Subject Filters */}
            <div className="p-4 sm:p-5 pb-2 sm:pb-3 bg-slate-950/40 border-b border-white/5 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeSection === '3d'
                      ? 'Search verified 3D models (heart, mitosis, cell, DNA, solar system, inclined plane, neuron)...'
                      : 'Search verified SVGs & diagrams (circuit, photosynthesis, nephron, periodic table, triangle)...'
                  }
                  className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-2xl bg-slate-950 border border-white/10 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 rounded-lg cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Subject Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
                {availableSubjects.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                      selectedSubject === sub
                        ? activeSection === '3d'
                          ? 'bg-sky-600 text-white border-sky-400 shadow-md'
                          : 'bg-violet-600 text-white border-violet-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Asset Cards Grid OR Empty State with "Request" CTA */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {filteredAssets.length === 0 ? (
                /* Strict: DO NOT generate random 3D model / geometry! Show "No verified model found." + Request CTA */
                <div className="py-14 px-4 text-center space-y-4 max-w-lg mx-auto bg-slate-950/60 rounded-3xl border border-white/10 p-6 sm:p-8">
                  <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                    <AlertCircle className="w-7 h-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-base font-black text-white">
                      {activeSection === '3d' ? 'No verified model found.' : 'No verified SVG found.'}
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {searchQuery
                        ? `There is currently no verified ${activeSection === '3d' ? '3D model' : 'SVG'} for "${searchQuery}". Arbitrary AI generation is disabled to maintain educational accuracy.`
                        : `No verified assets match the selected filter.`}
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    {searchQuery && (
                      <button
                        onClick={() => handleTriggerRequest(activeSection, searchQuery)}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                      >
                        <FileQuestion className="w-4 h-4" />
                        <span>Request this {activeSection === '3d' ? 'model' : 'SVG'}</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedSubject('All');
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10 text-xs font-bold transition-all cursor-pointer"
                    >
                      Clear Search &amp; Reset Filters
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {filteredAssets.map((asset) => {
                    const isAdded = addedAssetId === asset.id;
                    return (
                      <div
                        key={asset.id}
                        className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 hover:border-indigo-500/50 transition-all space-y-3 flex flex-col justify-between group shadow-sm hover:shadow-indigo-500/10"
                      >
                        <div>
                          {/* Thumbnail Preview Area */}
                          <div className="w-full h-32 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center p-2 overflow-hidden relative group-hover:border-indigo-500/30 transition-colors">
                            <div
                              className="w-full h-full flex items-center justify-center pointer-events-none"
                              dangerouslySetInnerHTML={{ __html: asset.thumbnailSvg }}
                            />
                            {/* Type Badge */}
                            <div className="absolute top-2 right-2">
                              {asset.type === '3d' ? (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 shadow-sm">
                                  <Box className="w-3 h-3" />
                                  <span>3D Model</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1 shadow-sm">
                                  <ImageIcon className="w-3 h-3" />
                                  <span>SVG Diagram</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Header & Meta */}
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                                {asset.title}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                {asset.subject}
                              </span>
                              <span>•</span>
                              <span>{asset.category}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed pt-1">
                              {asset.description}
                            </p>
                          </div>
                        </div>

                        {/* Add Button */}
                        <button
                          onClick={() => handleAddAsset(asset)}
                          disabled={isAdded}
                          className={`w-full py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                            isAdded
                              ? 'bg-emerald-600 text-white'
                              : asset.type === '3d'
                              ? 'bg-sky-600 hover:bg-sky-500 text-white hover:shadow-sky-500/20'
                              : 'bg-violet-600 hover:bg-violet-500 text-white hover:shadow-violet-500/20'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Whiteboard!</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add to Whiteboard</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>
                {filteredAssets.length} verified {activeSection === '3d' ? '3D model' : 'SVG visual'}
                {filteredAssets.length === 1 ? '' : 's'}
              </span>
              <span>StudentOS Verified Asset Registry</span>
            </div>
          </>
        ) : (
          /* =========================================================================
             SECTION C: Request Models & SVGs (StudentOS Backend & Supabase)
             ========================================================================= */
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            {/* Header Description */}
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/70 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold text-sm">Request Models &amp; SVGs</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    Supabase &amp; StudentOS Backend
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Can't find the visual you need? Submit a request for a new verified model or SVG.
                </p>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-900 border border-white/5 px-3 py-1.5 rounded-xl font-mono">
                School: <span className="text-white">{currentUser?.school_name || 'Standard School'}</span>
              </div>
            </div>

            {submitSuccessMsg && (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{submitSuccessMsg}</span>
              </div>
            )}

            {submitErrorMsg && (
              <div className="p-4 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{submitErrorMsg}</span>
              </div>
            )}

            {/* Request Form */}
            <form onSubmit={handleSubmitRequest} className="space-y-4 bg-slate-950/50 p-5 rounded-3xl border border-white/10">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono">
                Submit New Verified Visual Request
              </h4>

              {/* Request Type Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                  Request Type
                </label>
                <div className="grid grid-cols-2 gap-2 max-w-md">
                  <button
                    type="button"
                    onClick={() => setReqType('3d')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      reqType === '3d'
                        ? 'bg-sky-600 text-white border-sky-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                    }`}
                  >
                    <Box className="w-4 h-4 text-sky-300" />
                    <span>3D Model</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReqType('svg')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      reqType === 'svg'
                        ? 'bg-violet-600 text-white border-violet-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-violet-300" />
                    <span>SVG / Diagram</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Name / Topic */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                    Name / Topic <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="e.g. Meristematic Tissue"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  />
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                    Subject <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={reqSubject}
                    onChange={(e) => setReqSubject(e.target.value)}
                    placeholder="e.g. Biology, Physics, Chemistry, Mathematics"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Optional Class / Grade */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                    Optional Class / Grade
                  </label>
                  <input
                    type="text"
                    value={reqGrade}
                    onChange={(e) => setReqGrade(e.target.value)}
                    placeholder="e.g. 9, Grade 11, Class 10"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  />
                </div>

                {/* Urgency */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                    Urgency
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReqUrgency('normal')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        reqUrgency === 'normal'
                          ? 'bg-slate-800 text-white border-white/30 shadow'
                          : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setReqUrgency('urgent')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        reqUrgency === 'urgent'
                          ? 'bg-red-600/30 text-red-200 border-red-500/50 shadow font-black'
                          : 'bg-slate-900 text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      Urgent ⚡
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="Educational 3D representation of meristematic tissue showing apical dome, procambium, and protoderm cells..."
                  rows={2}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner resize-none"
                />
              </div>

              {/* Why you need it */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                  Why you need it
                </label>
                <input
                  type="text"
                  value={reqWhyNeeded}
                  onChange={(e) => setReqWhyNeeded(e.target.value)}
                  placeholder="e.g. Teaching plant tissues & cell division in next Monday's SmartBoard lecture"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 shadow-inner"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !reqName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting to StudentOS...' : 'Submit Visual Request'}</span>
                </button>
              </div>
            </form>

            {/* Existing Requests Section with School Isolation & RLS */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                    <span>{isSuperAdmin ? 'All School & Platform Visual Requests' : 'My School Visual Requests'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-sans">
                      {requestsList.length}
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Track verification progress. Super Admin reviews and adds verified models to the registry.
                  </p>
                </div>
                <button
                  onClick={loadRequests}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {loadingRequests ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  Loading requests from StudentOS...
                </div>
              ) : requestsList.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-white/5">
                  No requests submitted yet for this school. Submit your first request above!
                </div>
              ) : (
                <div className="space-y-2.5">
                  {requestsList.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 sm:p-4 rounded-2xl bg-slate-950 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                              req.requestType === '3d'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            }`}
                          >
                            {req.requestType === '3d' ? '3D Model' : 'SVG Diagram'}
                          </span>
                          <span className="font-bold text-white text-sm">{req.topic}</span>
                          {req.urgency === 'urgent' && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold">
                              Urgent
                            </span>
                          )}
                        </div>

                        <p className="text-slate-400 text-[11px] line-clamp-1">{req.description}</p>

                        <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                          <span className="text-slate-300 font-medium">{req.subject}</span>
                          {req.grade && (
                            <>
                              <span>•</span>
                              <span>Class {req.grade}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>By {req.requesterName}</span>
                          <span>•</span>
                          <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Status Badge & Admin Status Updater */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isSuperAdmin ? (
                          <select
                            value={req.status}
                            onChange={(e) => handleUpdateStatus(req.id, e.target.value as any)}
                            className="text-xs bg-slate-900 border border-white/20 rounded-xl px-2.5 py-1.5 text-white font-bold cursor-pointer"
                          >
                            <option value="Requested">Requested</option>
                            <option value="Under Review">Under Review</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Ready">Ready</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                              req.status === 'Ready'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : req.status === 'In Progress'
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                : req.status === 'Under Review'
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                : req.status === 'Rejected'
                                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            {req.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
