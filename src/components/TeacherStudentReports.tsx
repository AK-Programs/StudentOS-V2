import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';

export default function TeacherStudentReports({ currentUser }: { currentUser: UserProfile }) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      let list: UserProfile[] = [];
      try {
        const allUsers = await fetchAllSupabaseUsers();
        list = allUsers.filter(u => u.role === 'student');
      } catch (sbErr) {
        console.error('[Supabase] Failed to fetch students from Supabase:', sbErr);
        throw sbErr;
      }
      
      const userRole = currentUser.role || 'teacher';
      
      let filtered = list;
      if (userRole === 'admin' || userRole === 'super_admin') {
        // Admins and Super Admins see everything
        filtered = list;
      } else if (userRole === 'coordinator') {
        // Coordinators see their assigned classes or grades
        const assignedClasses = currentUser.assignedClasses || [];
        const assignedGrades = currentUser.assignedGrades || [];
        filtered = list.filter(s => {
          if (assignedClasses.length > 0) {
            const cls = `${s.grade}_${s.section}`;
            return assignedClasses.includes(cls);
          }
          if (assignedGrades.length > 0) {
            return assignedGrades.includes(s.grade);
          }
          return true; // Fallback
        });
      } else {
        // Teachers see only their assigned classes
        const teacherClasses = currentUser.assignedClasses || [];
        filtered = list.filter(s => {
          if (teacherClasses.length > 0) {
            const cls = `${s.grade}_${s.section}`;
            return teacherClasses.includes(cls);
          }
          return (currentUser.assignedGrades || []).includes(s.grade);
        });
      }
      setStudents(filtered);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: UserProfile) => {
    setSelectedStudent(student);
  };

  return (
    <div className="space-y-6">
      {/* Search / Selection Area */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl sm:rounded-3xl p-4 sm:p-6">
        <h4 className="text-base sm:text-lg font-bold text-white mb-4">Select Student for Report Generation</h4>
        <select 
          className="w-full sm:w-96 text-sm px-4 py-3 rounded-xl bg-slate-950 border border-white/10 text-white focus:outline-none focus:border-indigo-500"
          onChange={(e) => {
            const st = students.find(s => s.email === e.target.value);
            if (st) handleStudentSelect(st);
            else setSelectedStudent(null);
          }}
          value={selectedStudent?.email || ""}
        >
          <option value="">-- Choose a student --</option>
          {students.map(s => (
            <option key={s.email} value={s.email}>{s.name} ({s.grade} - {s.section || 'Unassigned'})</option>
          ))}
        </select>
      </div>

      {selectedStudent && (
        <div className="bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 animate-fadeIn space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-6 gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-2xl font-bold text-indigo-400">
                {selectedStudent.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-black text-white">{selectedStudent.name}</h3>
                <p className="text-sm text-slate-400">{selectedStudent.grade} - {selectedStudent.section} • {selectedStudent.house}</p>
              </div>
            </div>
            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow shadow-indigo-500/20 flex items-center gap-2">
              Generate Official Report PDF
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Attendance</p>
                <p className="text-2xl font-black text-emerald-400">92%</p>
                <p className="text-xs text-slate-500 mt-1">Excellent</p>
             </div>
             <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Avg Marks</p>
                <p className="text-2xl font-black text-white">88/100</p>
                <p className="text-xs text-emerald-400 mt-1">+4% from last term</p>
             </div>
             <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Performance Tier</p>
                <p className="text-2xl font-black text-indigo-400">A-Tier</p>
                <p className="text-xs text-slate-500 mt-1">Consistent Scholar</p>
             </div>
             <div className="p-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden">
                <div className="absolute -right-2 -top-2 text-4xl opacity-10 blur-sm">🧠</div>
                <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mb-1">AI Prediction</p>
                <p className="text-lg font-black text-white">Positive Trajectory</p>
                <p className="text-[10px] text-indigo-200/50 mt-1 leading-tight">Likely to excel in upcoming Science practicals based on past pattern.</p>
             </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Teacher Remarks</h4>
            <div className="p-5 border-l-4 border-emerald-500 bg-emerald-500/10 rounded-r-xl">
              <p className="text-xs text-slate-300">Consistently active in class participation and helps peers in the Whiteboard streams.</p>
              <p className="text-[10px] text-slate-500 font-mono mt-2">- Mr. Anderson, Physics Dept</p>
            </div>
            <div className="p-4 border border-dashed border-white/10 rounded-xl flex justify-center text-sm">
              <button className="text-indigo-400 font-bold text-xs flex items-center gap-2 hover:text-indigo-300">
                + Add New Remark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
