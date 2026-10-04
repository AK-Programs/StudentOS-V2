import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, Dices, Shuffle, Zap, HelpCircle, Trophy, RefreshCw, 
  Play, Pause, RotateCcw, Volume2, Flame, CheckCircle, Clock, Users, Gift,
  Maximize, Minimize, Shield, Award, Check, X, Star, Bell, Music, Smile,
  Grid, Compass, Hash, Send, Brain
} from 'lucide-react';
import { UserProfile, HouseType } from '../types';

interface TeacherFunZoneProps {
  currentUser: UserProfile;
}

const MOCK_STUDENTS = [
  'Aarav Sharma', 'Rohan Mehta', 'Kavya Singh', 'Ananya Gupta', 
  'Priya Nair', 'Siddharth Rao', 'Diya Kapoor', 'Vikram Joshi',
  'Ishaan Patel', 'Meera Reddy', 'Aditya Verma', 'Sanya Malhotra'
];

const DEFAULT_WHEEL_ITEMS = [
  'Answer Next Question ❓', 'Choose Next Student 👈', '+20 House Points 🌟',
  'Bonus Star Badge ⭐', 'Sing a Song 🎵', 'Tell a Math Joke 😂',
  'Skip Turn 🛑', 'Pass Question to Friend 🤝'
];

const RAPID_FIRE_QUESTIONS = [
  { q: 'What is the speed of light in vacuum?', a: '3 × 10^8 m/s' },
  { q: 'Which element has atomic number 1?', a: 'Hydrogen' },
  { q: 'Who discovered Penicillin?', a: 'Alexander Fleming' },
  { q: 'What is the derivative of sin(x)?', a: 'cos(x)' },
  { q: 'In which year did India gain independence?', a: '1947' },
  { q: 'What is the powerhouse of the cell?', a: 'Mitochondria' },
  { q: 'Which planet is known as the Red Planet?', a: 'Mars' },
  { q: 'What is the chemical formula of Water?', a: 'H2O' }
];

const EMOJI_GUESS_QUESTIONS = [
  { emoji: '🍎 🔍 📐', answer: 'Isaac Newton & Gravity', hint: 'Physics discovery' },
  { emoji: '⚡ 💡 🏛️', answer: 'Electricity & Benjamin Franklin', hint: 'Invention' },
  { emoji: '🚀 🌑 👨‍🚀', answer: 'Apollo 11 Moon Landing', hint: 'Space milestone' },
  { emoji: '🧪 ⚗️ 🧫', answer: 'Chemistry Experiment', hint: 'Science lab' }
];

const TRUE_FALSE_QUESTIONS = [
  { q: 'Sound travels faster in water than in air.', a: true, explanation: 'Water is denser, so sound waves propagate faster (~1480 m/s vs 343 m/s).' },
  { q: 'The sun is a planet.', a: false, explanation: 'The Sun is a main-sequence star.' },
  { q: 'Light travels in straight lines.', a: true, explanation: 'Except when bent by heavy gravitational fields or refraction.' },
  { q: 'DNA stands for Deoxyribonucleic Acid.', a: true, explanation: 'Correct genetic molecule name.' }
];

// Audio Sound Effect Helper using Web Audio API
const playSound = (type: 'beep' | 'win' | 'buzzer' | 'tick' | 'fanfare') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'tick') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } else if (type === 'win') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.3); // C6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'buzzer') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) {
    // Audio context silent catch
  }
};

