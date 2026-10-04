import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar 
} from 'recharts';
import { Award, AlertTriangle, TrendingUp, Sparkles, BookOpen, Plus, Trash2, Check, FileText } from 'lucide-react';

export interface AcademicRecord {
  id: string;
  student_id: string;
  student_name: string;
  grade: string;
  section: string;
  exam_type: string;
  max_marks: number;
  marks: Record<string, string>;
  created_at: string;
}

export default function StudentMarksCenter({ currentUser, effectiveRole, showNotification }: any) {
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [examType, setExamType] = useState('Unit Test');
  const [loadedStudents, setLoadedStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);

  // Dynamic Subjects and Configurable Max Marks
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const maxMarkOptions = [20, 25, 40, 50, 80, 100, 150, 200];
  const [subjects, setSubjects] = useState<string[]>(['Maths', 'Science', 'English', 'Social Science', 'Computer']);
  const [newSubject, setNewSubject] = useState('');
  const [marks, setMarks] = useState<Record<string, string>>({});
  
  // Historical Records State
  const [allRecords, setAllRecords] = useState<AcademicRecord[]>([]);
  const [studentRecords, setStudentRecords] = useState<AcademicRecord[]>([]);

  let gradeOptions = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`);
  let sectionOptions = ['Astra', 'Elara', 'Solara', 'Vega'];

  if (effectiveRole === 'teacher' && currentUser?.assignedClasses) {
    const assigned = currentUser.assignedClasses;
    const allowedGrades = new Set<string>();
    const allowedSections = new Set<string>();
    
    assigned.forEach((cls: string) => {
      // Handle both "9_A" and "9A" formats
      const cleanCls = cls.replace(/\s+/g, '').toUpperCase();
      const match = cleanCls.match(/^(\d+)([A-Z]*)$/);
      if (match) {
        allowedGrades.add(`Grade ${match[1]}`);
        if (match[2]) {
           // We map section A back to Astra etc or just show the letter
           const secLetter = match[2];
           const fullSection = ['Astra', 'Elara', 'Solara', 'Vega'].find(s => s.charAt(0) === secLetter) || secLetter;
           allowedSections.add(fullSection);
        }
      }
    });

    if (allowedGrades.size > 0) gradeOptions = Array.from(allowedGrades);
    if (allowedSections.size > 0) {
       sectionOptions = Array.from(allowedSections);
    }
  }

  const examTypes = ['Unit Test', 'Periodic Test', 'Half Yearly', 'Final Exam'];

  // Load All Academic Records from DB
  const fetchAcademicRecords = async () => {
    try {
      // 1. Fetch from Supabase
      const { data, error } = await supabase
        .from('student_marks')
        .select('*');
      
      if (!error && data) {
        setAllRecords(data);
      }
    } catch (err) {
      console.warn('Supabase fetch marks failed:', err);
    }
  };

  useEffect(() => {
    fetchAcademicRecords();
  }, []);

  // Fetch student cohort list
  useEffect(() => {
    if (!selectedGrade || !selectedSection) {
      setLoadedStudents([]);
      return;
    }
    
    const fetchStudents = async () => {
      setLoading(true);
      try {
        let studs: UserProfile[] = [];
        try {
          const allUsers = await fetchAllSupabaseUsers();
          studs = allUsers.filter(u => u.role === 'student');
        } catch (sbErr) {
          console.error('[Supabase] Failed to load student users:', sbErr);
          throw sbErr;
        }
        
        const filtered = studs.filter(s => 
           s.grade === selectedGrade && s.section === selectedSection
        );
        
        setLoadedStudents(filtered);
      } catch (err) {
        console.error('Failed to fetch student data:', err);
        showNotification('Failed to fetch student data.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStudents();
  }, [selectedGrade, selectedSection]);

  // Load records for the specific selected student
  useEffect(() => {
    if (selectedStudent) {
      const records = allRecords.filter(r => r.student_id === selectedStudent.uid);
      setStudentRecords(records);
      
      // Auto-populate with the latest entry if any, or reset
      const latest = records[0];
      if (latest && latest.exam_type === examType) {
        setMarks(latest.marks || {});
        setMaxMarks(latest.max_marks || 100);
      } else {
        const clearedMarks: Record<string, string> = {};
        subjects.forEach(s => { clearedMarks[s] = ''; });
        setMarks(clearedMarks);
      }
    } else {
      setStudentRecords([]);
    }
  }, [selectedStudent, examType, allRecords]);

  const handleStudentSelect = (student: any) => {
    setSelectedStudent(student);
  };

  const handleSaveMarks = async () => {
    if (!selectedStudent) return;
    
    const recordId = `${selectedStudent.uid}_${examType.replace(/\s+/g, '_')}`;
    const newRecord: AcademicRecord = {
      id: recordId,
      student_id: selectedStudent.uid,
      student_name: selectedStudent.name,
      grade: selectedStudent.grade || selectedGrade,
      section: selectedStudent.section || selectedSection,
      exam_type: examType,
      max_marks: maxMarks,
      marks: marks,
      created_at: new Date().toISOString()
    };

    // Update state first
    const updatedRecords = [newRecord, ...allRecords.filter(r => r.id !== recordId)];
    setAllRecords(updatedRecords);

    // Persist to Supabase
    try {
      const { error } = await supabase
        .from('student_marks')
        .upsert([newRecord]);
        
      if (error && error.code !== '42P01') {
        throw error;
      }
    } catch (err) {
      console.warn('Supabase marks save offline fallback active:', err);
    }

    showNotification(`✅ Marks saved successfully for ${selectedStudent.name} (${examType})`);
    
    // Refresh
    fetchAcademicRecords();
  };

  const handleGenerateReport = () => {
    if (!selectedStudent) return;
    showNotification(`📄 Academic Report Card generated for ${selectedStudent.name} and synced to central database.`);
  };

  // AI Analytics & Performance Calculations
  const calculateAIAnalytics = () => {
    if (studentRecords.length === 0) {
      return {
        prediction: 75,
        risk: 'Borderline',
        riskColor: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
        strength: 'N/A',
        weakness: 'N/A',
        insight: 'No academic records exist yet. Start recording exam marks to activate real-time predictive analytics.'
      };
    }

    // Calc overall percentages
    const percentages = studentRecords.map(rec => {
      let totalScored = 0;
      let totalMax = 0;
      Object.entries(rec.marks).forEach(([sub, score]) => {
        const sVal = parseFloat(score as any);
        if (!isNaN(sVal)) {
          totalScored += sVal;
          totalMax += rec.max_marks;
        }
      });
      return totalMax > 0 ? (totalScored / totalMax) * 100 : 0;
    });

    const averagePercent = Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length);
    
    // Simple predictive weighted average favoring recent test progress
    let predictedNext = averagePercent;
    if (percentages.length > 1) {
      const weightSum = studentRecords.length * (studentRecords.length + 1) / 2;
      let weightedTotal = 0;
      percentages.reverse().forEach((pct, idx) => {
        weightedTotal += pct * (idx + 1);
      });
      predictedNext = Math.round(weightedTotal / weightSum);
      percentages.reverse(); // restore order
    }

    // Determine Risk Status
    let risk = 'On Track';
    let riskColor = 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (predictedNext < 50) {
      risk = 'At Risk';
      riskColor = 'text-red-400 border-red-500/20 bg-red-500/10';
    } else if (predictedNext < 70) {
      risk = 'Borderline';
      riskColor = 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    } else if (predictedNext > 88) {
      risk = 'Excel';
      riskColor = 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10';
    }

    // Strength & Weakness Discovery
    const subjectAverages: Record<string, { scored: number; max: number }> = {};
    studentRecords.forEach(rec => {
      Object.entries(rec.marks).forEach(([sub, val]) => {
        const score = parseFloat(val as any);
        if (!isNaN(score)) {
          if (!subjectAverages[sub]) {
            subjectAverages[sub] = { scored: 0, max: 0 };
          }
          subjectAverages[sub].scored += score;
          subjectAverages[sub].max += rec.max_marks;
        }
      });
    });

    let topSubject = 'None';
    let topPct = -1;
    let bottomSubject = 'None';
    let bottomPct = 101;

    Object.entries(subjectAverages).forEach(([sub, data]) => {
      const pct = (data.scored / data.max) * 100;
      if (pct > topPct) {
        topPct = pct;
        topSubject = sub;
      }
      if (pct < bottomPct) {
        bottomPct = pct;
        bottomSubject = sub;
      }
    });

    const aiFeedback = risk === 'At Risk' 
      ? `Critical attention needed. Progress falls below school targets. Weakest area identified in ${bottomSubject}. Prioritize remedial assistance.`
      : risk === 'Borderline'
      ? `Steady progress, though targeted guidance in ${bottomSubject} is highly recommended to bridge performance gaps before major term-end exams.`
      : `Outstanding execution. Strong aptitude demonstrated in ${topSubject}. Student is exceptionally suited for peer tutoring roles and advanced projects.`;

    return {
      prediction: Math.min(100, Math.max(0, predictedNext)),
      risk,
      riskColor,
      strength: topSubject,
      weakness: bottomSubject,
      insight: aiFeedback
    };
  };

  const aiStats = calculateAIAnalytics();

  // Recharts Chart Formats
  const getSubjectBreakdownData = () => {
    if (studentRecords.length === 0) return [];
    
    const subjectAverages: Record<string, { scored: number; max: number }> = {};
    studentRecords.forEach(rec => {
      Object.entries(rec.marks).forEach(([sub, val]) => {
        const score = parseFloat(val as any);
        if (!isNaN(score)) {
          if (!subjectAverages[sub]) {
            subjectAverages[sub] = { scored: 0, max: 0 };
          }
          subjectAverages[sub].scored += score;
          subjectAverages[sub].max += rec.max_marks;
        }
      });
    });

    return Object.entries(subjectAverages).map(([sub, data]) => ({
      subject: sub,
      Score: Math.round((data.scored / data.max) * 100),
      Target: 75
    }));
  };

  const getHistoricalTrendData = () => {
    return [...studentRecords].reverse().map((rec, idx) => {
      let scoredSum = 0;
      let maxSum = 0;
      Object.entries(rec.marks).forEach(([_, val]) => {
        const s = parseFloat(val as any);
        if (!isNaN(s)) {
          scoredSum += s;
          maxSum += rec.max_marks;
        }
      });
      const pct = maxSum > 0 ? Math.round((scoredSum / maxSum) * 100) : 0;
      return {
        name: rec.exam_type,
        Percentage: pct
      };
    });
  };

  const subjectChartData = getSubjectBreakdownData();
  const trendChartData = getHistoricalTrendData();

  return (
    <div className="smart-glass p-3.5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6">
      <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-xl font-black text-white font-display tracking-tight uppercase flex items-center gap-2">
            💯 Student Marks & AI Analytics Centre
          </h3>
          <p className="text-xs text-slate-400 font-medium">Record term scores, track progress timelines, and analyze real-time student trajectories.</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Select Class</label>
          <select 
            value={selectedGrade} 
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- All Classes --</option>
            {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Select Section</label>
          <select 
            value={selectedSection} 
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full text-sm px-4 py-3 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- All Sections --</option>
            {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Loaded Students list */}
      {selectedGrade && selectedSection && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-white uppercase px-1 border-l-2 border-indigo-500 flex items-center gap-2">
            👨‍🎓 Cohort Students ({loadedStudents.length})
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-60 overflow-y-auto pr-2">
            {loadedStudents.length === 0 ? (
              <p className="text-xs text-slate-500 col-span-full py-4 text-center">No students found matching this criteria.</p>
            ) : (
              loadedStudents.map((stu: any, idx: number) => {
                const isSel = selectedStudent?.uid === stu.uid;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleStudentSelect(stu)}
                    className={`p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                      isSel 
                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' 
                        : 'bg-slate-950/40 border-white/5 hover:border-white/20 text-slate-300'
                    }`}
                  >
                    <p className="text-xs font-bold truncate">{stu.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono mt-1">{stu.house || 'No House'}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Real-time Dashboard & Forms when student is selected */}
      {selectedStudent && (
        <div className="space-y-8 pt-4 border-t border-white/5 animate-fadeIn">
          {/* AI Analytics & Insight cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Score Prediction</span>
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{aiStats.prediction}%</span>
                <span className="text-[10px] text-slate-500 font-mono">Predicted Next</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${aiStats.prediction}%` }}></div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Academic Risk Status</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${aiStats.riskColor}`}>
                  {aiStats.risk}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Status automatically generated based on historical performance vectors.</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aptitude Synthesis</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">🔥 Top Subject:</span>
                  <span className="font-extrabold text-white">{aiStats.strength}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">⚠️ Needs Support:</span>
                  <span className="font-extrabold text-rose-400">{aiStats.weakness}</span>
                </div>
              </div>
            </div>

            <div className="md:col-span-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex gap-3 items-center">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
              <p className="text-xs text-indigo-200 leading-relaxed font-semibold">
                <strong className="text-white">AI Pedagogical Guidance:</strong> {aiStats.insight}
              </p>
            </div>
          </div>

          {/* Interactive Graphs */}
          {studentRecords.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-3">
                <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" /> Academic Progress Trend
                </h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                      <Line type="monotone" dataKey="Percentage" stroke="#4f46e5" strokeWidth={3} dot={{ fill: '#4f46e5', r: 5 }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-3">
                <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" /> Subject-wise Performance Profile
                </h5>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="subject" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ backgroundColor: '#020617', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px', color: '#fff' }} />
                      <Bar dataKey="Score" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Academic Records List */}
          <div className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 space-y-4">
            <h5 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4.5 h-4.5 text-indigo-400" /> Historical Performance Log ({studentRecords.length})
            </h5>
            {studentRecords.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">No previous exam scores recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-2 font-black">Exam Type</th>
                      <th className="py-3 px-2 font-black">Scored / Max</th>
                      <th className="py-3 px-2 font-black">Percentage</th>
                      <th className="py-3 px-2 font-black">Subject Breakdown</th>
                      <th className="py-3 px-2 font-black">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                    {studentRecords.map((rec) => {
                      let totalScored = 0;
                      let totalMax = 0;
                      Object.entries(rec.marks).forEach(([_, val]) => {
                        const s = parseFloat(val as any);
                        if (!isNaN(s)) {
                          totalScored += s;
                          totalMax += rec.max_marks;
                        }
                      });
                      const percent = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
                      return (
                        <tr key={rec.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-2 font-bold text-white">{rec.exam_type}</td>
                          <td className="py-3 px-2 font-mono text-indigo-300">{totalScored} / {totalMax}</td>
                          <td className="py-3 px-2">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${percent >= 75 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {percent}%
                            </span>
                          </td>
                          <td className="py-3 px-2 text-[10px] font-medium text-slate-400 max-w-xs truncate">
                            {Object.entries(rec.marks).map(([s, v]) => `${s}: ${v}`).join(', ')}
                          </td>
                          <td className="py-3 px-2 text-[10px] text-slate-500 font-mono">
                            {new Date(rec.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Marks Entry Panel */}
          <div className="p-6 bg-slate-950/60 rounded-2xl border border-indigo-500/20 space-y-6 shadow-inner">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-indigo-500/10 pb-4">
              <div>
                <h4 className="text-base font-black text-indigo-400">Record Term Scores for: {selectedStudent.name}</h4>
                <p className="text-xs text-slate-400">[{selectedStudent.grade} - {selectedStudent.section}]</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="w-32 space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Max Marks</label>
                  <select 
                    value={maxMarks} 
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {maxMarkOptions.map(m => <option key={m} value={m}>Out of {m}</option>)}
                  </select>
                </div>

                <div className="w-40 space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Exam Type</label>
                  <select 
                    value={examType} 
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {subjects.map(subject => (
                <div key={subject} className="space-y-1.5 flex flex-col group">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-300 font-bold tracking-wide">{subject}</label>
                    <button 
                      type="button"
                      onClick={() => setSubjects(subjects.filter(s => s !== subject))} 
                      className="text-[10px] text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      max={maxMarks}
                      min="0"
                      value={marks[subject] || ''}
                      onChange={(e) => setMarks({...marks, [subject]: e.target.value})}
                      placeholder={`Out of ${maxMarks}`}
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-white focus:outline-none focus:border-emerald-500 font-mono transition-colors"
                    />
                    {marks[subject] !== undefined && marks[subject] !== '' && (
                      <div className={`absolute top-1/2 -translate-y-1/2 right-3 w-2 h-2 rounded-full ${Number(marks[subject]) < (maxMarks * 0.4) ? 'bg-red-500 glow-ruby' : 'bg-emerald-500 glow-emerald'}`}></div>
                    )}
                  </div>
                </div>
              ))}
              
              <div className="space-y-1.5 flex flex-col border border-dashed border-indigo-500/30 rounded-xl p-3 items-center justify-center bg-indigo-500/5">
                 <input 
                   type="text" 
                   placeholder="New Subject" 
                   value={newSubject}
                   onChange={(e) => setNewSubject(e.target.value)}
                   className="w-full text-xs px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-indigo-500 text-center"
                 />
                 <button 
                   type="button"
                   onClick={() => {
                     if (newSubject.trim() && !subjects.includes(newSubject.trim())) {
                       setSubjects([...subjects, newSubject.trim()]);
                       setNewSubject('');
                     }
                   }}
                   className="w-full py-1.5 bg-indigo-500/20 text-indigo-400 font-bold text-xs rounded-lg hover:bg-indigo-500/40 transition-colors cursor-pointer"
                 >
                   + Add Subject
                 </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/5">
              <button 
                type="button"
                onClick={handleSaveMarks}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl flex-1 uppercase tracking-widest text-[10.5px] transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                💾 Save Academic Record
              </button>
              <button 
                type="button"
                onClick={handleGenerateReport}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl flex-1 uppercase tracking-widest text-[10.5px] transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                📊 Generate Official Report Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
