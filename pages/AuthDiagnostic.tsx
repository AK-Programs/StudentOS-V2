import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://zwpoutanhsujezglbson.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ"
);

export default function AuthDiagnostic() {
  const [logs, setLogs] = useState<string[]>([]);
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [localStorageKeys, setLocalStorageKeys] = useState<string[]>([]);

  const addLog = (msg: string, obj?: any) => {
    const logStr = `${new Date().toLocaleTimeString()} - ${msg} ${obj ? JSON.stringify(obj) : ""}`;
    console.log(msg, obj || "");
    setLogs((prev) => [...prev, logStr]);
  };

  useEffect(() => {
    addLog("HASH ON MOUNT:", window.location.hash);
    addLog("QUERY ON MOUNT:", window.location.search);

    async function test() {
      addLog("Fetching getSession()...");
      const sessionResult = await supabase.auth.getSession();
      addLog("SESSION RESULT received.");
      setSessionInfo(sessionResult);

      addLog("Fetching getUser()...");
      const userResult = await supabase.auth.getUser();
      addLog("USER RESULT received.");
      setUserInfo(userResult);

      const keys = Object.keys(localStorage);
      addLog("LOCAL STORAGE KEYS:", keys);
      setLocalStorageKeys(keys);
    }

    test();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      addLog(`AUTH EVENT TRIGGERED: ${event}`, { session: !!session });
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    addLog("Initiating Google OAuth flow...");
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth-debug"
        }
      });
      if (error) {
        addLog("Login Error:", error);
      } else {
        addLog("Login initiated successfully:", data);
      }
    } catch (err) {
      addLog("Exception during login:", err);
    }
  };

  const handleLogout = async () => {
    addLog("Signing out...");
    await supabase.auth.signOut();
    addLog("Signed out.");
    setSessionInfo(null);
    setUserInfo(null);
    setLocalStorageKeys(Object.keys(localStorage));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="border-b border-slate-800 pb-4 mb-6">
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-indigo-400">
            StudentOS Auth Diagnostic
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Completely isolated from StudentOS wrapper logic. Testing pure Supabase JS SDK behavior.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
            <div>
              <h2 className="font-semibold text-slate-300 mb-2">Controls</h2>
              <p className="text-xs text-slate-400 mb-4">
                Trigger authentication flows or clean local state.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={handleLogin}
                className="w-full bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition text-sm shadow"
              >
                Google Login
              </button>
              <button
                onClick={handleLogout}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-2 px-4 rounded-lg transition text-sm"
              >
                Sign Out / Reset
              </button>
              <button
                onClick={() => {
                  localStorage.clear();
                  addLog("Local storage cleared.");
                  setLocalStorageKeys([]);
                }}
                className="w-full bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 font-medium py-1.5 px-4 rounded-lg transition text-xs"
              >
                Force Clear LocalStorage
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg col-span-2">
            <h2 className="font-semibold text-slate-300 mb-3">Live Storage & State</h2>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-indigo-400 font-medium">Local Storage Keys:</span>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 mt-1 max-h-24 overflow-y-auto font-mono">
                  {localStorageKeys.length === 0 ? (
                    <span className="text-slate-500">[]</span>
                  ) : (
                    localStorageKeys.map((key) => (
                      <div key={key} className="text-emerald-400">
                        • {key}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-indigo-400 font-medium">Session Present:</span>
                  <div className="mt-1 font-mono">
                    {sessionInfo?.data?.session ? (
                      <span className="text-emerald-400 font-semibold">✅ YES (Expires {new Date(sessionInfo.data.session.expires_at * 1000).toLocaleTimeString()})</span>
                    ) : (
                      <span className="text-red-400 font-semibold">❌ NO</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-indigo-400 font-medium">User Present:</span>
                  <div className="mt-1 font-mono">
                    {userInfo?.data?.user ? (
                      <span className="text-emerald-400 font-semibold">✅ YES ({userInfo.data.user.email})</span>
                    ) : (
                      <span className="text-red-400 font-semibold">❌ NO</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6">
          <h2 className="font-semibold text-slate-300 mb-3">SDK Response Inspect</h2>
          <div className="space-y-4 text-xs font-mono">
            <div>
              <span className="text-pink-400 font-medium">getSession() Result:</span>
              <pre className="bg-slate-950 p-3 rounded border border-slate-800 mt-1 max-h-48 overflow-y-auto text-slate-300">
                {JSON.stringify(sessionInfo, null, 2)}
              </pre>
            </div>
            <div>
              <span className="text-pink-400 font-medium">getUser() Result:</span>
              <pre className="bg-slate-950 p-3 rounded border border-slate-800 mt-1 max-h-48 overflow-y-auto text-slate-300">
                {JSON.stringify(userInfo, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold text-slate-300">Console Trace Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Clear Logs
            </button>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs h-64 overflow-y-auto space-y-1.5">
            {logs.length === 0 ? (
              <div className="text-slate-600 italic">No logs recorded yet. Try clicking controls.</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-slate-300 border-b border-slate-900/50 pb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
