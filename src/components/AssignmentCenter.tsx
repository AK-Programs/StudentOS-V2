import React, { useState } from 'react';
import { AssignmentUploadForm } from './AssignmentUploadForm';
import { ResourceCategory } from '../types';
import { uploadFileToStorage } from '../lib/storageHelper';
import { Sparkles, FileCheck, HelpCircle, Loader2 } from 'lucide-react';

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
  const [hwTitle, setHwTitle] = useState('Newton\'s Laws Analysis');
  const [hwSubmission, setHwSubmission] = useState('');
  const [hwResult, setHwResult] = useState('');
  const [hwLoading, setHwLoading] = useState(false);

  const handleGenerateQuestions = async () => {
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
    } catch (err: any) {
      setQResult('Error generating questions: ' + err.message);
    } finally {
      setQLoading(false);
    }
  };

  const handleCheckHomework = async () => {
    if (!hwSubmission.trim()) return;
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
    } catch (err: any) {
      setHwResult('Error reviewing homework: ' + err.message);
    } finally {
      setHwLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>📚</span> Resource & Assessment Center
          </h2>
          <p className="text-xs text-slate-400">Upload materials, auto-generate question papers, and run AI homework checks.</p>
        </div>
        
        <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-white/10 overflow-x-auto scrollbar-none w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-2 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition-all ${activeTab === 'upload' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Upload Center
          </button>
          <button
            onClick={() => setActiveTab('qgen')}
            className={`px-3 py-2 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${activeTab === 'qgen' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-teal-400" /> AI Question Generator
          </button>
          <button
            onClick={() => setActiveTab('checker')}
            className={`px-3 py-2 rounded-lg font-bold text-xs whitespace-nowrap shrink-0 transition-all flex items-center gap-1.5 ${activeTab === 'checker' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            <FileCheck className="w-3.5 h-3.5 text-amber-400" /> AI Homework Checker
          </button>
        </div>
      </div>

      {activeTab === 'upload' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button onClick={() => setActiveUploadType('assignment')} className={`px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 ${activeUploadType === 'assignment' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400'}`}>Assignment</button>
            <button onClick={() => setActiveUploadType('timetable')} className={`px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 ${activeUploadType === 'timetable' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400'}`}>Timetable</button>
            <button onClick={() => setActiveUploadType('worksheet')} className={`px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 ${activeUploadType === 'worksheet' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400'}`}>Worksheet</button>
            <button onClick={() => setActiveUploadType('gallery')} className={`px-3.5 sm:px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap shrink-0 ${activeUploadType === 'gallery' ? 'bg-indigo-600 text-white shadow' : 'bg-slate-800 text-slate-400'}`}>Photo Gallery</button>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="p-4 sm:p-6 bg-slate-900 border border-white/10 rounded-2xl">
              <h3 className="text-base sm:text-lg text-white font-bold capitalize mb-1">Upload {activeUploadType}</h3>
              <p className="text-xs text-slate-400 mb-4">Master template file storage & database registration.</p>
              <AssignmentUploadForm key={activeUploadType} category={activeUploadType} onSuccess={() => {}} />
            </div>
          </div>
        </>
      )}

      {activeTab === 'qgen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-slate-900 border border-white/10 p-4 sm:p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" /> Assessment Parameters
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Subject</label>
              <input
                type="text"
                value={qSubject}
                onChange={(e) => setQSubject(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Grade / Class</label>
              <select
                value={qGrade}
                onChange={(e) => setQGrade(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="Grade 8">Grade 8</option>
                <option value="Grade 9">Grade 9</option>
                <option value="Grade 10">Grade 10</option>
                <option value="Grade 11">Grade 11</option>
                <option value="Grade 12">Grade 12</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Difficulty</label>
              <select
                value={qDifficulty}
                onChange={(e) => setQDifficulty(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard / Competitive</option>
                <option value="HOTS Special">HOTS & Olympiad Level</option>
              </select>
            </div>

            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-200">
              Includes: MCQs, HOTS, 1-Mark, 2-Mark, 5-Mark, Case Study, Assertion-Reason, and True/False with Answer Keys.
            </div>

            <button
              onClick={handleGenerateQuestions}
              disabled={qLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow"
            >
              {qLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Question Paper
            </button>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-white/10 p-4 sm:p-5 rounded-2xl flex flex-col min-h-[320px] sm:min-h-[400px]">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>📝</span> Generated Test Paper & Answer Key
            </h4>
            <div className="flex-1 bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-white/5 overflow-auto font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {qLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-12">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Orion AI authoring exam questions...</p>
                </div>
              ) : qResult ? (
                qResult
              ) : (
                <div className="text-center py-16 text-slate-500">
                  Select parameters and click "Generate Question Paper" to construct an automated test sheet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checker' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-slate-900 border border-white/10 p-4 sm:p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <FileCheck className="w-4 h-4" /> Homework Submission Input
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Homework / Essay Title</label>
              <input
                type="text"
                value={hwTitle}
                onChange={(e) => setHwTitle(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Paste Student Submission Text</label>
              <textarea
                value={hwSubmission}
                onChange={(e) => setHwSubmission(e.target.value)}
                placeholder="Paste homework text or essay submission here..."
                rows={8}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <button
              onClick={handleCheckHomework}
              disabled={hwLoading || !hwSubmission.trim()}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow"
            >
              {hwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Run AI Grammar, Logic & Plagiarism Check
            </button>
          </div>

          <div className="bg-slate-900 border border-white/10 p-4 sm:p-5 rounded-2xl flex flex-col min-h-[320px] sm:min-h-[400px]">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>🔍</span> Orion AI Review Report
            </h4>
            <div className="flex-1 bg-slate-950 p-3.5 sm:p-4 rounded-xl border border-white/5 overflow-auto font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
              {hwLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 py-12">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Checking grammar, logic steps & plagiarism score...</p>
                </div>
              ) : hwResult ? (
                hwResult
              ) : (
                <div className="text-center py-16 text-slate-500">
                  Paste submission text on the left and click check to get instant AI grading feedback.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
