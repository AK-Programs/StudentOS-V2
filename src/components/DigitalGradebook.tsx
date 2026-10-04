import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, GradebookAssessment, GradebookEntry, AssessmentType, UserRole } from '../types';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';
import { 
  Award, BookOpen, Plus, Save, Check, Filter, Search, 
  BarChart2, TrendingUp, AlertCircle, FileText, Download, CheckCircle2
} from 'lucide-react';

interface DigitalGradebookProps {
  currentUser: UserProfile;
  effectiveRole?: UserRole;
}

const ASSESSMENT_PERIODS = ['Term 1', 'Midterm', 'Term 2', 'Final Exam', 'Annual Evaluation'];
const ASSESSMENT_TYPES: AssessmentType[] = ['Quiz', 'Assignment', 'Unit Test', 'Periodic Test', 'Midterm', 'Project', 'Practical', 'Final Exam'];

const SUBJECTS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English Literature',
  'Computer Science',
  'History & Civics',
  'Economics'
];

export function computeLetterGrade(percentage: number): string {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

export default function DigitalGradebook({ currentUser, effectiveRole }: DigitalGradebookProps) {
  const isStudent = effectiveRole === 'student';
  const isTeacher = effectiveRole === 'teacher';
  const isAdminOrCoordinator = effectiveRole === 'admin' || effectiveRole === 'super_admin' || effectiveRole === 'coordinator';

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<string>(currentUser.grade || 'Grade 10');
  const [selectedSection, setSelectedSection] = useState<string>(currentUser.section || 'Solara');
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathematics');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('Term 1');

  // Data states
  const [assessments, setAssessments] = useState<GradebookAssessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('');
  const [entries, setEntries] = useState<Record<string, GradebookEntry>>({});
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Modal for new assessment
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<AssessmentType>('Unit Test');
  const [newMaxScore, setNewMaxScore] = useState<number>(100);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Student specific view
  const [myEntries, setMyEntries] = useState<GradebookEntry[]>([]);

  // 1. Fetch Students
  useEffect(() => {
    if (isStudent) return;
    const loadStudents = async () => {
      try {
        const users = await fetchAllSupabaseUsers();
        const filtered = users.filter(u => 
          u.role === 'student' && 
          (!selectedGrade || u.grade === selectedGrade) &&
          (!selectedSection || u.section === selectedSection)
        );
        setStudents(filtered);
      } catch (err) {
        console.error('Failed to load students:', err);
      }
    };
    loadStudents();
  }, [selectedGrade, selectedSection, isStudent]);

  // 2. Fetch Assessments
  const loadAssessments = async () => {
    setLoading(true);
    try {
      let query = supabase.from('gradebook_assessments').select('*');
      if (!isStudent) {
        query = query
          .eq('class_grade', selectedGrade)
          .eq('subject', selectedSubject)
          .eq('period', selectedPeriod);
      }

      const { data, error } = await query.order('date', { ascending: false });
      if (error && error.code !== '42P01') throw error;

      const mapped: GradebookAssessment[] = (data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        classGrade: a.class_grade,
        classSection: a.class_section,
        subject: a.subject,
        period: a.period,
        type: a.type as AssessmentType,
        maxScore: a.max_score,
        date: a.date,
        teacherId: a.teacher_id,
        teacherName: a.teacher_name,
        createdAt: a.created_at
      }));

      setAssessments(mapped);
      if (mapped.length > 0 && !selectedAssessmentId) {
        setSelectedAssessmentId(mapped[0].id);
      }
    } catch (err) {
      console.error('Failed to load assessments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments();
  }, [selectedGrade, selectedSection, selectedSubject, selectedPeriod, isStudent]);

  // 3. Fetch Entries for selected assessment (or student's own entries)
  useEffect(() => {
    const loadEntries = async () => {
      if (isStudent && currentUser.uid) {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('gradebook_entries')
            .select('*')
            .eq('student_id', currentUser.uid);

          if (error && error.code !== '42P01') throw error;

          const mapped: GradebookEntry[] = (data || []).map((e: any) => ({
            id: e.id,
            assessmentId: e.assessment_id,
            studentId: e.student_id,
            studentName: e.student_name,
            subject: e.subject,
            score: e.score,
            maxScore: e.max_score,
            percentage: e.percentage,
            letterGrade: e.letter_grade,
            comment: e.comment,
            updatedAt: e.updated_at
          }));

          setMyEntries(mapped);
        } catch (err) {
          console.error('Failed to load student entries:', err);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!selectedAssessmentId) return;

      try {
        const { data, error } = await supabase
          .from('gradebook_entries')
          .select('*')
          .eq('assessment_id', selectedAssessmentId);

        if (error && error.code !== '42P01') throw error;

        const map: Record<string, GradebookEntry> = {};
        (data || []).forEach((e: any) => {
          map[e.student_id] = {
            id: e.id,
            assessmentId: e.assessment_id,
            studentId: e.student_id,
            studentName: e.student_name,
            subject: e.subject,
            score: e.score,
            maxScore: e.max_score,
            percentage: e.percentage,
            letterGrade: e.letter_grade,
            comment: e.comment,
            updatedAt: e.updated_at
          };
        });
        setEntries(map);
      } catch (err) {
        console.error('Failed to load entries:', err);
      }
    };

    loadEntries();
  }, [selectedAssessmentId, isStudent, currentUser]);

  // Active Assessment
  const currentAssessment = assessments.find(a => a.id === selectedAssessmentId);

  // Handle Score Input Change
  const handleScoreChange = (studentId: string, studentName: string, rawScore: string) => {
    setValidationError(null);
    const max = currentAssessment ? currentAssessment.maxScore : 100;
    const num = rawScore === '' ? 0 : parseFloat(rawScore);

    if (isNaN(num)) return;
    if (num < 0) {
      setValidationError('Scores cannot be negative.');
      return;
    }
    if (num > max) {
      setValidationError(`Score cannot exceed maximum score of ${max}.`);
      return;
    }

    const pct = Math.round((num / max) * 100);
    const letter = computeLetterGrade(pct);

    setEntries(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          id: `${selectedAssessmentId}_${studentId}`,
          assessmentId: selectedAssessmentId,
          studentId,
          studentName,
          subject: selectedSubject,
        }),
        score: num,
        maxScore: max,
        percentage: pct,
        letterGrade: letter
      }
    }));
  };

  // Handle Comment Change
  const handleCommentChange = (studentId: string, studentName: string, comment: string) => {
    setEntries(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {
          id: `${selectedAssessmentId}_${studentId}`,
          assessmentId: selectedAssessmentId,
          studentId,
          studentName,
          subject: selectedSubject,
          score: 0,
          maxScore: currentAssessment?.maxScore || 100,
          percentage: 0,
          letterGrade: 'F'
        }),
        comment
      }
    }));
  };

  // Save Grades to Supabase
  const handleSaveGrades = async () => {
    if (!currentAssessment) return;
    setSaving(true);
    setValidationError(null);

    try {
      const recordsToUpsert = students.map(s => {
        const entry = entries[s.uid!];
        const score = entry ? entry.score : 0;
        const max = currentAssessment.maxScore;
        const pct = Math.round((score / max) * 100);

        return {
          assessment_id: currentAssessment.id,
          student_id: s.uid,
          student_name: s.name,
          subject: currentAssessment.subject,
          score: score,
          max_score: max,
          percentage: pct,
          letter_grade: computeLetterGrade(pct),
          comment: entry?.comment || null,
          updated_at: new Date().toISOString(),
          updated_by: currentUser.name || currentUser.email
        };
      });

      const { error } = await supabase
        .from('gradebook_entries')
        .upsert(recordsToUpsert, { onConflict: 'assessment_id, student_id' });

      if (error && error.code !== '42P01') throw error;

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to save grade entries:', err);
      setValidationError('Failed to save entries to database.');
    } finally {
      setSaving(false);
    }
  };

  // Create New Assessment
  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || newMaxScore <= 0) return;

    try {
      const payload = {
        title: newTitle.trim(),
        class_grade: selectedGrade,
        class_section: selectedSection,
        subject: selectedSubject,
        period: selectedPeriod,
        type: newType,
        max_score: newMaxScore,
        date: newDate,
        teacher_id: currentUser.uid,
        teacher_name: currentUser.name || currentUser.email
      };

      const { data, error } = await supabase
        .from('gradebook_assessments')
        .insert([payload])
        .select()
        .single();

      if (error && error.code !== '42P01') throw error;

      setShowAddModal(false);
      setNewTitle('');
      await loadAssessments();
      if (data?.id) setSelectedAssessmentId(data.id);
    } catch (err) {
      console.error('Failed to create assessment:', err);
    }
  };

  // Calculate Class Statistics
  const stats = useMemo(() => {
    const scores = students
      .map(s => entries[s.uid!]?.score)
      .filter((s): s is number => s !== undefined);

    if (scores.length === 0 || !currentAssessment) {
      return { average: 0, highest: 0, lowest: 0, passingPct: 0 };
    }

    const max = currentAssessment.maxScore;
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const avgPct = Math.round((avg / max) * 100);
    const high = Math.max(...scores);
    const low = Math.min(...scores);
    const passing = scores.filter(s => (s / max) >= 0.5).length;
    const passingPct = Math.round((passing / scores.length) * 100);

    return { average: avgPct, highest: high, lowest: low, passingPct };
  }, [students, entries, currentAssessment]);

  // STUDENT VIEW
  if (isStudent) {
    const totalStudentPoints = myEntries.reduce((a, b) => a + b.score, 0);
    const maxPossiblePoints = myEntries.reduce((a, b) => a + b.maxScore, 0);
    const studentGpaPct = maxPossiblePoints > 0 ? Math.round((totalStudentPoints / maxPossiblePoints) * 100) : 0;

    return (
      <div className="smart-glass p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-4 sm:space-y-6 max-w-6xl mx-auto animate-fadeIn w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Student Academic Gradebook</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Official Grades
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Verified evaluation scores, subject breakdown, and teacher notes for your enrolled courses.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 bg-slate-950/60 rounded-2xl border border-white/5 flex items-center gap-4 w-full md:w-auto justify-around md:justify-start">
            <div className="text-center">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono block">{studentGpaPct}%</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Avg</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <span className="text-xs font-bold text-white block">Grade: {computeLetterGrade(studentGpaPct)}</span>
              <span className="text-[10px] text-slate-400">{myEntries.length} Recorded Assessments</span>
            </div>
          </div>
        </div>

        {myEntries.length === 0 ? (
          <div className="p-8 sm:p-12 text-center bg-slate-950/60 border border-white/5 rounded-2xl space-y-2">
            <Award className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-300">No grades recorded yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Your teachers have not entered formal assessment scores for your profile yet. Once graded, results appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card List */}
            <div className="block sm:hidden space-y-3">
              {myEntries.map(e => (
                <div key={e.id} className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-white text-xs">{e.subject}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                      {e.letterGrade}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                    <span className="font-mono text-slate-300">Score: {e.score} / {e.maxScore}</span>
                    <span className="font-mono font-bold text-emerald-400">{e.percentage}%</span>
                  </div>
                  {e.comment && (
                    <p className="text-[11px] text-slate-400 italic pt-1 border-t border-white/5">"{e.comment}"</p>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block bg-slate-950/60 rounded-3xl border border-white/10 overflow-hidden overflow-x-auto shadow-xl">
              <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                <thead>
                  <tr className="bg-slate-900 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                    <th className="p-4">Subject</th>
                    <th className="p-4">Score</th>
                    <th className="p-4">Percentage</th>
                    <th className="p-4">Grade</th>
                    <th className="p-4">Teacher Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {myEntries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-900/40">
                      <td className="p-4 font-bold text-white">{e.subject}</td>
                      <td className="p-4 font-mono font-bold text-slate-200">{e.score} / {e.maxScore}</td>
                      <td className="p-4 font-mono text-emerald-400 font-bold">{e.percentage}%</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          {e.letterGrade}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400 italic">{e.comment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  // TEACHER / ADMIN / COORDINATOR VIEW
  return (
    <div className="smart-glass p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6 max-w-7xl mx-auto animate-fadeIn w-full">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">Digital Gradebook Management</h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {effectiveRole?.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Enter marks, configure assessment periods, and evaluate student performance metrics.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-wider border border-white/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>New Assessment</span>
          </button>

          <button
            onClick={handleSaveGrades}
            disabled={saving || !currentAssessment}
            className="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Entries...' : 'Save Gradebook'}</span>
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Grades saved successfully! Marks are synchronized and accessible in student dashboards and report cards.</span>
        </div>
      )}

      {validationError && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Control Selector Bar */}
      <div className="p-3.5 sm:p-4 bg-slate-950/60 border border-white/10 rounded-2xl space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Grade</label>
            <select 
              value={selectedGrade} 
              onChange={e => setSelectedGrade(e.target.value)} 
              className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              {['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Section</label>
            <select 
              value={selectedSection} 
              onChange={e => setSelectedSection(e.target.value)} 
              className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              {['Solara', 'Astra', 'Elara', 'Vega'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject</label>
            <select 
              value={selectedSubject} 
              onChange={e => setSelectedSubject(e.target.value)} 
              className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assessment Period</label>
            <select 
              value={selectedPeriod} 
              onChange={e => setSelectedPeriod(e.target.value)} 
              className="w-full px-2.5 sm:px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500"
            >
              {ASSESSMENT_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-white/5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Active Assessment</label>
          <select
            value={selectedAssessmentId}
            onChange={e => setSelectedAssessmentId(e.target.value)}
            disabled={assessments.length === 0}
            className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          >
            {assessments.length === 0 ? (
              <option value="">No assessments created for this period</option>
            ) : (
              assessments.map(a => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.type} &bull; Max {a.maxScore} pts &bull; {a.date})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Class Statistics Row */}
      {currentAssessment && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 sm:p-3.5 bg-slate-950/60 border border-white/5 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Class Average</span>
            <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono mt-0.5 block">{stats.average}%</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">{computeLetterGrade(stats.average)} Grade Equivalent</span>
          </div>

          <div className="p-3 sm:p-3.5 bg-slate-950/60 border border-white/5 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Passing Rate (&gt;=50%)</span>
            <span className="text-lg sm:text-xl font-black text-indigo-400 font-mono mt-0.5 block">{stats.passingPct}%</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Pass/Fail Threshold</span>
          </div>

          <div className="p-3 sm:p-3.5 bg-slate-950/60 border border-white/5 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Highest Score</span>
            <span className="text-lg sm:text-xl font-black text-white font-mono mt-0.5 block">{stats.highest} / {currentAssessment.maxScore}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Top Performance</span>
          </div>

          <div className="p-3.5 bg-slate-950/60 border border-white/5 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Lowest Score</span>
            <span className="text-lg sm:text-xl font-black text-slate-300 font-mono mt-0.5 block">{stats.lowest} / {currentAssessment.maxScore}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Needs Scaffolding</span>
          </div>
        </div>
      )}

      {/* Grade Entry Matrix */}
      {!currentAssessment ? (
        <div className="p-8 sm:p-12 text-center bg-slate-950/60 border border-white/5 rounded-2xl space-y-3">
          <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-300">No Assessment Selected</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click "New Assessment" above to create an assessment test or quiz for this class and period.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
          >
            + Create First Assessment
          </button>
        </div>
      ) : (
        <>
          {/* Mobile Card List for Grade Entry */}
          <div className="block sm:hidden space-y-3">
            {students.map(s => {
              const entry = entries[s.uid!];
              const score = entry ? entry.score : '';
              const pct = entry ? entry.percentage : 0;
              const letter = entry ? entry.letterGrade : '—';

              return (
                <div key={s.uid} className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl space-y-3 shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {s.name ? s.name[0] : 'S'}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs block truncate">{s.name}</span>
                        <span className="text-[10px] text-slate-400 block truncate">{s.email}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono shrink-0 ${
                      letter === 'A+' || letter === 'A' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      letter === 'B' || letter === 'C' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                      letter === 'D' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {letter} {entry ? `(${pct}%)` : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Score (Max {currentAssessment.maxScore})</label>
                      <input
                        type="number"
                        min={0}
                        max={currentAssessment.maxScore}
                        value={score}
                        onChange={e => handleScoreChange(s.uid!, s.name, e.target.value)}
                        placeholder="0"
                        className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Teacher Remark</label>
                      <input
                        type="text"
                        value={entry?.comment || ''}
                        onChange={e => handleCommentChange(s.uid!, s.name, e.target.value)}
                        placeholder="Remarks..."
                        className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {students.length === 0 && (
              <div className="p-8 text-center bg-slate-950/60 border border-white/10 rounded-2xl text-slate-500 text-xs">
                No students found under {selectedGrade} - Section {selectedSection}.
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-slate-950/60 rounded-3xl border border-white/10 overflow-hidden overflow-x-auto shadow-xl">
            <table className="w-full text-left border-collapse text-xs min-w-[550px]">
              <thead>
                <tr className="bg-slate-900 border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="p-4">Student</th>
                  <th className="p-4">Score (Max: {currentAssessment.maxScore})</th>
                  <th className="p-4">Percentage</th>
                  <th className="p-4">Grade</th>
                  <th className="p-4">Teacher Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {students.map(s => {
                  const entry = entries[s.uid!];
                  const score = entry ? entry.score : '';
                  const pct = entry ? entry.percentage : 0;
                  const letter = entry ? entry.letterGrade : '—';

                  return (
                    <tr key={s.uid} className="hover:bg-slate-900/40">
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                            {s.name ? s.name[0] : 'S'}
                          </div>
                          <div>
                            <span className="font-bold text-white text-xs block">{s.name}</span>
                            <span className="text-[10px] text-slate-400">{s.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={currentAssessment.maxScore}
                            value={score}
                            onChange={e => handleScoreChange(s.uid!, s.name, e.target.value)}
                            placeholder="0"
                            className="w-20 px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-slate-500 font-mono text-xs">/ {currentAssessment.maxScore}</span>
                        </div>
                      </td>

                      <td className="p-4 font-mono font-bold text-emerald-400">
                        {entry ? `${pct}%` : '—'}
                      </td>

                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                          letter === 'A+' || letter === 'A' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          letter === 'B' || letter === 'C' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' :
                          letter === 'D' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {letter}
                        </span>
                      </td>

                      <td className="p-4">
                        <input
                          type="text"
                          value={entry?.comment || ''}
                          onChange={e => handleCommentChange(s.uid!, s.name, e.target.value)}
                          placeholder="Excellent analysis, review lab notes..."
                          className="w-full max-w-xs px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </td>
                    </tr>
                  );
                })}
                {students.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-slate-500 text-xs">
                      No students found under {selectedGrade} - Section {selectedSection}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* MODAL: CREATE ASSESSMENT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h4 className="text-lg font-black text-white">Create Assessment</h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕ Cancel
              </button>
            </div>

            <form onSubmit={handleCreateAssessment} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assessment Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Unit 3 Calculus Exam"
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Assessment Type</label>
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as AssessmentType)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    {ASSESSMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Maximum Score</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    required
                    value={newMaxScore}
                    onChange={e => setNewMaxScore(parseInt(e.target.value) || 100)}
                    className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Date Conducted</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all"
                >
                  Create Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
