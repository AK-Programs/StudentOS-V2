import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity, AlertCircle, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck,
  FileCheck, FileText, FolderKanban, GraduationCap, Loader2, NotebookPen,
  Plus, RefreshCw, Save, Sparkles, Target, Upload, Users, Wand2
} from 'lucide-react';
import { AssignmentUploadForm } from './AssignmentUploadForm';
import { ResourceCategory, UserProfile, Homework, AssignmentSubmission } from '../types';
import { soundService } from '../lib/soundService';
import { VeylentraIcon } from './ui/VeylentraIcon';
import { getServerAuthHeaders, extractApiErrorMessage } from '../lib/clientSession';
import {
  fetchAssignments,
  fetchAssignmentSubmissions,
  evaluateAssignmentSubmission,
  saveAssignment
} from '../lib/academicWorkflowService';

type AssignmentCenterTab =
  | 'upload' | 'qgen' | 'checker' | 'notebook' | 'builder'
  | 'submissions' | 'completion' | 'quality' | 'groups';

interface AssignmentCenterProps {
  currentUser?: UserProfile | null;
  effectiveRole?: string;
  showNotification?: (message: string) => void;
}

const tabItems: { id: AssignmentCenterTab; label: string; icon: React.ReactNode }[] = [
  { id: 'upload', label: 'Upload Center', icon: <Upload className="w-4 h-4" /> },
  { id: 'qgen', label: 'Question Generator', icon: <Wand2 className="w-4 h-4" /> },
  { id: 'checker', label: 'Homework Checker', icon: <FileCheck className="w-4 h-4" /> },
  { id: 'notebook', label: 'Notebook Intelligence', icon: <NotebookPen className="w-4 h-4" /> },
  { id: 'builder', label: 'AI Assignment Builder', icon: <Sparkles className="w-4 h-4" /> },
  { id: 'submissions', label: 'Submissions', icon: <ClipboardCheck className="w-4 h-4" /> },
  { id: 'completion', label: 'Notebook Reports', icon: <Activity className="w-4 h-4" /> },
  { id: 'quality', label: 'Quality Analyzer', icon: <Target className="w-4 h-4" /> },
  { id: 'groups', label: 'Group Projects', icon: <FolderKanban className="w-4 h-4" /> },
];

const inputClass = 'w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none';
const labelClass = 'mb-1.5 block text-[11px] font-semibold text-slate-300';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50';
const panelClass = 'bento-card rounded-2xl border border-white/5 p-4 sm:p-5';

