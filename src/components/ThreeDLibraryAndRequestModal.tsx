/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Verified 3D Model Library, Request Form & Super Admin Panel
 * Features:
 * - Verified ready-made 3D models catalog
 * - Unavailable 3D model alert & Request 3D Model trigger
 * - Authenticated 3D Model Request Form (Topic, Subject, Description, Grade, Urgency)
 * - Super Admin 3D Request Management Panel
 */

import React, { useState, useEffect } from 'react';
import { Box, Sparkles, AlertTriangle, Send, CheckCircle2, ShieldAlert, Filter, Clock, FileText, X } from 'lucide-react';
import { Educational3DScene } from '../../server/whiteboardVisualEngine';

export interface ThreeDModelRequestItem {
  id: string;
  topic: string;
  subject: string;
  description: string;
  purpose: string;
  grade: string;
  urgency: 'normal' | 'urgent';
  requesterName: string;
  requesterRole: string;
  schoolId: string;
  schoolName: string;
  status: 'Requested' | 'Under Review' | 'In Progress' | 'Ready' | 'Rejected';
  createdDate: string;
  notes?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectVerifiedModel: (scene: Educational3DScene) => void;
  onFallbackTo2DSvg?: (query: string) => void;
  currentUser?: {
    name?: string;
    role?: string;
    school_id?: string;
    school_name?: string;
  };
  initialTopicQuery?: string;
  isUnavailableAlert?: boolean;
}

export const ThreeDLibraryAndRequestModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectVerifiedModel,
  onFallbackTo2DSvg,
  currentUser,
  initialTopicQuery = '',
  isUnavailableAlert = false
}) => {
  const [activeTab, setActiveTab] = useState<'library' | 'request' | 'admin'>(isUnavailableAlert ? 'request' : 'library');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Request Form State
  const [reqTopic, setReqTopic] = useState(initialTopicQuery);
  const [reqSubject, setReqSubject] = useState('Biology / Botany');
  const [reqDescription, setReqDescription] = useState('');
  const [reqPurpose, setReqPurpose] = useState('Classroom 3D Demonstration');
  const [reqGrade, setReqGrade] = useState('Grade 9-12');
  const [reqUrgency, setReqUrgency] = useState<'normal' | 'urgent'>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<string | null>(null);

  // Admin Requests List State
  const [adminRequests, setAdminRequests] = useState<ThreeDModelRequestItem[]>([]);
  const [adminFilter, setAdminFilter] = useState<'all' | 'urgent' | 'pending' | 'ready'>('all');
  const [loadingRequests, setLoadingRequests] = useState(false);

  useEffect(() => {
    if (initialTopicQuery) {
      setReqTopic(initialTopicQuery);
    }
  }, [initialTopicQuery]);

  useEffect(() => {
    if (isOpen && activeTab === 'admin') {
      fetchAdminRequests();
    }
  }, [isOpen, activeTab]);

  const fetchAdminRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await fetch('/api/3d-models/requests');
      const data = await res.json();
      if (data?.success && Array.isArray(data.requests)) {
        setAdminRequests(data.requests);
      }
    } catch (err) {
      console.error('Failed to fetch 3D model requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleStatusUpdate = async (id: string, nextStatus: ThreeDModelRequestItem['status']) => {
    try {
      const res = await fetch(`/api/3d-models/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        setAdminRequests(prev => prev.map(r => r.id === id ? { ...r, status: nextStatus } : r));
      }
    } catch (err) {
      console.error('Failed updating request status:', err);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTopic.trim()) return;

    setIsSubmitting(true);
    setSubmitFeedback(null);

    try {
      const res = await fetch('/api/3d-models/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: reqTopic,
          subject: reqSubject,
          description: reqDescription,
          purpose: reqPurpose,
          grade: reqGrade,
          urgency: reqUrgency,
          requesterName: currentUser?.name || 'Authenticated StudentOS User',
          requesterRole: currentUser?.role || 'Student',
          schoolId: currentUser?.school_id || 'school_demo_01',
          schoolName: currentUser?.school_name || 'StudentOS Academy'
        })
      });

      const data = await res.json();
      if (data?.success) {
        setSubmitFeedback('✅ 3D Model Request submitted successfully! Super Admin has been notified.');
        setTimeout(() => {
          setSubmitFeedback(null);
          setActiveTab('library');
        }, 2200);
      } else {
        setSubmitFeedback('⚠️ Could not submit request. Please try again.');
      }
    } catch {
      setSubmitFeedback('⚠️ Could not submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-slate-900 border border-indigo-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-scaleUp text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider font-display">StudentOS 3D Studio &amp; Model Hub</h3>
              <p className="text-[11px] text-slate-400 font-mono">Verified Ready-Made 3D Models &amp; Super Admin Request Workflow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-sm cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-slate-950 border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('library')}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'library'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              <span>Verified 3D Library</span>
            </button>
            <button
              onClick={() => setActiveTab('request')}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'request'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Request 3D Model</span>
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Super Admin Requests</span>
            </button>
          </div>

          {currentUser?.name && (
            <div className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-3 py-1 rounded-xl">
              👤 {currentUser.name} ({currentUser.role || 'Student'})
            </div>
          )}
        </div>

        {/* Unavailable Alert Banner if triggered */}
        {isUnavailableAlert && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-white block">This 3D model is not currently available in the verified library.</span>
                <span className="text-[11px] text-amber-300">You can submit a formal request to Super Admin or generate an accurate 2D SVG diagram.</span>
              </div>
            </div>
            {onFallbackTo2DSvg && initialTopicQuery && (
              <button
                onClick={() => {
                  onFallbackTo2DSvg(initialTopicQuery);
                  onClose();
                }}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-all cursor-pointer shrink-0"
              >
                Generate 2D SVG Instead
              </button>
            )}
          </div>
        )}

        {/* Body Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: Verified 3D Library */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search verified 3D models (DNA, Heart, Solar System, Meristematic Tissue...)"
                  className="px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 flex-1"
                />
                <div className="flex items-center gap-1.5 overflow-x-auto text-[10px] font-bold">
                  {['all', 'Botany', 'Genetics', 'Cell Biology', 'Anatomy', 'Physics', 'Astronomy'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                        selectedCategory === cat
                          ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50'
                          : 'bg-slate-950 text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    id: 'model_dna',
                    title: '🧬 3D DNA Double Helix & Base Pairs',
                    subject: 'Genetics',
                    desc: 'Antiparallel sugar-phosphate backbones with complementary A=T & G≡C base pairing.',
                    query: 'DNA Double Helix'
                  },
                  {
                    id: 'model_meristem',
                    title: '🌿 3D Meristematic Tissue Structure',
                    subject: 'Botany',
                    desc: 'Apical meristem dome, procambium strand, protoderm layer, and mitotic cells.',
                    query: 'Meristematic Tissue'
                  },
                  {
                    id: 'model_chloroplast',
                    title: '🍃 3D Chloroplast Ultrastructure',
                    subject: 'Cell Biology',
                    desc: 'Double envelope, stroma matrix, stacked thylakoid grana discs, and stroma lamellae.',
                    query: 'Chloroplast Ultrastructure'
                  },
                  {
                    id: 'model_heart',
                    title: '❤️ 3D Human Heart Anatomical Model',
                    subject: 'Anatomy',
                    desc: 'Left/Right Atria & Ventricles, Aorta, Pulmonary Artery, and Vena Cava.',
                    query: 'Human Heart'
                  },
                  {
                    id: 'model_solar',
                    title: '🪐 3D Heliocentric Solar System',
                    subject: 'Astronomy',
                    desc: 'Central Sun, orbital planes, and scale terrestrial & jovian planet models.',
                    query: 'Solar System'
                  },
                  {
                    id: 'model_mechanics',
                    title: '📐 3D Inclined Plane Forces',
                    subject: 'Physics',
                    desc: 'Wedge incline, sliding mass, gravity vector (mg), normal force (N), and friction.',
                    query: 'Inclined Plane Forces'
                  }
                ]
                  .filter(m => {
                    const matchCat = selectedCategory === 'all' || m.subject.toLowerCase() === selectedCategory.toLowerCase();
                    const matchQ = !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.desc.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchCat && matchQ;
                  })
                  .map(model => (
                    <div
                      key={model.id}
                      className="p-4 rounded-2xl bg-slate-950 border border-white/10 hover:border-indigo-500/50 transition-all space-y-2 flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-black text-white font-display group-hover:text-indigo-300 transition-colors">{model.title}</h4>
                          <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {model.subject}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{model.desc}</p>
                      </div>

                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch('/api/ai/whiteboard-3d', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ query: model.query })
                            });
                            const data = await res.json();
                            if (data?.success && data.scene) {
                              onSelectVerifiedModel(data.scene);
                              onClose();
                            }
                          } catch (err) {
                            console.error('Failed loading 3D model:', err);
                          }
                        }}
                        className="mt-3 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Load &amp; Render 3D Model</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 2: Request 3D Model Form */}
          {activeTab === 'request' && (
            <form onSubmit={handleFormSubmit} className="space-y-4 max-w-xl mx-auto">
              <div className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-1">
                <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>Submit Formal 3D Educational Model Request</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Can&apos;t find a specific anatomical, chemical, or physical model? Submit a detailed request directly to StudentOS Super Admin.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Model Topic / Subject Name *</label>
                <input
                  type="text"
                  required
                  value={reqTopic}
                  onChange={(e) => setReqTopic(e.target.value)}
                  placeholder="e.g. Meristematic Tissue, Nephron Glomerulus, Tectonic Subduction Zone"
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Academic Discipline</label>
                  <select
                    value={reqSubject}
                    onChange={(e) => setReqSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Botany / Plant Anatomy">Botany / Plant Anatomy</option>
                    <option value="Cell Biology">Cell Biology</option>
                    <option value="Human Physiology">Human Physiology</option>
                    <option value="Genetics">Genetics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Physics">Physics</option>
                    <option value="Astronomy">Astronomy</option>
                    <option value="Geography / Geology">Geography / Geology</option>
                    <option value="Mathematics">Mathematics</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Target Grade Level</label>
                  <input
                    type="text"
                    value={reqGrade}
                    onChange={(e) => setReqGrade(e.target.value)}
                    placeholder="e.g. Grade 9, Grade 11"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Educational Description &amp; Purpose</label>
                <textarea
                  rows={3}
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  placeholder="Describe specific key components, organelles, or interactions required in the 3D model..."
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Urgency Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">Urgency Level *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReqUrgency('normal')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      reqUrgency === 'normal'
                        ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/50'
                        : 'bg-slate-950 text-slate-400 border-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold">Standard Request</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Reviewed in standard Super Admin queue</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReqUrgency('urgent')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      reqUrgency === 'urgent'
                        ? 'bg-rose-500/20 text-rose-200 border-rose-500/60 shadow-lg shadow-rose-900/20'
                        : 'bg-slate-950 text-slate-400 border-white/10'
                    }`}
                  >
                    <div className="text-xs font-bold text-rose-400 flex items-center gap-1">
                      <span>🚨 URGENT Request</span>
                    </div>
                    <div className="text-[10px] opacity-80 mt-0.5">Priority flagged for immediate Super Admin review</div>
                  </button>
                </div>
              </div>

              {submitFeedback && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/40 text-xs font-bold text-indigo-300">
                  {submitFeedback}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !reqTopic.trim()}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white font-black uppercase tracking-wider text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Submitting Request...' : 'Submit 3D Model Request'}</span>
              </button>
            </form>
          )}

          {/* TAB 3: Super Admin Requests Management Panel */}
          {activeTab === 'admin' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Super Admin 3D Request Management Queue</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">Review teacher/student requests, prioritize urgent models, and update status.</p>
                </div>
                <button
                  onClick={fetchAdminRequests}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-all cursor-pointer"
                >
                  Refresh Queue
                </button>
              </div>

              {loadingRequests ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading request queue...</div>
              ) : adminRequests.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No active 3D model requests.</div>
              ) : (
                <div className="space-y-3">
                  {adminRequests.map(req => (
                    <div
                      key={req.id}
                      className={`p-4 rounded-2xl bg-slate-950 border transition-all space-y-3 ${
                        req.urgency === 'urgent' ? 'border-rose-500/50 bg-rose-950/10' : 'border-white/10'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-black text-white">{req.topic}</h5>
                          {req.urgency === 'urgent' && (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              🚨 URGENT
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-800 text-slate-300 border border-white/10">
                            {req.subject}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[10px] text-slate-400 font-mono">Status:</span>
                          <select
                            value={req.status}
                            onChange={(e) => handleStatusUpdate(req.id, e.target.value as any)}
                            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-white/20 text-xs font-bold text-indigo-300 focus:outline-none"
                          >
                            <option value="Requested">Requested</option>
                            <option value="Under Review">Under Review</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Ready">Ready</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>
                      </div>

                      {req.description && (
                        <p className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                          {req.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
                        <span>Requester: {req.requesterName} ({req.requesterRole}) • {req.schoolName}</span>
                        <span>Date: {new Date(req.createdDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
