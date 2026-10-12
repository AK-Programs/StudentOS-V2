import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AssignmentUploadForm } from './AssignmentUploadForm';
import { ResourceCategory } from '../types';
import { Sparkles, FileCheck, HelpCircle, Loader2, Upload, BookOpen, Calendar, FileText, Image as ImageIcon } from 'lucide-react';
import { soundService } from '../lib/soundService';
import {
  FloatingTabs,
  CardSpotlight,
  ShimmerButton,
  BorderBeam
} from './ui/animatedComponents';

export const AssignmentCenter: React.FC = () => {
  const [activeUploadType, setActiveUploadType] = useState<ResourceCategory>('assignment');
  const [activeTab, setActiveTab] = useState<'upload' | 'qgen' | 'checker'>('upload');

  // AI Question Generator State
  const [qSubject, setQSubject] = useState('Physics');
  const [qGrade, setQGrade] = useState('Grade 10');
  const [qDifficulty, setQDifficulty] = useState('Medium');
  const [qResult, setQResult] = useState('');
  const [qLoading, setQLoading] = useState(false);

  // AI Homework Checker State
  const [hwTitle, setHwTitle] = useState("Newton's Laws Analysis");
  const [hwSubmission, setHwSubmission] = useState('');
  const [hwResult, setHwResult] = useState('');
  const [hwLoading, setHwLoading] = useState(false);

  const handleGenerateQuestions = async () => {
    soundService.playButtonClick();
    setQLoading(true);
    setQResult('');
    try {
      const response = await fetch('/api/ai/question-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: qSubject,
          grade: qGrade,
          difficulty: qDifficulty,
          questionTypes: ['MCQ', 'HOTS', '1 mark', '2 marks', '5 marks', 'Case Study', 'Assertion Reason', 'True False']
        })
      });
      const data = await response.json();
      setQResult(data.text || 'Questions generated successfully.');
      soundService.playCorrectAnswer();
    } catch (err: any) {
      setQResult('Error generating questions: ' + err.message);
    } finally {
      setQLoading(false);
    }
  };

  const handleCheckHomework = async () => {
    if (!hwSubmission.trim()) return;
    soundService.playButtonClick();
    setHwLoading(true);
    setHwResult('');
    try {
      const response = await fetch('/api/ai/homework-checker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: hwTitle,
          submissionText: hwSubmission,
          rubric: 'Grammar, Logic, Formatting, Plagiarism Check & Step Reasoning'
        })
      });
      const data = await response.json();
      setHwResult(data.text || 'Review complete.');
      soundService.playCorrectAnswer();
    } catch (err: any) {
      setHwResult('Error reviewing homework: ' + err.message);
    } finally {
      setHwLoading(false);
    }
  };

  const uploadTypes: { id: ResourceCategory; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'assignment', label: 'Assignment', icon: <BookOpen className="w-4 h-4" />, desc: 'Class assignments & project briefs' },
    { id: 'worksheet', label: 'Worksheet', icon: <FileText className="w-4 h-4" />, desc: 'Practice problem sets & revision sheets' },
    { id: 'timetable', label: 'Timetable', icon: <Calendar className="w-4 h-4" />, desc: 'Section schedules & exam datesheets' },
    { id: 'gallery', label: 'Photo Gallery', icon: <ImageIcon className="w-4 h-4" />, desc: 'Campus events & classroom highlights' }
  ];

  const tabsConfig = [
    { id: 'upload', label: 'Upload Center', icon: <Upload className="w-3.5 h-3.5" /> },
    { id: 'qgen', label: 'Question Generator', icon: <HelpCircle className="w-3.5 h-3.5 text-teal-400" /> },
    { id: 'checker', label: 'Homework Checker', icon: <FileCheck className="w-3.5 h-3.5 text-amber-400" /> }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      <div className="bento-card rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold">
            <span>Academic Resource Suite</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">Faculty & Student Tools</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black font-display text-white tracking-tight">
            Resource & Assessment Center
          </h2>
          <p className="text-xs text-slate-400">
            Publish class resources, generate structured exam papers, and evaluate submissions.
          </p>
        </div>

        <FloatingTabs
          tabs={tabsConfig}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as any)}
        />
      </div>

      {activeTab === 'upload' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {uploadTypes.map((item) => {
              const selected = activeUploadType === item.id;
              return (
                <CardSpotlight
                  key={item.id}
                  onClick={() => {
                    soundService.playButtonClick();
                    setActiveUploadType(item.id);
                  }}
                  className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                    selected
                      ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-md'
                      : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <span className={selected ? 'text-indigo-400' : 'text-slate-400'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{item.desc}</p>
                </CardSpotlight>
              );
            })}
          </div>

          <div className="bento-card p-5 sm:p-6 rounded-3xl relative overflow-hidden">
            <div className="mb-4 pb-3 border-b border-white/10">
              <h3 className="text-base sm:text-lg text-white font-bold capitalize">
                Upload {activeUploadType}
              </h3>
              <p className="text-xs text-slate-400">
                Files are stored in school cloud storage and indexed for authorized classes.
              </p>
            </div>
            <AssignmentUploadForm key={activeUploadType} category={activeUploadType} onSuccess={() => {}} />
          </div>
        </div>
      )}

      {activeTab === 'qgen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="bento-card p-5 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm border-b border-white/10 pb-3">
              <Sparkles className="w-4 h-4" />
              <span>Assessment Parameters</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
              <input
                type="text"
                value={qSubject}
                onChange={(e) => setQSubject(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Grade / Class</label>
              <select
                value={qGrade}
                onChange={(e) => setQGrade(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Difficulty Level</label>
              <select
                value={qDifficulty}
                onChange={(e) => setQDifficulty(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Easy">Foundational / Easy</option>
                <option value="Medium">Standard / Medium</option>
                <option value="Hard">Advanced / Competitive</option>
                <option value="HOTS Special">HOTS & Olympiad Level</option>
              </select>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Generates a structured test paper with MCQs, short-answer, long-answer, case study questions, and a complete marking scheme.
            </p>

            <ShimmerButton
              onClick={handleGenerateQuestions}
              disabled={qLoading}
              className="w-full py-2.5 text-xs font-bold"
            >
              {qLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{qLoading ? 'Generating Questions...' : 'Generate Question Paper'}</span>
            </ShimmerButton>
          </div>

          <div className="lg:col-span-2 bento-card p-5 rounded-3xl flex flex-col min-h-[360px] relative overflow-hidden">
            {qLoading && <BorderBeam size={160} duration={8} colorFrom="#14b8a6" colorTo="#6366f1" />}
            <h4 className="text-sm font-bold text-white mb-3 border-b border-white/10 pb-3">
              Generated Test Paper & Answer Key
            </h4>
            <div className="flex-1 bg-slate-950/80 p-4 rounded-2xl border border-white/5 overflow-auto font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {qLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-12">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Preparing structured exam questions...</p>
                </div>
              ) : qResult ? (
                qResult
              ) : (
                <div className="text-center py-16 text-slate-400 space-y-1">
                  <p className="text-xs font-semibold text-slate-300">No question paper generated yet</p>
                  <p className="text-[11px] text-slate-500">
                    Select subject, grade, and difficulty on the left, then click Generate Question Paper.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checker' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bento-card p-5 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm border-b border-white/10 pb-3">
              <FileCheck className="w-4 h-4" />
              <span>Homework Submission Input</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assignment / Essay Title</label>
              <input
                type="text"
                value={hwTitle}
                onChange={(e) => setHwTitle(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Student Submission Text</label>
              <textarea
                value={hwSubmission}
                onChange={(e) => setHwSubmission(e.target.value)}
                placeholder="Paste homework response or essay text here for rubric evaluation..."
                rows={8}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <ShimmerButton
              onClick={handleCheckHomework}
              disabled={hwLoading || !hwSubmission.trim()}
              background="rgba(217, 119, 6, 0.95)"
              className="w-full py-2.5 text-xs font-bold"
            >
              {hwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{hwLoading ? 'Evaluating Submission...' : 'Evaluate Submission'}</span>
            </ShimmerButton>
          </div>

          <div className="lg:col-span-1 bento-card p-5 rounded-3xl flex flex-col min-h-[360px] relative overflow-hidden">
            {hwLoading && <BorderBeam size={160} duration={8} colorFrom="#f59e0b" colorTo="#ef4444" />}
            <h4 className="text-sm font-bold text-white mb-3 border-b border-white/10 pb-3">
              Evaluation & Rubric Report
            </h4>
            <div className="flex-1 bg-slate-950/80 p-4 rounded-2xl border border-white/5 overflow-auto font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {hwLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-12">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Reviewing reasoning, clarity, and structure...</p>
                </div>
              ) : hwResult ? (
                hwResult
              ) : (
                <div className="text-center py-16 text-slate-400 space-y-1">
                  <p className="text-xs font-semibold text-slate-300">Ready for submission review</p>
                  <p className="text-[11px] text-slate-500">
                    Paste student work on the left and click Evaluate Submission to generate constructive feedback.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
