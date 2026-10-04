import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { saveSupabaseUserProfile } from '../lib/supabaseUsers';

export default function UserImportCSV() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [report, setReport] = useState<{ imported: number, failed: number, duplicates: number, errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const processCSV = async () => {
    if (!file) return;
    setIsProcessing(true);
    setReport(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        
        if (rows.length <= 1) {
          setReport({ imported: 0, failed: 0, duplicates: 0, errors: ["File is empty or missing headers."] });
          setIsProcessing(false);
          return;
        }

        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const dataRows = rows.slice(1);

        let imported = 0;
        let failed = 0;
        let duplicates = 0;
        let errors: string[] = [];

        for (const row of dataRows) {
          const values = row.split(',').map(v => v.trim());
          const user: any = {};
          
          headers.forEach((h, i) => {
            if (h === 'name') user.name = values[i];
            if (h === 'email') user.email = values[i];
            if (h === 'role') user.role = values[i] || 'student';
            if (h === 'class' || h === 'grade') user.grade = values[i];
            if (h === 'section') user.section = values[i];
          });

          if (!user.email || !user.name) {
            failed++;
            errors.push(`Row missing name or email: ${row}`);
            continue;
          }

          try {
            // Check if user already exists
            const { data: existing } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('email', user.email.toLowerCase())
              .maybeSingle();

            if (existing) {
              duplicates++;
              continue;
            }

            // Create user profile
            const tempUid = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            await saveSupabaseUserProfile({
              uid: tempUid,
              email: user.email,
              name: user.name,
              role: user.role as any,
              grade: user.grade,
              section: user.section,
              requestedRole: user.role,
              accountStatus: 'approved'
            } as any);

            imported++;
          } catch (err: any) {
            failed++;
            errors.push(`Failed to import ${user.email}: ${err.message}`);
          }
        }

        setReport({ imported, failed, duplicates, errors });
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-900 border border-indigo-500/20 p-6 rounded-2xl animate-fadeIn space-y-6">
      <div>
        <h4 className="text-white font-bold text-lg">Bulk Import Users</h4>
        <p className="text-xs text-slate-400">Upload a CSV file to create users in bulk. Required headers: Name, Email, Role, Class, Section.</p>
      </div>

      <div className="flex items-center gap-4">
        <input 
          type="file" 
          accept=".csv" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileChange}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-colors flex items-center gap-2"
        >
          <FileText className="w-4 h-4" /> {file ? file.name : "Select CSV File"}
        </button>
        <button 
          onClick={processCSV}
          disabled={!file || isProcessing}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
        >
          {isProcessing ? 'Processing...' : <><Upload className="w-4 h-4" /> Start Import</>}
        </button>
      </div>

      {report && (
        <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-4">
          <h5 className="text-white text-sm font-bold">Import Report</h5>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-center">
              <span className="block text-2xl font-black text-emerald-400">{report.imported}</span>
              <span className="text-[10px] uppercase font-bold text-emerald-500/70 tracking-wider">Imported</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-center">
              <span className="block text-2xl font-black text-amber-400">{report.duplicates}</span>
              <span className="text-[10px] uppercase font-bold text-amber-500/70 tracking-wider">Duplicates</span>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-center">
              <span className="block text-2xl font-black text-red-400">{report.failed}</span>
              <span className="text-[10px] uppercase font-bold text-red-500/70 tracking-wider">Failed</span>
            </div>
          </div>
          
          {report.errors.length > 0 && (
            <div className="mt-4 max-h-32 overflow-y-auto custom-scrollbar">
              <ul className="space-y-1">
                {report.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-400 flex items-start gap-2">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" /> {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
