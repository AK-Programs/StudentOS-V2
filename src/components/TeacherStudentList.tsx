import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { fetchAllSupabaseUsers } from '../lib/supabaseUsers';
import { supabase } from '../lib/supabase';
import { MessageSquare, Send, Phone, Video, Users } from 'lucide-react';
import { startSchoolCall } from '../lib/callService';

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
        <div className="animate-fadeIn p-6 bg-slate-900 border border-white/10 rounded-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div>
              <h4 className="text-lg font-bold text-white">Roster: {selectedGrade}</h4>
              <p className="text-xs text-slate-400">Manage students, progress reviews, and contextual class communications.</p>
            </div>
            {students.filter(s => s.grade === selectedGrade).length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const classStudents = students.filter(s => s.grade === selectedGrade);
                    startSchoolCall({
                      currentUser,
                      effectiveRole: currentUser.role,
                      type: 'video',
                      contextType: 'class_call',
                      contextTitle: `${selectedGrade} Virtual Class Session`,
                      contextSubtitle: `Live class hosted by ${currentUser.name || 'Faculty'}`,
                      contextId: selectedGrade,
                      targetParticipants: classStudents
                    });
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                  title="Launch Virtual Classroom Session for all students in this grade"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Class Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const classStudents = students.filter(s => s.grade === selectedGrade);
                    startSchoolCall({
                      currentUser,
                      effectiveRole: currentUser.role,
                      type: 'audio',
                      contextType: 'class_call',
                      contextTitle: `${selectedGrade} Audio Assembly`,
                      contextSubtitle: `Voice broadcast & discussion with ${currentUser.name || 'Faculty'}`,
                      contextId: selectedGrade,
                      targetParticipants: classStudents
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-bold text-xs transition-all active:scale-95"
                  title="Start Class Voice Discussion"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Class Audio</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-white/5">
                <tr>
                  <th className="px-4 py-3 rounded-tl-xl">Student Name</th>
                  <th className="px-4 py-3">Section</th>
                  <th className="px-4 py-3">Latest Remarks</th>
                  <th className="px-4 py-3 rounded-tr-xl text-right">Actions</th>
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
                       <td className="px-4 py-3 font-semibold text-white">
                         <div className="flex items-center gap-2">
                           <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
                             {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
                           </div>
                           <div>
                             <p className="font-semibold text-white leading-tight">{s.name}</p>
                             <p className="text-[10px] text-slate-500 font-mono">{s.email}</p>
                           </div>
                         </div>
                       </td>
                       <td className="px-4 py-3 text-xs">{s.section || 'Unassigned'}</td>
                       <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px] truncate">
                         {remarks[s.uid!] || 'No remarks yet.'}
                       </td>
                       <td className="px-4 py-3 text-right">
                         <div className="flex items-center justify-end gap-1.5">
                           <button 
                             type="button"
                             onClick={() => {
                               startSchoolCall({
                                 currentUser,
                                 effectiveRole: currentUser.role,
                                 type: 'video',
                                 contextType: 'student_call',
                                 contextTitle: `Academic Check-in: ${s.name}`,
                                 contextSubtitle: `${s.grade || selectedGrade} • ${s.section || 'Section'} • Progress & Remarks Review`,
                                 contextId: s.uid,
                                 targetParticipants: [s]
                               });
                             }} 
                             className="p-1.5 bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-400 rounded-lg text-xs transition-all"
                             title={`Video Call ${s.name}`}
                           >
                             <Video className="w-3.5 h-3.5" />
                           </button>
                           <button 
                             type="button"
                             onClick={() => {
                               startSchoolCall({
                                 currentUser,
                                 effectiveRole: currentUser.role,
                                 type: 'audio',
                                 contextType: 'student_call',
                                 contextTitle: `Voice Consultation: ${s.name}`,
                                 contextSubtitle: `${s.grade || selectedGrade} • Progress Review`,
                                 contextId: s.uid,
                                 targetParticipants: [s]
                               });
                             }} 
                             className="p-1.5 bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs transition-all"
                             title={`Voice Call ${s.name}`}
                           >
                             <Phone className="w-3.5 h-3.5" />
                           </button>
                           <button 
                             onClick={() => setActiveStudent(activeStudent === s.uid ? null : s.uid!)} 
                             className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-xs font-bold transition-all ml-1"
                           >
                             <MessageSquare className="w-3 h-3 inline mr-1" /> Remark
                           </button>
                         </div>
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
