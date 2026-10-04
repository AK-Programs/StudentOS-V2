import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';
import { MessageSquare, Send } from 'lucide-react';

export default function TeacherStudentList({ currentUser }: { currentUser: UserProfile }) {
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [newRemark, setNewRemark] = useState('');
  const [activeStudent, setActiveStudent] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
    fetchRemarks();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const allUsers = await fetchAllSupabaseUsers();
      const list = allUsers.filter(u => u.role === 'student');
      
      const teacherClasses = currentUser.assignedClasses || [];
      const normalizedTeacherClasses = teacherClasses.map(c => c.replace(/\s+/g, '').toUpperCase());

      const getGradeNumber = (gradeStr?: string) => gradeStr?.replace(/[^\d]/g, '') || '';
      const getSectionInitial = (secStr?: string) => secStr?.charAt(0).toUpperCase() || '';

      const filtered = list.filter(s => {
         if (teacherClasses.length > 0) {
           const gNum = getGradeNumber(s.grade);
           const sInit = getSectionInitial(s.section);
           
           // E.g. "9A"
           const clsFormat1 = `${gNum}${sInit}`;
           // E.g. "9ASTRA"
           const clsFormat2 = `${gNum}${s.section?.toUpperCase()}`;
           // E.g. "GRADE9_ASTRA"
           const clsFormat3 = `${s.grade?.replace(/\s+/g, '').toUpperCase()}_${s.section?.toUpperCase()}`;
           // E.g. "10_SOLARA"
           const clsFormat4 = `${gNum}_${s.section?.toUpperCase()}`;

           return normalizedTeacherClasses.includes(clsFormat1) || 
                  normalizedTeacherClasses.includes(clsFormat2) || 
                  normalizedTeacherClasses.includes(clsFormat3) ||
                  normalizedTeacherClasses.includes(clsFormat4) ||
                  normalizedTeacherClasses.some(tc => tc.includes(gNum) && tc.includes(sInit));
         }
         // Fallback: if no specific class assigned yet, show all registered students
         return true;
      });
      setStudents(filtered);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRemarks = async () => {
    try {
      const { data } = await supabase.from('teacher_remarks').select('*');
      if (data) {
        const rMap: Record<string, string> = {};
        data.forEach(r => {
          if (!rMap[r.student_id]) rMap[r.student_id] = '';
          rMap[r.student_id] += `\n- ${r.remark} (${r.author_name})`;
        });
        setRemarks(rMap);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const submitRemark = async (studentId: string) => {
    if (!newRemark.trim()) return;
    try {
      await supabase.from('teacher_remarks').insert({
        student_id: studentId,
        author_id: currentUser.uid,
        author_name: currentUser.name,
        remark: newRemark
      });
      setNewRemark('');
      setActiveStudent(null);
      fetchRemarks();
      alert("Remark added successfully.");
    } catch (e: any) {
      if (e.code === '42P01') {
        alert("Remark system running in demo mode (table missing).");
      }
    }
  };

  const grades = currentUser.assignedGrades || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {grades.length === 0 && <div className="text-slate-400 text-sm">No classes assigned. Contact admin.</div>}
        {grades.map(grade => (
           <div 
             key={grade} 
             onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
             className={`p-4 rounded-2xl border cursor-pointer transition-all ${selectedGrade === grade ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 border-white/5 hover:border-indigo-500/30'}`}
           >
             <h5 className="font-bold text-indigo-400">{grade}</h5>
             <p className="text-xs text-slate-400 mb-2">Sections: {(currentUser.assignedSections || []).join(', ')}</p>
             <div className="text-[10px] text-white bg-indigo-500/20 px-2 py-1 rounded inline-block font-bold">
                {selectedGrade === grade ? 'Close Roster' : 'View Roster'}
             </div>
           </div>
        ))}
      </div>

      {selectedGrade && (
        <div className="animate-fadeIn p-6 bg-slate-900 border border-white/10 rounded-3xl">
          <h4 className="text-lg font-bold text-white mb-4">Roster: {selectedGrade}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-white/5">
                <tr>
                  <th className="px-4 py-3 rounded-tl-xl">Student Name</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Latest Remarks</th>
                  <th className="px-4 py-3 rounded-tr-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {loading ? (
                    <tr><td colSpan={4} className="text-center py-4 text-slate-500">Loading...</td></tr>
                ) : students.filter(s => s.grade === selectedGrade).length === 0 ? (
                   <tr><td colSpan={4} className="text-center py-4 text-slate-500">No students found.</td></tr>
                ) : (
                   students.filter(s => s.grade === selectedGrade).map(s => (
                     <React.Fragment key={s.email}>
                     <tr className="hover:bg-white/5">
                       <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                       <td className="px-4 py-3 text-xs">{s.section || 'Unassigned'}</td>
                       <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                         {remarks[s.uid!] || 'No remarks yet.'}
                       </td>
                       <td className="px-4 py-3">
                         <button onClick={() => setActiveStudent(activeStudent === s.uid ? null : s.uid!)} className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-500/40">
                           <MessageSquare className="w-3 h-3 inline mr-1" /> Add Remark
                         </button>
                       </td>
                     </tr>
                     {activeStudent === s.uid && (
                       <tr>
                         <td colSpan={4} className="px-4 py-3 bg-slate-950/50">
                            <div className="flex gap-2">
                              <input type="text" value={newRemark} onChange={e => setNewRemark(e.target.value)} placeholder="e.g. Excellent progress in Math..." className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                              <button onClick={() => submitRemark(s.uid!)} className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 flex items-center"><Send className="w-3 h-3 mr-1"/> Submit</button>
                            </div>
                         </td>
                       </tr>
                     )}
                     </React.Fragment>
                   ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