export const AssignmentCenter: React.FC<AssignmentCenterProps> = ({ currentUser, effectiveRole, showNotification }) => {
  const [activeUploadType, setActiveUploadType] = useState<ResourceCategory>('assignment');
  const [activeTab, setActiveTab] = useState<AssignmentCenterTab>('upload');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');

  // Keep the original Question Generator feature.
  const [qSubject, setQSubject] = useState('Physics');
  const [qGrade, setQGrade] = useState('Grade 10');
  const [qDifficulty, setQDifficulty] = useState('Medium');
  const [qResult, setQResult] = useState('');

  // Keep the original Homework Checker feature.
  const [hwTitle, setHwTitle] = useState("Newton's Laws Analysis");
  const [hwSubmission, setHwSubmission] = useState('');
  const [hwResult, setHwResult] = useState('');

  // Notebook Intelligence and completion-report inputs.
  const [notebookSubject, setNotebookSubject] = useState('Physics');
  const [notebookText, setNotebookText] = useState('');
  const [completionText, setCompletionText] = useState('');
  const [completionTitle, setCompletionTitle] = useState('Notebook Completion Review');
  const [notebookResult, setNotebookResult] = useState('');
  const [completionResult, setCompletionResult] = useState('');

  // Assignment Builder and Quality Analyzer.
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderSubject, setBuilderSubject] = useState('Science');
  const [builderGrade, setBuilderGrade] = useState('Grade 10');
  const [builderDifficulty, setBuilderDifficulty] = useState('Medium');
  const [builderInstructions, setBuilderInstructions] = useState('Include learning objectives, clear task instructions, a balanced set of questions, expected deliverables, and a marking rubric.');
  const [builderResult, setBuilderResult] = useState('');
  const [builderDueDate, setBuilderDueDate] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [qualityTitle, setQualityTitle] = useState('Assignment Brief');
  const [qualityText, setQualityText] = useState('');
  const [qualityResult, setQualityResult] = useState('');

  // Real Submissions management data through the existing academic workflow API.
  const [assignments, setAssignments] = useState<Array<Homework & { stats?: any }>>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<AssignmentSubmission | null>(null);
  const [submissionScore, setSubmissionScore] = useState('');
  const [submissionFeedback, setSubmissionFeedback] = useState('');
  const [releaseResults, setReleaseResults] = useState(true);

  // Group projects are stored as normal assignments through the existing secure workflow,
  // so they appear in existing Homework and Assignment views without a parallel datastore.
  const [groupTitle, setGroupTitle] = useState('Collaborative Research Project');
  const [groupSubject, setGroupSubject] = useState('Science');
  const [groupGrade, setGroupGrade] = useState('Grade 10');
  const [groupName, setGroupName] = useState('Project Team');
  const [groupMembers, setGroupMembers] = useState('Member 1\nMember 2\nMember 3');
  const [groupDueDate, setGroupDueDate] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [groupResult, setGroupResult] = useState('');

  const role = String(effectiveRole || currentUser?.role || '').toLowerCase();
  const isFaculty = ['teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(role);
  const selectedAssignment = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId]
  );

  const notify = useCallback((message: string) => showNotification?.(message), [showNotification]);

  const runAiTool = useCallback(async (action: string, payload: Record<string, any>) => {
    setAiBusy(true);
    setAiError('');
    try {
      const headers = await getServerAuthHeaders();
      const response = await fetch('/api/ai/assignment-tools', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || typeof data.text !== 'string') {
        throw new Error(extractApiErrorMessage(data, `AI request failed (HTTP ${response.status}).`));
      }
      return data.text as string;
    } catch (error: any) {
      const message = error?.message || 'Assignment Center AI request failed.';
      setAiError(message);
      notify(message);
      throw error;
    } finally {
      setAiBusy(false);
    }
  }, [notify]);

  const refreshAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const result = await fetchAssignments(currentUser);
      if (!result.ok) throw new Error(result.error || 'Could not load assignments.');
      const rows = result.data || [];
      setAssignments(rows);
      setSelectedAssignmentId((current) => current && rows.some((item) => item.id === current) ? current : (rows[0]?.id || ''));
    } catch (error: any) {
      notify(error?.message || 'Could not load assignments.');
    } finally {
      setAssignmentsLoading(false);
    }
  }, [currentUser, notify]);

  useEffect(() => {
    void refreshAssignments();
  }, [refreshAssignments]);

  const refreshSubmissions = useCallback(async (assignmentId: string) => {
    if (!assignmentId) {
      setSubmissions([]);
      setSelectedSubmission(null);
      return;
    }
    setSubmissionsLoading(true);
    try {
      const result = await fetchAssignmentSubmissions(currentUser, assignmentId);
      if (!result.ok) throw new Error(result.error || 'Could not load submissions.');
      const rows = result.data || [];
      setSubmissions(rows);
      setSelectedSubmission((current) => current ? rows.find((row) => row.studentId === current.studentId) || null : (rows[0] || null));
    } catch (error: any) {
      notify(error?.message || 'Could not load submissions.');
    } finally {
      setSubmissionsLoading(false);
    }
  }, [currentUser, notify]);

  useEffect(() => {
    if (activeTab === 'submissions' && selectedAssignmentId) void refreshSubmissions(selectedAssignmentId);
  }, [activeTab, selectedAssignmentId, refreshSubmissions]);

  const handleGenerateQuestions = async () => {
    soundService.playButtonClick();
    setQResult('');
    try {
      const text = await runAiTool('question_generator', {
        subject: qSubject,
        grade: qGrade,
        difficulty: qDifficulty,
        questionTypes: ['MCQ', 'HOTS', '1 mark', '2 marks', '5 marks', 'Case Study', 'Assertion Reason', 'True False'],
      });
      setQResult(text);
      soundService.playCorrectAnswer();
    } catch { setQResult(''); }
  };

  const handleCheckHomework = async () => {
    if (!hwSubmission.trim()) return;
    soundService.playButtonClick();
    setHwResult('');
    try {
      const text = await runAiTool('homework_checker', {
        title: hwTitle,
        subject: 'General',
        content: hwSubmission,
        instructions: 'Review correctness, reasoning, completeness, clarity, and presentation. Give constructive feedback; do not claim to run an external plagiarism check.',
      });
      setHwResult(text);
      soundService.playCorrectAnswer();
    } catch { setHwResult(''); }
  };

  const handleNotebookIntelligence = async () => {
    if (!notebookText.trim()) return;
    setNotebookResult('');
    try {
      setNotebookResult(await runAiTool('notebook_intelligence', { subject: notebookSubject, grade: builderGrade, content: notebookText }));
    } catch { setNotebookResult(''); }
  };

  const handleNotebookCompletion = async () => {
    if (!completionText.trim()) return;
    setCompletionResult('');
    try {
      setCompletionResult(await runAiTool('notebook_completion_report', { title: completionTitle, content: completionText, subject: notebookSubject }));
    } catch { setCompletionResult(''); }
  };

  const handleBuildAssignment = async () => {
    if (!builderTitle.trim()) {
      notify('Enter an assignment title or topic first.');
      return;
    }
    setBuilderResult('');
    try {
      setBuilderResult(await runAiTool('assignment_builder', {
        title: builderTitle,
        subject: builderSubject,
        grade: builderGrade,
        difficulty: builderDifficulty,
        instructions: builderInstructions,
      }));
    } catch { setBuilderResult(''); }
  };

  const saveGeneratedAssignment = async (status: 'draft' | 'published' = 'draft') => {
    if (!builderTitle.trim() || !builderResult.trim()) return;
    const result = await saveAssignment(currentUser, {
      id: `hw-${Date.now()}`,
      title: builderTitle.trim(),
      subject: builderSubject,
      content: builderResult,
      classGrade: builderGrade,
      classSection: 'All Sections',
      dueDate: builderDueDate,
      givenBy: currentUser?.name || 'Faculty',
      teacherId: currentUser?.uid || '',
      status,
      maxScore: 100,
      allowLate: true,
      submissionRequirements: 'text_or_link',
      createdAt: new Date().toISOString(),
      completedList: [],
    }, true);
    if (!result.ok) {
      notify(result.error || 'Could not save the generated assignment.');
      return;
    }
    notify(status === 'published' ? 'Assignment published.' : 'Assignment saved as a draft.');
    await refreshAssignments();
  };

  const handleAnalyzeQuality = async () => {
    if (!qualityText.trim()) return;
    setQualityResult('');
    try {
      setQualityResult(await runAiTool('quality_analyzer', { title: qualityTitle, content: qualityText, subject: builderSubject, grade: builderGrade }));
    } catch { setQualityResult(''); }
  };

  const handlePlanGroupProject = async () => {
    if (!groupTitle.trim()) return;
    setGroupResult('');
    try {
      setGroupResult(await runAiTool('group_project_planner', {
        title: groupTitle,
        subject: groupSubject,
        grade: groupGrade,
        groupName,
        members: groupMembers.split('\n').map((value) => value.trim()).filter(Boolean),
      }));
    } catch { setGroupResult(''); }
  };

  const saveGroupProject = async () => {
    if (!groupResult.trim()) return;
    const memberLines = groupMembers.split('\n').map((value) => value.trim()).filter(Boolean).map((name) => `- ${name}`).join('\n');
    const projectContent = `# ${groupName}\n\n## Team Members\n${memberLines || '- Members to be assigned'}\n\n## AI Project Plan\n\n${groupResult}`;
    const result = await saveAssignment(currentUser, {
      id: `group-project-${Date.now()}`,
      title: `Group Project: ${groupTitle}`,
      subject: groupSubject,
      content: projectContent,
      classGrade: groupGrade,
      classSection: 'All Sections',
      dueDate: groupDueDate,
      givenBy: currentUser?.name || 'Faculty',
      teacherId: currentUser?.uid || '',
      status: 'draft',
      maxScore: 100,
      allowLate: true,
      submissionRequirements: 'text_or_link',
      createdAt: new Date().toISOString(),
      completedList: [],
    }, true);
    if (!result.ok) {
      notify(result.error || 'Could not save group project.');
      return;
    }
    notify('Group project saved as a draft in the existing Assignment workflow.');
    await refreshAssignments();
  };

  const handleEvaluateSubmission = async (action: 'evaluate' | 'return_for_revision' = 'evaluate') => {
    if (!selectedAssignmentId || !selectedSubmission) return;
    const result = await evaluateAssignmentSubmission(currentUser, selectedAssignmentId, {
      studentId: selectedSubmission.studentId,
      studentName: selectedSubmission.studentName,
      score: submissionScore === '' ? null : Number(submissionScore),
      maxScore: Number(selectedAssignment?.maxScore || 100),
      feedback: submissionFeedback,
      action,
      resultsReleased: releaseResults,
    });
    if (!result.ok) {
      notify(result.error || 'Could not update the submission.');
      return;
    }
    notify(action === 'evaluate' ? 'Submission evaluated.' : 'Submission returned for revision.');
    await refreshSubmissions(selectedAssignmentId);
  };

  const uploadTypes: { id: ResourceCategory; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: 'assignment', label: 'Assignment', icon: <BookOpen className="h-4 w-4" />, desc: 'Class assignments & project briefs' },
    { id: 'worksheet', label: 'Worksheet', icon: <FileText className="h-4 w-4" />, desc: 'Practice & revision sheets' },
    { id: 'homework', label: 'Homework', icon: <CalendarDays className="h-4 w-4" />, desc: 'Daily tasks & lesson work' },
    { id: 'material', label: 'Material', icon: <GraduationCap className="h-4 w-4" />, desc: 'Reference learning resources' },
  ];

  const resultPanel = (title: string, content: string, loadingLabel: string) => (
    <div className={`${panelClass} flex min-h-[260px] flex-col`}>
      <h3 className="mb-3 flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-white">
        <Sparkles className="h-4 w-4 text-indigo-400" /> {title}
      </h3>
      <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-200">
        {aiBusy ? <div className="flex h-full flex-col items-center justify-center gap-2 py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin text-indigo-400" /><span>{loadingLabel}</span></div> : content || <span className="text-slate-500">Your result will appear here.</span>}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">Assignment Center</h2>
          <p className="mt-1 text-xs text-slate-400">Upload, create, assess, and track coursework using the existing academic workflow.</p>
        </div>
        <button type="button" onClick={() => { void refreshAssignments(); }} disabled={assignmentsLoading} className="rounded-xl border border-white/10 bg-slate-900 p-2.5 text-slate-300 hover:text-white disabled:opacity-50" title="Refresh assignments">
          <RefreshCw className={`h-4 w-4 ${assignmentsLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabItems.map((item) => (
          <button key={item.id} type="button" onClick={() => { soundService.playButtonClick(); setActiveTab(item.id); setAiError(''); }} className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-[11px] font-bold transition-colors ${activeTab === item.id ? 'border-indigo-500/50 bg-indigo-600/20 text-indigo-200' : 'border-white/10 bg-slate-900/70 text-slate-400 hover:text-white'}`}>
            {item.icon}<span>{item.label}</span>
          </button>
        ))}
      </div>

      {aiError && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{aiError}</div>}

      {activeTab === 'upload' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {uploadTypes.map((item) => (
              <button key={item.id} type="button" onClick={() => setActiveUploadType(item.id)} className={`rounded-xl border p-3.5 text-left transition-colors ${activeUploadType === item.id ? 'border-blue-500/50 bg-blue-600/15 text-white' : 'border-white/10 bg-slate-900/70 text-slate-300 hover:border-white/25'}`}>
                <div className="flex items-center gap-2 text-xs font-bold"><span className="text-blue-300">{item.icon}</span>{item.label}</div>
                <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">{item.desc}</p>
              </button>
            ))}
          </div>
          <div className={`${panelClass} space-y-4`}>
            <div className="border-b border-white/10 pb-3"><h3 className="text-base font-bold capitalize text-white">Upload {activeUploadType}</h3><p className="mt-1 text-xs text-slate-400">Files continue to use the existing school resource storage flow.</p></div>
            <AssignmentUploadForm key={activeUploadType} category={activeUploadType} onSuccess={() => { notify('Resource upload completed.'); }} />
          </div>
        </div>
      )}

      {activeTab === 'qgen' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-blue-300"><VeylentraIcon name="exam" size="xs" />Assessment Parameters</div>
            <label className="block"><span className={labelClass}>Subject</span><input className={inputClass} value={qSubject} onChange={(event) => setQSubject(event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Grade / Class</span><select className={inputClass} value={qGrade} onChange={(event) => setQGrade(event.target.value)}>{['Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map((grade) => <option key={grade}>{grade}</option>)}</select></label>
            <label className="block"><span className={labelClass}>Difficulty</span><select className={inputClass} value={qDifficulty} onChange={(event) => setQDifficulty(event.target.value)}>{['Easy', 'Medium', 'Hard', 'HOTS Special'].map((level) => <option key={level}>{level}</option>)}</select></label>
            <button type="button" onClick={handleGenerateQuestions} disabled={aiBusy} className={`${primaryButton} w-full`}><Wand2 className="h-4 w-4" />Generate Question Paper</button>
          </div>
          <div className="lg:col-span-2">{resultPanel('Generated Test Paper & Answer Key', qResult, 'Preparing the assessment and marking scheme…')}</div>
        </div>
      )}

      {activeTab === 'checker' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-amber-300"><FileCheck className="h-4 w-4" />Homework Submission Review</div>
            <label className="block"><span className={labelClass}>Assignment Title</span><input className={inputClass} value={hwTitle} onChange={(event) => setHwTitle(event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Submission Text</span><textarea className={`${inputClass} min-h-48 resize-y`} value={hwSubmission} onChange={(event) => setHwSubmission(event.target.value)} placeholder="Paste the student's response or essay for constructive review…" /></label>
            <button type="button" onClick={handleCheckHomework} disabled={aiBusy || !hwSubmission.trim()} className={`${primaryButton} w-full bg-amber-600 hover:bg-amber-500`}><FileCheck className="h-4 w-4" />Evaluate Submission</button>
          </div>
          {resultPanel('Evaluation & Rubric Report', hwResult, 'Reviewing correctness, reasoning, and completeness…')}
        </div>
      )}

      {activeTab === 'notebook' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-cyan-300"><NotebookPen className="h-4 w-4" />Notebook Intelligence</div>
            <label className="block"><span className={labelClass}>Subject</span><input className={inputClass} value={notebookSubject} onChange={(event) => setNotebookSubject(event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Notebook content / OCR text</span><textarea className={`${inputClass} min-h-56 resize-y`} value={notebookText} onChange={(event) => setNotebookText(event.target.value)} placeholder="Paste notebook text or extracted notes here. The report only evaluates supplied evidence." /></label>
            <button type="button" onClick={handleNotebookIntelligence} disabled={aiBusy || !notebookText.trim()} className={`${primaryButton} w-full`}><Sparkles className="h-4 w-4" />Analyze Notebook</button>
          </div>
          {resultPanel('Notebook Intelligence Report', notebookResult, 'Mapping topics, concepts, definitions, and gaps…')}
        </div>
      )}

      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-indigo-300"><Sparkles className="h-4 w-4" />AI Assignment Builder</div>
            <label className="block"><span className={labelClass}>Assignment title / topic</span><input className={inputClass} value={builderTitle} onChange={(event) => setBuilderTitle(event.target.value)} placeholder="e.g. Energy transformations project" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={labelClass}>Subject</span><input className={inputClass} value={builderSubject} onChange={(event) => setBuilderSubject(event.target.value)} /></label>
              <label className="block"><span className={labelClass}>Grade</span><select className={inputClass} value={builderGrade} onChange={(event) => setBuilderGrade(event.target.value)}>{Array.from({ length: 5 }, (_, i) => `Grade ${i + 8}`).map((grade) => <option key={grade}>{grade}</option>)}</select></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={labelClass}>Difficulty</span><select className={inputClass} value={builderDifficulty} onChange={(event) => setBuilderDifficulty(event.target.value)}>{['Foundational', 'Medium', 'Advanced'].map((level) => <option key={level}>{level}</option>)}</select></label>
              <label className="block"><span className={labelClass}>Due date</span><input type="date" className={inputClass} value={builderDueDate} onChange={(event) => setBuilderDueDate(event.target.value)} /></label>
            </div>
            <label className="block"><span className={labelClass}>Requirements / learning outcomes</span><textarea className={`${inputClass} min-h-24 resize-y`} value={builderInstructions} onChange={(event) => setBuilderInstructions(event.target.value)} /></label>
            <button type="button" onClick={handleBuildAssignment} disabled={aiBusy || !builderTitle.trim()} className={`${primaryButton} w-full`}><Wand2 className="h-4 w-4" />Build Assignment</button>
          </div>
          <div className={`${panelClass} flex min-h-[400px] flex-col`}>
            <h3 className="mb-3 border-b border-white/10 pb-3 text-sm font-bold text-white">Generated Assignment Draft</h3>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-200">{aiBusy ? 'Building assignment…' : builderResult || 'Your generated assignment will appear here.'}</div>
            {builderResult && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void saveGeneratedAssignment('draft')} className={primaryButton}><Save className="h-4 w-4" />Save Draft</button><button type="button" onClick={() => void saveGeneratedAssignment('published')} className={`${primaryButton} bg-emerald-600 hover:bg-emerald-500`}><CheckCircle2 className="h-4 w-4" />Publish</button></div>}
          </div>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div className="space-y-4">
          <div className={`${panelClass} grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end`}>
            <label className="block"><span className={labelClass}>Select assignment</span><select className={inputClass} value={selectedAssignmentId} onChange={(event) => setSelectedAssignmentId(event.target.value)}><option value="">Choose an assignment</option>{assignments.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.classGrade}</option>)}</select></label>
            <button type="button" onClick={() => selectedAssignmentId && void refreshSubmissions(selectedAssignmentId)} disabled={!selectedAssignmentId || submissionsLoading} className={primaryButton}><RefreshCw className={`h-4 w-4 ${submissionsLoading ? 'animate-spin' : ''}`} />Refresh</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Submitted', submissions.length],
              ['Late', submissions.filter((item) => item.isLate || item.status === 'late').length],
              ['Evaluated', submissions.filter((item) => item.status === 'evaluated').length],
              ['Awaiting review', submissions.filter((item) => ['submitted', 'late', 'under_evaluation'].includes(item.status)).length],
            ].map(([label, value]) => <div key={String(label)} className={`${panelClass} p-3`}><p className="text-[10px] uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-black tabular-nums text-white">{value}</p></div>)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`${panelClass} space-y-2`}>
              <h3 className="mb-3 text-sm font-bold text-white">Student Submissions</h3>
              {submissionsLoading ? <div className="py-8 text-center text-xs text-slate-400"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading submissions…</div> : submissions.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No submissions are recorded for this assignment yet.</p> : submissions.map((submission) => (
                <button key={submission.id} type="button" onClick={() => { setSelectedSubmission(submission); setSubmissionScore(submission.score == null ? '' : String(submission.score)); setSubmissionFeedback(submission.feedback || ''); }} className={`w-full rounded-xl border p-3 text-left ${selectedSubmission?.studentId === submission.studentId ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/5 bg-slate-950/50 hover:border-white/15'}`}>
                  <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-white">{submission.studentName}</span><span className={`rounded-md px-2 py-1 text-[9px] font-bold uppercase ${submission.status === 'evaluated' ? 'bg-emerald-500/10 text-emerald-300' : submission.isLate ? 'bg-amber-500/10 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>{submission.status.replaceAll('_', ' ')}</span></div>
                  <p className="mt-1 text-[10px] text-slate-500">{new Date(submission.submittedAt).toLocaleString()}</p>
                </button>
              ))}
            </div>
            <div className={`${panelClass} space-y-3`}>
              <h3 className="text-sm font-bold text-white">Review & Feedback</h3>
              {!selectedSubmission ? <p className="py-8 text-center text-xs text-slate-500">Select a submission to review it.</p> : <>
                <div className="rounded-xl border border-white/5 bg-slate-950/60 p-3 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{selectedSubmission.submissionText || 'No typed response.'}{selectedSubmission.attachmentUrl ? `\n\nAttachment: ${selectedSubmission.attachmentName || selectedSubmission.attachmentUrl}` : ''}</div>
                <label className="block"><span className={labelClass}>Score / {selectedAssignment?.maxScore || selectedSubmission.maxScore || 100}</span><input type="number" min="0" max={selectedAssignment?.maxScore || 100} className={inputClass} value={submissionScore} onChange={(event) => setSubmissionScore(event.target.value)} /></label>
                <label className="block"><span className={labelClass}>Feedback</span><textarea className={`${inputClass} min-h-24 resize-y`} value={submissionFeedback} onChange={(event) => setSubmissionFeedback(event.target.value)} /></label>
                <label className="flex items-center gap-2 text-[11px] text-slate-300"><input type="checkbox" checked={releaseResults} onChange={(event) => setReleaseResults(event.target.checked)} />Release result to student</label>
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void handleEvaluateSubmission('evaluate')} className={primaryButton}>Save Evaluation</button><button type="button" onClick={() => void handleEvaluateSubmission('return_for_revision')} className={`${primaryButton} bg-amber-600 hover:bg-amber-500`}>Return for Revision</button></div>
              </>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'completion' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-emerald-300"><Activity className="h-4 w-4" />Notebook Completion Reports</div>
            <label className="block"><span className={labelClass}>Report title / notebook owner or class</span><input className={inputClass} value={completionTitle} onChange={(event) => setCompletionTitle(event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Notebook text / exported content</span><textarea className={`${inputClass} min-h-56 resize-y`} value={completionText} onChange={(event) => setCompletionText(event.target.value)} placeholder="Paste notes or extracted text. AI will report only on topics visible in this evidence." /></label>
            <button type="button" onClick={handleNotebookCompletion} disabled={aiBusy || !completionText.trim()} className={`${primaryButton} w-full`}><ClipboardCheck className="h-4 w-4" />Generate Completion Report</button>
          </div>
          {resultPanel('Notebook Completion Report', completionResult, 'Checking visible topic coverage and evidence…')}
        </div>
      )}

      {activeTab === 'quality' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-violet-300"><Target className="h-4 w-4" />Assignment Quality Analyzer</div>
            <label className="block"><span className={labelClass}>Assignment title</span><input className={inputClass} value={qualityTitle} onChange={(event) => setQualityTitle(event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Assignment brief / rubric</span><textarea className={`${inputClass} min-h-64 resize-y`} value={qualityText} onChange={(event) => setQualityText(event.target.value)} placeholder="Paste the complete instructions, mark allocation, and rubric to review…" /></label>
            <button type="button" onClick={handleAnalyzeQuality} disabled={aiBusy || !qualityText.trim()} className={`${primaryButton} w-full`}><Sparkles className="h-4 w-4" />Analyze Assignment Quality</button>
          </div>
          {resultPanel('Quality & Alignment Review', qualityResult, 'Reviewing clarity, balance, fairness, and assessment criteria…')}
        </div>
      )}

      {activeTab === 'groups' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-sm font-bold text-cyan-300"><Users className="h-4 w-4" />Group Projects</div>
            <label className="block"><span className={labelClass}>Project title / topic</span><input className={inputClass} value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} /></label>
            <div className="grid grid-cols-2 gap-3"><label className="block"><span className={labelClass}>Subject</span><input className={inputClass} value={groupSubject} onChange={(event) => setGroupSubject(event.target.value)} /></label><label className="block"><span className={labelClass}>Grade</span><select className={inputClass} value={groupGrade} onChange={(event) => setGroupGrade(event.target.value)}>{Array.from({ length: 5 }, (_, i) => `Grade ${i + 8}`).map((grade) => <option key={grade}>{grade}</option>)}</select></label></div>
            <label className="block"><span className={labelClass}>Group name</span><input className={inputClass} value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Team members (one per line)</span><textarea className={`${inputClass} min-h-24 resize-y`} value={groupMembers} onChange={(event) => setGroupMembers(event.target.value)} /></label>
            <label className="block"><span className={labelClass}>Due date</span><input type="date" className={inputClass} value={groupDueDate} onChange={(event) => setGroupDueDate(event.target.value)} /></label>
            <button type="button" onClick={handlePlanGroupProject} disabled={aiBusy} className={`${primaryButton} w-full`}><Wand2 className="h-4 w-4" />Plan Group Project</button>
          </div>
          <div className={`${panelClass} flex min-h-[400px] flex-col`}>
            <h3 className="mb-3 border-b border-white/10 pb-3 text-sm font-bold text-white">Project Plan & Team Roles</h3>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-white/5 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-200">{aiBusy ? 'Planning milestones and team roles…' : groupResult || 'Generate a project plan to view milestones, deliverables, and suggested team roles.'}</div>
            {groupResult && <button type="button" onClick={() => void saveGroupProject()} className={`${primaryButton} mt-3 w-full`}><Save className="h-4 w-4" />Save Group Project as Assignment Draft</button>}
          </div>
        </div>
      )}

      {!isFaculty && <p className="text-[10px] text-slate-500">Some tools require a faculty or administrator role.</p>}
    </motion.div>
  );
};
