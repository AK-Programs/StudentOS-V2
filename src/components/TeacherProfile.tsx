import React, { useState } from 'react';
import { UserProfile } from '../types';
import TeacherStudentList from './TeacherStudentList';
import TeacherStudentReports from './TeacherStudentReports';
import StudentMarksCenter from './StudentMarksCenter';
import ProfileCustomizer from './ProfileCustomizer';
import { ProfileSettings } from './ProfileSettings';
import { ProfessionalTabDropdown } from './ProfessionalTabDropdown';
import { Users, Settings, FileBarChart, Award } from 'lucide-react';

export default function TeacherProfile({ currentUser, handleSaveProfile, profileNameInput, setProfileNameInput, profileAvatar, setProfileAvatar, profileTab, setProfileTab, onProfileUpdated }: any) {
  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn">
      {/* Teacher Information */}
      <section className="bg-slate-900 border border-white/5 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl space-y-6">
        <h3 className="text-lg sm:text-xl font-black text-white font-display border-b border-white/5 pb-4">Teacher Information</h3>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6">
          <img src={profileAvatar} className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border border-white/10" alt="Avatar"/>
          <div className="flex-1 space-y-4 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Full Name</label>
                <div className="text-sm px-4 py-3 bg-white/5 rounded-xl text-white font-medium">{currentUser.name}</div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400">Assigned Subject</label>
                <div className="text-sm px-4 py-3 bg-white/5 rounded-xl text-white font-medium">{currentUser.specialtySubject || 'General Science'}</div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-400">Assigned Classes & Sections</label>
                <div className="text-sm px-4 py-3 bg-white/5 rounded-xl text-white font-medium">{(currentUser.assignedClasses || []).map((c: string) => c.replace('_', ' - ')).join(', ') || 'None Assigned'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Dropdown for specific modules */}
      <div className="relative z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-slate-950/80 border border-white/10 rounded-2xl">
          <div className="w-full sm:max-w-md">
            <ProfessionalTabDropdown
              options={[
                { id: 'my_students', label: 'My Students Directory', icon: <Users className="w-4 h-4" />, description: 'View assigned class rosters & profiles' },
                { id: 'settings', label: 'Account Settings & Themes', icon: <Settings className="w-4 h-4" />, description: 'Customize profile cards and preferences' },
                { id: 'reports', label: 'Student Progress Reports', icon: <FileBarChart className="w-4 h-4" />, description: 'Term assessment summaries and records' },
                { id: 'marks_center', label: 'Marks & Assessment Centre', icon: <Award className="w-4 h-4" />, description: 'Enter evaluations and test scores' }
              ]}
              selectedId={profileTab === 'customizer' ? 'settings' : profileTab}
              onSelect={(id) => setProfileTab(id)}
              size="md"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5 text-xs text-slate-300">
            <span className="text-slate-500 font-medium">Active Module:</span>
            <span className="font-bold text-indigo-400 capitalize">
              {(profileTab === 'customizer' ? 'settings' : profileTab).replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full">
         {profileTab === 'my_students' && (
           <TeacherStudentList currentUser={currentUser} />
         )}
         {(profileTab === 'settings' || profileTab === 'customizer') && (
           <ProfileSettings 
             currentUser={currentUser} 
             onProfileUpdated={onProfileUpdated} 
           />
         )}
         {profileTab === 'reports' && (
           <TeacherStudentReports currentUser={currentUser} />
         )}
         {profileTab === 'marks_center' && (
           <StudentMarksCenter currentUser={currentUser} />
         )}
      </div>
    </div>
  );
}
