import React, { useEffect, useState } from 'react';
import { FolderKanban, Loader2, Plus, RefreshCw, Send, Users } from 'lucide-react';
import { UserProfile } from '../../types';
import { buildWorkspaceAuthHeaders } from '../../lib/workspaceIntelligenceClient';

interface ProjectGroup {
  id: string;
  name: string;
  members: Array<{ userId: string; name: string; role: string }>;
  milestones: Array<{ id: string; title: string; status: 'todo' | 'in_progress' | 'done'; progressNote?: string }>;
  submissionText?: string;
  score?: number | null;
  feedback?: string;
  status: string;
}

interface GroupProject {
  id: string;
  title: string;
  subject: string;
  description: string;
  classGrade: string;
  dueDate: string;
  maxScore: number;
  groups: ProjectGroup[];
}

interface GroupProjectsPanelProps {
  currentUser: UserProfile | null;
  effectiveRole: string;
}

export const GroupProjectsPanel: React.FC<GroupProjectsPanelProps> = ({ currentUser, effectiveRole }) => {
  const isFaculty = ['teacher', 'faculty', 'head_teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(
    effectiveRole
  );
  const [projects, setProjects] = useState<GroupProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Create project (faculty)
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Computer Science');
  const [newDesc, setNewDesc] = useState('');

  // Create group form (faculty)
  const [groupProjectId, setGroupProjectId] = useState('');
  const [groupName, setGroupName] = useState('Team Alpha');
  const [memberIdsInput, setMemberIdsInput] = useState('');

  // Submission / Grading inputs
  const [groupSubmitText, setGroupSubmitText] = useState<Record<string, string>>({});
  const [gradeInputs, setGradeInputs] = useState<Record<string, { score: string; feedback: string }>>({});

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/assignments/group-projects', { headers });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load group projects.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [currentUser?.uid, effectiveRole]);

  const handleCreateProject = async () => {
    if (!newTitle.trim()) return;
    setError('');
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch('/api/assignments/group-projects', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Faculty',
          title: newTitle.trim(),
          subject: newSubject,
          description: newDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setNewTitle('');
      setNewDesc('');
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Could not create group project.');
    }
  };

  const handleAssignGroup = async (projectId: string) => {
    const members = memberIdsInput
      .split(',')
      .map((entry, idx) => {
        const clean = entry.trim();
        if (!clean) return null;
        return { userId: clean, name: clean, role: idx === 0 ? 'Leader' : 'Builder' };
      })
      .filter(Boolean);
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch(`/api/assignments/group-projects/${encodeURIComponent(projectId)}/groups`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          name: groupName.trim() || 'Project Team',
          members,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      setGroupProjectId('');
      setMemberIdsInput('');
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to assign group.');
    }
  };

  const handleUpdateMilestone = async (projectId: string, groupId: string, milestoneId: string, nextStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch(`/api/assignments/group-projects/${encodeURIComponent(projectId)}/milestones`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Member',
          groupId,
          milestoneId,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to update milestone.');
    }
  };

  const handleSubmitGroup = async (projectId: string, groupId: string) => {
    const text = (groupSubmitText[groupId] || '').trim();
    if (!text) return;
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch(`/api/assignments/group-projects/${encodeURIComponent(projectId)}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Student',
          groupId,
          submissionText: text,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Group submission failed.');
    }
  };

  const handleGradeGroup = async (projectId: string, group: ProjectGroup) => {
    const g = gradeInputs[group.id] || { score: String(group.score ?? ''), feedback: group.feedback || '' };
    try {
      const headers = await buildWorkspaceAuthHeaders(currentUser, effectiveRole);
      const res = await fetch(`/api/assignments/group-projects/${encodeURIComponent(projectId)}/grade`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          userId: currentUser?.uid || 'guest',
          userRole: effectiveRole,
          userName: currentUser?.name || 'Faculty',
          groupId: group.id,
          score: Number(g.score || 0),
          feedback: g.feedback,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Failed with HTTP ${res.status}`);
      await loadProjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to grade group.');
    }
  };

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-indigo-400" />
            <span>Group Projects &amp; Collaborative Milestones</span>
          </h3>
          <p className="text-xs text-slate-400">
            Manage team roles, shared milestones, group deliverables, and faculty grading with strict team isolation.
          </p>
        </div>

        <button
          type="button"
          onClick={loadProjects}
          className="p-2 rounded-xl bg-slate-950 border border-white/10 text-slate-300 hover:text-white cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isFaculty && (
        <div className="bg-slate-950/90 border border-white/10 rounded-xl p-3.5 space-y-2.5">
          <p className="text-xs font-bold text-slate-200">Create Group Project</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Project title"
              className="sm:col-span-2 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Subject"
              className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            />
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={!newTitle.trim()}
              className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Create Project
            </button>
          </div>
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Brief objectives & deliverables..."
            className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
          />
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">{error}</div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/70 rounded-xl border border-white/10 text-xs text-slate-400">
          No group projects assigned yet.
        </div>
      ) : (
        <div className="space-y-4">
          {projects.map((proj) => (
            <div key={proj.id} className="bg-slate-950/90 border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div>
                  <h4 className="text-sm font-bold text-white">{proj.title}</h4>
                  <p className="text-[11px] text-slate-400">
                    {proj.subject} · {proj.classGrade} · Due {proj.dueDate} · Max {proj.maxScore} pts
                  </p>
                </div>
                {isFaculty && (
                  <button
                    type="button"
                    onClick={() => setGroupProjectId(groupProjectId === proj.id ? '' : proj.id)}
                    className="px-3 py-1 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" /> Assign Group
                  </button>
                )}
              </div>

              {proj.description && <p className="text-xs text-slate-300">{proj.description}</p>}

              {isFaculty && groupProjectId === proj.id && (
                <div className="p-3 rounded-lg bg-slate-900 border border-indigo-500/30 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name"
                    className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={memberIdsInput}
                    onChange={(e) => setMemberIdsInput(e.target.value)}
                    placeholder="Member UIDs (comma-separated)"
                    className="bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAssignGroup(proj.id)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Group
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {proj.groups.map((grp) => {
                  const gDraft = gradeInputs[grp.id] || {
                    score: grp.score !== undefined && grp.score !== null ? String(grp.score) : '',
                    feedback: grp.feedback || '',
                  };
                  return (
                    <div key={grp.id} className="p-3 rounded-lg bg-slate-900 border border-white/10 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{grp.name}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                          {grp.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {grp.members.map((m) => (
                          <span key={m.userId} className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-white/10 text-slate-300">
                            {m.name} ({m.role})
                          </span>
                        ))}
                      </div>

                      <div className="space-y-1">
                        {grp.milestones.map((ms) => (
                          <div key={ms.id} className="flex items-center justify-between gap-2 text-[11px] bg-slate-950/70 px-2.5 py-1.5 rounded">
                            <span className="text-slate-200">{ms.title}</span>
                            <select
                              value={ms.status}
                              onChange={(e) => handleUpdateMilestone(proj.id, grp.id, ms.id, e.target.value as any)}
                              className="bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white"
                            >
                              <option value="todo">To Do</option>
                              <option value="in_progress">In Progress</option>
                              <option value="done">Done</option>
                            </select>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={groupSubmitText[grp.id] ?? grp.submissionText ?? ''}
                          onChange={(e) => setGroupSubmitText({ ...groupSubmitText, [grp.id]: e.target.value })}
                          placeholder="Group deliverable summary / link..."
                          className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitGroup(proj.id, grp.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Send className="w-3 h-3" /> Submit
                        </button>
                      </div>

                      {isFaculty && (
                        <div className="flex gap-2 pt-1 border-t border-white/10">
                          <input
                            type="number"
                            min={0}
                            max={proj.maxScore}
                            value={gDraft.score}
                            onChange={(e) => setGradeInputs({ ...gradeInputs, [grp.id]: { ...gDraft, score: e.target.value } })}
                            placeholder="Score"
                            className="w-20 bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs font-mono text-white"
                          />
                          <input
                            type="text"
                            value={gDraft.feedback}
                            onChange={(e) => setGradeInputs({ ...gradeInputs, [grp.id]: { ...gDraft, feedback: e.target.value } })}
                            placeholder="Team feedback"
                            className="flex-1 bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleGradeGroup(proj.id, grp)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                          >
                            Grade
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