export const TeacherFunZone: React.FC<TeacherFunZoneProps> = ({ currentUser }) => {
  const [activeGame, setActiveGame] = useState<'picker' | 'wheel' | 'rapid' | 'buzzer' | 'emoji' | 'tf' | 'math' | 'dice'>('picker');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Class & Section Filters
  const [selectedGrade, setSelectedGrade] = useState<string>('Grade 10');
  const [selectedSection, setSelectedSection] = useState<string>('Solara');
  const [activeStudents, setActiveStudents] = useState<string[]>([]);

  // Fetch / Query students matching Class & Section at data level
  useEffect(() => {
    const fetchStudentsForClassSection = async () => {
      try {
        let query = supabase.from('user_profiles').select('name, grade, section').eq('role', 'student');
        if (selectedGrade && selectedGrade !== 'All Classes') {
          const num = selectedGrade.replace('Grade ', '').trim();
          query = query.ilike('grade', `%${num}%`);
        }
        if (selectedSection && selectedSection !== 'All Sections') {
          query = query.ilike('section', `%${selectedSection}%`);
        }
        let { data, error } = await query;
        if ((error || !data || data.length === 0)) {
          let fallbackQuery = supabase.from('users').select('name, grade, section').eq('role', 'student');
          if (selectedGrade && selectedGrade !== 'All Classes') {
            const num = selectedGrade.replace('Grade ', '').trim();
            fallbackQuery = fallbackQuery.ilike('grade', `%${num}%`);
          }
          if (selectedSection && selectedSection !== 'All Sections') {
            fallbackQuery = fallbackQuery.ilike('section', `%${selectedSection}%`);
          }
          const res = await fallbackQuery;
          if (res.data && res.data.length > 0) data = res.data;
        }

        if (data && data.length > 0) {
          setActiveStudents(data.map((s: any) => s.name));
          return;
        }
      } catch (err) {
        console.warn('FunZone student query warning:', err);
      }

      // Filtered fallback
      const filtered = MOCK_STUDENTS.map((name, i) => `${name} (${selectedGrade} ${selectedSection})`);
      setActiveStudents(filtered);
    };

    fetchStudentsForClassSection();
  }, [selectedGrade, selectedSection]);

  // House/Team Scoreboard State
  const [houseScores, setHouseScores] = useState<Record<string, number>>({
    Ruby: 120,
    Emerald: 110,
    Sapphire: 95,
    Topaz: 90
  });

  // Confetti / Celebration
  const [celebrationWinner, setCelebrationWinner] = useState<string | null>(null);

  // Random Student Picker State
  const [pickedStudent, setPickedStudent] = useState<string | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  // Spin Wheel State
  const [wheelItems, setWheelItems] = useState<string[]>(DEFAULT_WHEEL_ITEMS);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [wheelWinner, setWheelWinner] = useState<string | null>(null);

  // Rapid Fire State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [timer, setTimer] = useState(30);
  const [timerActive, setTimerActive] = useState(false);

  // Buzzer Quiz State
  const [buzzedStudent, setBuzzedStudent] = useState<string | null>(null);
  const [buzzerActive, setBuzzerActive] = useState(false);

  // Emoji Quiz State
  const [emojiIdx, setEmojiIdx] = useState(0);
  const [showEmojiAns, setShowEmojiAns] = useState(false);

  // True or False State
  const [tfIdx, setTfIdx] = useState(0);
  const [tfFeedback, setTfFeedback] = useState<string | null>(null);

  // Math Race State
  const [mathProblem, setMathProblem] = useState({ q: '24 × 8 + 16', a: 208 });
  const [mathInput, setMathInput] = useState('');
  const [mathResult, setMathResult] = useState<string | null>(null);

  // Dice Roll State
  const [diceCount, setDiceCount] = useState(2);
  const [diceResults, setDiceResults] = useState<number[]>([4, 6]);
  const [isRolling, setIsRolling] = useState(false);

  // Timer Effect
  useEffect(() => {
    let interval: any;
    if (timerActive && timer > 0) {
      interval = setInterval(() => {
        setTimer(t => {
          if (t <= 1) {
            playSound('buzzer');
            setTimerActive(false);
            return 0;
          }
          playSound('tick');
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, timer]);

  // Handlers
  const triggerCelebration = (msg: string) => {
    setCelebrationWinner(msg);
    playSound('win');
    setTimeout(() => setCelebrationWinner(null), 4000);
  };

  const handlePickRandomStudent = () => {
    const pool = activeStudents.length > 0 ? activeStudents : MOCK_STUDENTS;
    setIsPicking(true);
    setPickedStudent(null);
    let count = 0;
    const interval = setInterval(() => {
      playSound('tick');
      const idx = Math.floor(Math.random() * pool.length);
      setPickedStudent(pool[idx]);
      count++;
      if (count > 20) {
        clearInterval(interval);
        setIsPicking(false);
        triggerCelebration(`🎯 Selected: ${pool[idx]}`);
      }
    }, 80);
  };

  const handleSpinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    setWheelWinner(null);
    playSound('beep');
    const extraDeg = Math.floor(Math.random() * 360) + 1440;
    const newRotation = wheelRotation + extraDeg;
    setWheelRotation(newRotation);

    setTimeout(() => {
      setSpinning(false);
      const actualDeg = newRotation % 360;
      const sliceSize = 360 / wheelItems.length;
      const winnerIdx = Math.floor((360 - (actualDeg % 360)) / sliceSize) % wheelItems.length;
      const result = wheelItems[winnerIdx];
      setWheelWinner(result);
      triggerCelebration(`🎡 Result: ${result}`);
    }, 3500);
  };

  const handlePressBuzzer = (studentName: string) => {
    if (!buzzerActive) return;
    setBuzzedStudent(studentName);
    setBuzzerActive(false);
    playSound('buzzer');
    triggerCelebration(`🔔 ${studentName} buzzed in first!`);
  };

  const handleRollDice = () => {
    setIsRolling(true);
    playSound('beep');
    setTimeout(() => {
      const results = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      setDiceResults(results);
      setIsRolling(false);
      playSound('win');
    }, 600);
  };

  const generateNewMath = () => {
    const a = Math.floor(Math.random() * 20) + 10;
    const b = Math.floor(Math.random() * 10) + 2;
    const c = Math.floor(Math.random() * 30) + 5;
    const ans = a * b + c;
    setMathProblem({ q: `${a} × ${b} + ${c}`, a: ans });
    setMathInput('');
    setMathResult(null);
  };

  const addHouseScore = (house: string, pts: number) => {
    setHouseScores(prev => ({
      ...prev,
      [house]: (prev[house] || 0) + pts
    }));
    playSound('win');
  };

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans transition-all ${isFullscreen ? 'p-2' : 'p-3.5 sm:p-6 max-w-7xl mx-auto space-y-6'}`}>
      
      {/* Celebration Banner */}
      <AnimatePresence>
        {celebrationWinner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 border-2 border-amber-300 px-5 sm:px-8 py-3 sm:py-4 rounded-3xl shadow-2xl text-center max-w-[92vw]"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-amber-300 animate-bounce shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest block">WINNER CELEBRATION</span>
                <span className="text-base sm:text-xl font-black text-white truncate block">{celebrationWinner}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title & House Scoreboard Bar */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-purple-500/30 shadow-2xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Smart-Board Classroom Experience
            </span>
            <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full text-[10px] font-bold border border-indigo-500/30">
              Interactive Games Engine
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            Teacher <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-400 bg-clip-text text-transparent">Fun Zone</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Energize live classes with random pickers, rapid-fire quizzes, buzzers, emoji games, true/false battles, and real-time house scorekeeping.
          </p>

          {/* Class & Section Data-Level Filter Controls */}
          <div className="mt-3 flex flex-wrap items-center gap-2 bg-slate-950/60 p-2.5 rounded-2xl border border-indigo-500/30">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Target Roster:</span>
            </div>
            <select 
              value={selectedGrade} 
              onChange={e => setSelectedGrade(e.target.value)}
              className="bg-slate-900 border border-white/10 text-white text-xs font-bold px-2.5 py-1 rounded-xl outline-none focus:border-indigo-500"
            >
              {['All Classes', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select 
              value={selectedSection} 
              onChange={e => setSelectedSection(e.target.value)}
              className="bg-slate-900 border border-white/10 text-white text-xs font-bold px-2.5 py-1 rounded-xl outline-none focus:border-indigo-500"
            >
              {['All Sections', 'Solara', 'Vega', 'Astra', 'Elara', 'Ruby'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="text-[10px] text-indigo-300 font-mono font-extrabold px-2 py-0.5 bg-indigo-500/15 rounded-lg border border-indigo-500/20">
              {activeStudents.length} Active Participants
            </span>
          </div>
        </div>

        {/* Live House Scoreboard */}
        <div className="bg-slate-950/80 p-3 rounded-2xl border border-white/10 flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3">
          {Object.entries(houseScores).map(([house, pts]) => {
            const colors: Record<string, string> = {
              Ruby: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
              Emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
              Sapphire: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
              Topaz: 'text-amber-400 border-amber-500/30 bg-amber-500/10'
            };
            return (
              <div key={house} className={`px-2.5 sm:px-3 py-1.5 rounded-xl border flex flex-col items-center ${colors[house]}`}>
                <span className="text-[10px] font-black uppercase">{house}</span>
                <span className="text-xs sm:text-sm font-mono font-black">{pts} pts</span>
                <button
                  onClick={() => addHouseScore(house, 10)}
                  className="mt-1 text-[9px] font-bold text-white bg-white/10 hover:bg-white/20 px-1.5 py-0.5 rounded"
                  title="Add +10 points"
                >
                  +10
                </button>
              </div>
            );
          })}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-white/10 transition-all sm:ml-2"
            title="Toggle Smart-Board Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-5 h-5 text-amber-400" /> : <Maximize className="w-5 h-5 text-amber-400" />}
          </button>
        </div>
      </div>

      {/* Game Mode Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
        {[
          { id: 'picker', label: 'Random Student', icon: Shuffle },
          { id: 'wheel', label: 'Spin Wheel', icon: RefreshCw },
          { id: 'rapid', label: 'Rapid Fire Quiz', icon: Zap },
          { id: 'buzzer', label: 'Buzzer Race', icon: Bell },
          { id: 'emoji', label: 'Emoji Guess', icon: Smile },
          { id: 'tf', label: 'True or False', icon: CheckCircle },
          { id: 'math', label: 'Math Race', icon: Brain },
          { id: 'dice', label: 'Dice Roller', icon: Dices }
        ].map(g => {
          const Icon = g.icon;
          const isActive = activeGame === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGame(g.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>

      {/* GAME STAGE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-2xl flex-1 flex flex-col justify-center">
        
        {/* GAME 1: RANDOM STUDENT PICKER */}
        {activeGame === 'picker' && (
          <div className="space-y-6 text-center max-w-2xl mx-auto py-8">
            <div className="inline-block p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
              <Shuffle className="w-12 h-12 text-indigo-400 animate-pulse" />
            </div>

            <h3 className="text-2xl font-black text-white">Random Student Picker</h3>
            <p className="text-xs text-slate-400">Fairly select a student to answer, demonstrate, or lead the next discussion.</p>

            <div className="h-32 bg-slate-950 border-2 border-indigo-500/40 rounded-3xl flex items-center justify-center p-6 shadow-inner relative overflow-hidden">
              <span className={`text-2xl md:text-3xl font-black font-mono tracking-tight ${isPicking ? 'text-indigo-400 animate-bounce' : 'text-amber-300'}`}>
                {pickedStudent || 'Click "Pick Random Student" below!'}
              </span>
            </div>

            <button
              onClick={handlePickRandomStudent}
              disabled={isPicking}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {isPicking ? 'Shuffling Students...' : '🎯 Pick Random Student'}
            </button>
          </div>
        )}

        {/* GAME 2: SPIN WHEEL */}
        {activeGame === 'wheel' && (
          <div className="space-y-6 text-center max-w-xl mx-auto py-4">
            <h3 className="text-xl font-black text-white">Classroom Reward Spin Wheel</h3>
            <p className="text-xs text-slate-400">Spin for bonus house points, star badges, or classroom activities.</p>

            <div className="relative w-48 h-48 sm:w-64 sm:h-64 max-w-full aspect-square mx-auto my-4">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl z-20 text-red-500 drop-shadow-md">
                ▼
              </div>

              <div
                className="w-full h-full rounded-full border-4 border-amber-400 bg-slate-950 shadow-2xl relative overflow-hidden transition-transform duration-[3500ms] ease-out flex items-center justify-center"
                style={{ transform: `rotate(${wheelRotation}deg)` }}
              >
                <div className="text-center font-bold text-xs text-indigo-300 p-4">
                  🎡 {wheelItems.length} Rewards Loaded
                </div>
              </div>
            </div>

            {wheelWinner && (
              <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-2xl animate-fadeIn">
                <span className="text-xs font-black text-amber-300 uppercase block">🎉 Wheel Result</span>
                <span className="text-lg font-extrabold text-white">{wheelWinner}</span>
              </div>
            )}

            <button
              onClick={handleSpinWheel}
              disabled={spinning}
              className="px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50"
            >
              {spinning ? 'Spinning Wheel...' : '🎡 Spin the Wheel'}
            </button>
          </div>
        )}

        {/* GAME 3: RAPID FIRE QUIZ */}
        {activeGame === 'rapid' && (
          <div className="space-y-6 max-w-xl mx-auto py-4">
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-mono font-bold text-amber-400">Timer: {timer}s</span>
              </div>
              <button
                onClick={() => { setTimer(30); setTimerActive(!timerActive); }}
                className="px-3 py-1 bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold rounded-lg"
              >
                {timerActive ? 'Pause Timer' : 'Start 30s Timer'}
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-center space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                Question {currentQIndex + 1} of {RAPID_FIRE_QUESTIONS.length}
              </span>
              <h4 className="text-lg font-black text-white leading-relaxed">
                {RAPID_FIRE_QUESTIONS[currentQIndex].q}
              </h4>

              {showAnswer ? (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-sm animate-fadeIn">
                  Answer: {RAPID_FIRE_QUESTIONS[currentQIndex].a}
                </div>
              ) : (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="px-4 py-2 bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-xl"
                >
                  Show Answer
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={() => {
                  setShowAnswer(false);
                  setCurrentQIndex(i => (i + 1) % RAPID_FIRE_QUESTIONS.length);
                }}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md"
              >
                Next Question →
              </button>
            </div>
          </div>
        )}

        {/* GAME 4: BUZZER RACE */}
        {activeGame === 'buzzer' && (
          <div className="space-y-6 text-center max-w-xl mx-auto py-4">
            <h3 className="text-2xl font-black text-white">Classroom Buzzer Race</h3>
            <p className="text-xs text-slate-400">Activate buzzer mode to see who presses in first!</p>

            <button
              onClick={() => {
                setBuzzerActive(true);
                setBuzzedStudent(null);
                playSound('beep');
              }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider shadow-lg"
            >
              🔔 Arm Classroom Buzzers
            </button>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              {MOCK_STUDENTS.slice(0, 8).map(st => (
                <button
                  key={st}
                  onClick={() => handlePressBuzzer(st)}
                  className={`p-4 rounded-2xl border text-xs font-extrabold transition-all shadow-md active:scale-95 ${
                    buzzedStudent === st
                      ? 'bg-amber-500 text-slate-950 border-amber-300 scale-105'
                      : 'bg-slate-950 border-white/10 hover:border-indigo-500 text-slate-200'
                  }`}
                >
                  <Bell className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                  <span>{st}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GAME 5: EMOJI GUESS */}
        {activeGame === 'emoji' && (
          <div className="space-y-6 text-center max-w-lg mx-auto py-6">
            <h3 className="text-xl font-black text-white">Guess the Academic Concept by Emoji</h3>
            <div className="p-4 sm:p-8 bg-slate-950 border border-white/10 rounded-3xl text-3xl sm:text-5xl tracking-widest my-4 shadow-2xl break-words">
              {EMOJI_GUESS_QUESTIONS[emojiIdx].emoji}
            </div>

            <p className="text-xs text-slate-400 italic">Hint: {EMOJI_GUESS_QUESTIONS[emojiIdx].hint}</p>

            {showEmojiAns ? (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black text-base rounded-2xl">
                {EMOJI_GUESS_QUESTIONS[emojiIdx].answer}
              </div>
            ) : (
              <button
                onClick={() => setShowEmojiAns(true)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
              >
                Reveal Concept
              </button>
            )}

            <button
              onClick={() => {
                setShowEmojiAns(false);
                setEmojiIdx((emojiIdx + 1) % EMOJI_GUESS_QUESTIONS.length);
              }}
              className="block mx-auto text-xs text-indigo-400 hover:underline font-bold mt-2"
            >
              Next Emoji Challenge →
            </button>
          </div>
        )}

        {/* GAME 6: TRUE OR FALSE BATTLE */}
        {activeGame === 'tf' && (
          <div className="space-y-6 text-center max-w-lg mx-auto py-6">
            <h3 className="text-xl font-black text-white">True or False Challenge</h3>
            <div className="p-6 bg-slate-950 border border-white/10 rounded-3xl text-base font-bold text-white shadow-xl">
              {TRUE_FALSE_QUESTIONS[tfIdx].q}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setTfFeedback(TRUE_FALSE_QUESTIONS[tfIdx].a === true ? 'Correct! ' + TRUE_FALSE_QUESTIONS[tfIdx].explanation : 'Incorrect!')}
                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg"
              >
                TRUE
              </button>
              <button
                onClick={() => setTfFeedback(TRUE_FALSE_QUESTIONS[tfIdx].a === false ? 'Correct! ' + TRUE_FALSE_QUESTIONS[tfIdx].explanation : 'Incorrect!')}
                className="flex-1 py-4 bg-rose-600 hover:bg-rose-500 text-white font-black text-sm rounded-2xl shadow-lg"
              >
                FALSE
              </button>
            </div>

            {tfFeedback && (
              <div className="p-4 bg-indigo-950 border border-indigo-500/40 text-indigo-200 text-xs font-bold rounded-2xl">
                {tfFeedback}
              </div>
            )}

            <button
              onClick={() => {
                setTfFeedback(null);
                setTfIdx((tfIdx + 1) % TRUE_FALSE_QUESTIONS.length);
              }}
              className="block mx-auto text-xs text-indigo-400 hover:underline font-bold"
            >
              Next Question →
            </button>
          </div>
        )}

        {/* GAME 7: MATH RACE */}
        {activeGame === 'math' && (
          <div className="space-y-6 text-center max-w-md mx-auto py-6">
            <h3 className="text-xl font-black text-white">Speed Math Sprint</h3>
            <div className="p-6 bg-slate-950 border-2 border-amber-500/40 rounded-3xl font-mono text-3xl font-black text-amber-300">
              {mathProblem.q} = ?
            </div>

            <div className="flex flex-col min-[320px]:flex-row gap-2">
              <input
                type="number"
                value={mathInput}
                onChange={e => setMathInput(e.target.value)}
                placeholder="Enter answer..."
                className="flex-1 min-w-0 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-center text-white font-mono font-bold"
              />
              <button
                onClick={() => {
                  if (parseInt(mathInput) === mathProblem.a) {
                    setMathResult('🎉 Correct Answer!');
                    playSound('win');
                  } else {
                    setMathResult('❌ Try again!');
                    playSound('buzzer');
                  }
                }}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shrink-0"
              >
                Check
              </button>
            </div>

            {mathResult && (
              <div className="p-3 bg-slate-950 border border-white/10 font-bold text-xs text-indigo-300 rounded-xl">
                {mathResult}
              </div>
            )}

            <button onClick={generateNewMath} className="text-xs text-indigo-400 hover:underline font-bold">
              New Math Question ↻
            </button>
          </div>
        )}

        {/* GAME 8: DICE ROLLER */}
        {activeGame === 'dice' && (
          <div className="space-y-6 text-center max-w-md mx-auto py-8">
            <h3 className="text-xl font-black text-white">Classroom Dice Roller</h3>
            <p className="text-xs text-slate-400">Roll dice for group numbers, teams, or math probabilities.</p>

            <div className="flex items-center justify-center gap-4 my-6">
              {diceResults.map((val, idx) => (
                <div
                  key={idx}
                  className={`w-20 h-20 rounded-2xl bg-amber-500 text-slate-950 font-black text-4xl flex items-center justify-center shadow-xl ${isRolling ? 'animate-spin' : ''}`}
                >
                  {val}
                </div>
              ))}
            </div>

            <button
              onClick={handleRollDice}
              disabled={isRolling}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-2xl shadow-xl transition-all"
            >
              🎲 Roll Dice
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default TeacherFunZone;
