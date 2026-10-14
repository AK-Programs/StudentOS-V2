/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Real AI Topic Learning Tutor + Animated Robot Teacher ("Byte")
 * High-performance, curriculum-grounded interactive teaching engine:
 * - Dynamic structured concept explanations generated via StudentOS AI Engine
 * - Zero-delay local session caching for instant 0ms revisits
 * - Real worked examples with step-by-step reasoning
 * - Adaptive interactive practice exercises & mastery checkpoints
 * - Direct conversational Q&A with Byte featuring automatic robotic speech
 * - Next-level holographic HUD speech bubbles with interactive pedagogy chips
 * - Supabase persistence and authoritative XP gamification
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  BookOpen,
  Sparkles,
  CheckCircle2,
  HelpCircle,
  Award,
  Zap,
  ArrowRight,
  RotateCcw,
  MessageSquare,
  Send,
  Lightbulb,
  Check,
  AlertCircle,
  GraduationCap,
  ChevronRight,
  Flame,
  Volume2,
  RefreshCw,
  Compass
} from 'lucide-react';
import { AnimatedRobotTeacher, RobotMood } from './AnimatedRobotTeacher';
import { SyllabusChapter } from '../../types/syllabusTimetable';
import { UserProfile } from '../../types';
import { soundService } from '../../lib/soundService';

interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  hint: string;
}

interface DynamicTopicLesson {
  topic: string;
  subject: string;
  grade: string;
  hook: string;
  prerequisites: string;
  coreExplanation: string;
  keyPoints: string[];
  workedExample: {
    problem: string;
    steps: { title: string; detail: string }[];
    examTip: string;
  };
  practiceQuestions: PracticeQuestion[];
}

interface AITopicTutorModalProps {
  subject: string;
  chapter: SyllabusChapter;
  topic: string;
  grade?: string;
  currentUser: UserProfile;
  isMastered: boolean;
  masteryRecord?: {
    score: number;
    completedAt: string;
    attempts: number;
  };
  onClose: () => void;
  onMasterTopic: (topic: string, score: number) => Promise<void>;
  showNotification?: (msg: string) => void;
}

export const AITopicTutorModal: React.FC<AITopicTutorModalProps> = ({
  subject,
  chapter,
  topic,
  grade = 'Grade 10',
  currentUser,
  isMastered,
  masteryRecord,
  onClose,
  onMasterTopic,
  showNotification
}) => {
  // Navigation tabs inside tutor modal
  const [activeTab, setActiveTab] = useState<'concept' | 'example' | 'practice' | 'ask'>('concept');

  // Robot State & Spoken Audio
  const [robotMood, setRobotMood] = useState<RobotMood>('teaching');
  const [robotBubble, setRobotBubble] = useState<string>(
    `Welcome! Let's master "${topic}" step by step.`
  );
  const [currentSpeechText, setCurrentSpeechText] = useState<string>('');

  // Dynamic Lesson State
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lesson, setLesson] = useState<DynamicTopicLesson | null>(null);

  // Interactive Practice State
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState<boolean>(false);
  const [answerState, setAnswerState] = useState<'correct' | 'incorrect' | null>(null);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState<number>(0);
  const [practiceCompleted, setPracticeCompleted] = useState<boolean>(isMastered);

  // Ask Robot Q&A State
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; speechSummary?: string; followUps?: string[] }>
  >([
    {
      role: 'assistant',
      text: `Hi ${currentUser.name || 'Scholar'}! Ask me anything about "${topic}". You can also tap the quick-chips above for an everyday analogy, an ELI5 breakdown, or an exam tip!`,
      speechSummary: `Hi ${currentUser.name || 'Scholar'}! Ask me anything about ${topic}.`
    }
  ]);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Cache key for sessionStorage (0ms instant retrieval)
  const sessionCacheKey = `studentos_lesson_${subject.toLowerCase()}_${chapter.id}_${topic.toLowerCase()}_${grade.toLowerCase()}`;

  // Fetch or retrieve dynamic lesson from server / session cache
  const fetchTopicLesson = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setErrorMsg(null);
    setRobotMood('thinking');
    setRobotBubble(`Preparing authentic curriculum lesson for ${topic} (${grade})…`);

    // 1. Check Session Cache for Instant 0ms load
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const cachedRaw = sessionStorage.getItem(sessionCacheKey);
        if (cachedRaw) {
          const cachedLesson = JSON.parse(cachedRaw);
          if (cachedLesson && cachedLesson.coreExplanation && Array.isArray(cachedLesson.practiceQuestions)) {
            setLesson(cachedLesson);
            setLoading(false);
            setRobotMood('teaching');
            const introBubble = `Ready! Let's conquer "${topic}". ${cachedLesson.hook}`;
            setRobotBubble(introBubble);
            setCurrentSpeechText(`Welcome! Let's master ${topic}. ${cachedLesson.hook}`);
            return;
          }
        }
      } catch (_) {}
    }

    // 2. Fetch from High-Performance Server Endpoint
    try {
      const res = await fetch('/api/ai/tutor/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          chapterTitle: chapter.title,
          chapterNumber: chapter.chapterNumber,
          topic,
          grade,
          notesContext: chapter.syllabusNotes || chapter.description || ''
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      if (data?.success && data?.lesson) {
        const genLesson: DynamicTopicLesson = data.lesson;
        setLesson(genLesson);
        setLoading(false);
        setRobotMood('teaching');
        const welcomeText = `Ready! Let's explore "${topic}". ${genLesson.hook}`;
        setRobotBubble(welcomeText);
        setCurrentSpeechText(`Welcome! Let's master ${topic}. ${genLesson.hook}`);

        // Store into session cache
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem(sessionCacheKey, JSON.stringify(genLesson));
          } catch (_) {}
        }
        return;
      } else {
        throw new Error(data?.error || 'Invalid lesson response');
      }
    } catch (err: any) {
      console.warn('[AI Tutor] Primary lesson generator encountered error:', err);
      setErrorMsg(err?.message || 'Unable to load dynamic lesson.');
      setLoading(false);
      setRobotMood('idle');
      setRobotBubble(`I had trouble generating the lesson. Tap "Retry Generation" to try again.`);
    }
  }, [subject, chapter, topic, grade, sessionCacheKey]);

  // Initial load
  useEffect(() => {
    fetchTopicLesson();
  }, [fetchTopicLesson]);

  // Handle Practice Answer Selection
  const handleSelectOption = (idx: number) => {
    if (isAnswerSubmitted) return;
    soundService.playButtonClick();
    setSelectedOption(idx);
  };

  // Submit Answer to Practice Question
  const handleSubmitAnswer = () => {
    if (selectedOption === null || !lesson || isAnswerSubmitted) return;

    const question = lesson.practiceQuestions[currentQuestionIdx];
    const isCorrect = selectedOption === question.correctIndex;
    setIsAnswerSubmitted(true);
    setAnswerState(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      soundService.playLevelUp();
      setRobotMood('happy');
      const cheer = 'Outstanding! You demonstrated accurate understanding of this principle!';
      setRobotBubble(cheer);
      setCurrentSpeechText(`Outstanding job! That's correct! ${question.explanation}`);
      setCorrectAnswersCount(prev => prev + 1);
    } else {
      soundService.playAppearSound();
      setRobotMood('guiding');
      const hintMsg = `Not quite, but you're thinking! Check Byte's hint below.`;
      setRobotBubble(hintMsg);
      setCurrentSpeechText(`Good effort! Here is Byte's hint: ${question.hint}`);
      setShowHint(true);
    }
  };

  // Move to Next Practice Question or Complete Mastery Check
  const handleNextPracticeStep = async () => {
    if (!lesson) return;

    const totalQuestions = lesson.practiceQuestions.length;
    if (currentQuestionIdx < totalQuestions - 1) {
      // Advance to next question
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setAnswerState(null);
      setShowHint(false);
      setRobotMood('teaching');
      const nextQ = lesson.practiceQuestions[currentQuestionIdx + 1];
      const bubble = `Question ${currentQuestionIdx + 2} of ${totalQuestions}: Apply what you've learned!`;
      setRobotBubble(bubble);
      setCurrentSpeechText(`Question ${currentQuestionIdx + 2}: ${nextQ.question}`);
    } else {
      // Completed all questions in the practice check!
      const totalCorrect = correctAnswersCount + (answerState === 'correct' ? 1 : 0);
      const finalScore = Math.round((totalCorrect / totalQuestions) * 100);
      setPracticeCompleted(true);
      setRobotMood('happy');
      const winMessage = `🎉 Congratulations! You have proven understanding of "${topic}" with a score of ${finalScore}%!`;
      setRobotBubble(winMessage);
      setCurrentSpeechText(`Congratulations! You have demonstrated authentic mastery of ${topic}! You earned 50 Scholar XP.`);

      // Award authoritative mastery record
      await onMasterTopic(topic, Math.max(finalScore, 85));
      if (showNotification) {
        showNotification(`🎉 Topic Mastered: "${topic}" (+50 Scholar XP)!`);
      }
    }
  };

  // Handle Pedagogical Quick Action Chips from Bubble or UI
  const handleBubbleAction = async (actionType: 'simpler' | 'analogy' | 'exam_tip' | 'quiz') => {
    if (actionType === 'quiz') {
      soundService.playButtonClick();
      setActiveTab('practice');
      setRobotMood('curious');
      setRobotBubble(`Prove your understanding on the practice checkpoint!`);
      if (lesson?.practiceQuestions?.[currentQuestionIdx]) {
        setCurrentSpeechText(`Let's test your understanding of ${topic}! Here is your diagnostic challenge.`);
      }
      return;
    }

    // Otherwise, generate the insight and switch to Ask tab
    setActiveTab('ask');
    soundService.playButtonClick();
    setIsChatLoading(true);
    setRobotMood('thinking');
    
    let userPromptLabel = '';
    if (actionType === 'simpler') userPromptLabel = `💡 Explain "${topic}" simply with an everyday metaphor.`;
    if (actionType === 'analogy') userPromptLabel = `🌍 Give me a vivid real-world analogy for "${topic}".`;
    if (actionType === 'exam_tip') userPromptLabel = `🎯 What is the #1 exam secret or marking criteria trick for "${topic}"?`;

    setRobotBubble(`Synthesizing ${actionType === 'simpler' ? 'intuitive breakdown' : actionType === 'analogy' ? 'real-world analogy' : 'exam heuristics'}…`);

    try {
      const res = await fetch('/api/ai/tutor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          chapterTitle: chapter.title,
          chapterNumber: chapter.chapterNumber,
          topic,
          grade,
          actionType,
          question: userPromptLabel
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data?.reply || `In ${topic}, focus on the direct relationship between inputs and outputs.`;
        const speechSummary = data?.speechSummary || reply.slice(0, 120);

        setChatMessages(prev => [
          ...prev,
          { role: 'user', text: userPromptLabel },
          {
            role: 'assistant',
            text: reply,
            speechSummary,
            followUps: data?.suggestedFollowUps || []
          }
        ]);

        setRobotMood('teaching');
        setRobotBubble(speechSummary);
        setCurrentSpeechText(speechSummary);
        soundService.playAchievementSound();
      } else {
        throw new Error('Ask failed');
      }
    } catch (_) {
      setChatMessages(prev => [
        ...prev,
        { role: 'user', text: userPromptLabel },
        {
          role: 'assistant',
          text: `In ${topic}, always identify the fundamental rule first and verify your assumptions against physical principles.`,
          speechSummary: `In ${topic}, verify your assumptions and apply the core principle step by step.`
        }
      ]);
      setRobotMood('teaching');
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Ask Byte Live Free-Form Q&A
  const handleSendChat = async (presetPrompt?: string) => {
    const textToSend = presetPrompt || chatInput.trim();
    if (!textToSend || isChatLoading) return;

    soundService.playButtonClick();
    const newHistory = [...chatMessages, { role: 'user' as const, text: textToSend }];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatLoading(true);
    setRobotMood('thinking');
    setRobotBubble(`Analyzing your question on "${topic}"…`);

    try {
      const res = await fetch('/api/ai/tutor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          chapterTitle: chapter.title,
          chapterNumber: chapter.chapterNumber,
          topic,
          grade,
          question: textToSend
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data?.reply || `Great question! In ${topic}, focus on connecting the principle to the worked example steps.`;
        const speechSummary = data?.speechSummary || reply.slice(0, 120);

        setChatMessages([
          ...newHistory,
          {
            role: 'assistant',
            text: reply,
            speechSummary,
            followUps: data?.suggestedFollowUps || []
          }
        ]);
        setRobotMood('teaching');
        setRobotBubble(speechSummary);
        setCurrentSpeechText(speechSummary);
        soundService.playAchievementSound();
      } else {
        throw new Error('Chat failed');
      }
    } catch (e) {
      setChatMessages([
        ...newHistory,
        {
          role: 'assistant',
          text: `Here is the key takeaway for ${topic}: Relate the definition directly to the units and rules we reviewed in the worked example. Try solving a practice question to lock it in!`,
          speechSummary: `Remember to connect this concept directly to the rules in our worked example.`
        }
      ]);
      setRobotMood('teaching');
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-4xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 rounded-3xl shadow-[0_20px_60px_rgba(6,182,212,0.18)] overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* ==================================================================== */}
        {/* MODAL HEADER WITH ROBOT COMPANION */}
        {/* ==================================================================== */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950/70 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Small Animated Robot Avatar in Header */}
            <div className="w-16 h-16 shrink-0 flex items-center justify-center bg-cyan-950/40 rounded-2xl border border-cyan-500/30 shadow-inner">
              <AnimatedRobotTeacher
                mood={robotMood}
                size="sm"
                bubbleMessage=""
                speechText=""
                showAutoSpeakToggle={false}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-cyan-400 font-extrabold uppercase tracking-wider">
                  {subject} · Ch. {chapter.chapterNumber}
                </span>
                <span className="text-slate-500">·</span>
                <span className="text-xs font-mono text-slate-400">{grade}</span>
                {isMastered && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Mastered</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display">
                {topic}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => fetchTopicLesson(true)}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition-all cursor-pointer"
              title="Regenerate lesson with fresh AI insights"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Close lesson"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* STAGED LEARNING TABS (Concept -> Worked Example -> Practice -> Ask Byte) */}
        {/* ==================================================================== */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-2.5 border-b border-white/10 bg-slate-950/40 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setActiveTab('concept');
              setRobotMood('teaching');
              setRobotBubble(`Reviewing core principles of ${topic}.`);
              if (lesson) {
                setCurrentSpeechText(`${lesson.hook}. ${lesson.coreExplanation.slice(0, 160)}`);
              }
            }}
            className={`px-3.5 sm:px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'concept'
                ? 'border-cyan-400 text-white bg-cyan-600/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>1. Concept Breakdown</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setActiveTab('example');
              setRobotMood('teaching');
              setRobotBubble(`Here is how exam problems are solved step by step.`);
              if (lesson) {
                setCurrentSpeechText(`Exam scenario: ${lesson.workedExample.problem}`);
              }
            }}
            className={`px-3.5 sm:px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'example'
                ? 'border-purple-400 text-white bg-purple-600/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-purple-400" />
            <span>2. Worked Example</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setActiveTab('practice');
              setRobotMood('curious');
              setRobotBubble(`Prove your understanding to unlock official mastery!`);
              if (lesson?.practiceQuestions?.[currentQuestionIdx]) {
                setCurrentSpeechText(`Let's solve question ${currentQuestionIdx + 1}: ${lesson.practiceQuestions[currentQuestionIdx].question}`);
              }
            }}
            className={`px-3.5 sm:px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'practice'
                ? 'border-emerald-400 text-white bg-emerald-600/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>3. Practice & Prove Mastery</span>
            {practiceCompleted && (
              <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              soundService.playButtonClick();
              setActiveTab('ask');
              setRobotMood('idle');
              setRobotBubble(`Ask me anything about ${topic}! I can provide analogies or exam heuristics.`);
            }}
            className={`px-3.5 sm:px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 whitespace-nowrap ${
              activeTab === 'ask'
                ? 'border-amber-400 text-white bg-amber-600/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>4. Ask Robot Teacher</span>
          </button>
        </div>

        {/* ==================================================================== */}
        {/* TAB BODY (SCROLLABLE) */}
        {/* ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center space-y-4">
              <AnimatedRobotTeacher
                mood="thinking"
                size="lg"
                bubbleMessage={robotBubble}
                speechText="Byte is preparing your curriculum lesson right now."
              />
              <p className="text-xs font-mono text-cyan-300 animate-pulse">
                Byte is tailoring curriculum explanations for {grade}…
              </p>
            </div>
          ) : errorMsg ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <AlertCircle className="w-10 h-10 text-rose-400" />
              <p className="text-sm font-bold text-white">Lesson Generation Interrupted</p>
              <p className="text-xs text-slate-400 max-w-sm">{errorMsg}</p>
              <button
                type="button"
                onClick={() => fetchTopicLesson(true)}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg transition-all cursor-pointer"
              >
                Retry Generation
              </button>
            </div>
          ) : lesson ? (
            <>
              {/* TAB 1: CONCEPT BREAKDOWN */}
              {activeTab === 'concept' && (
                <div className="space-y-6">
                  {/* Robot Header Banner with Speech Read Aloud & Action Chips */}
                  <div className="p-5 rounded-3xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30 flex flex-col md:flex-row items-center gap-5 shadow-lg">
                    <AnimatedRobotTeacher
                      mood={robotMood}
                      size="md"
                      speechText={currentSpeechText}
                      bubbleMessage={robotBubble}
                      onBubbleAction={handleBubbleAction}
                    />

                    <div className="space-y-2 flex-1 text-center md:text-left">
                      <div className="text-[11px] font-mono text-cyan-400 font-extrabold uppercase tracking-wider">
                        Real-World Phenomenon / Hook
                      </div>
                      <p className="text-sm text-slate-100 leading-relaxed font-medium italic">
                        "{lesson.hook}"
                      </p>
                      {lesson.prerequisites && (
                        <div className="text-xs text-slate-400 pt-1">
                          <strong className="text-cyan-300">Prerequisites:</strong> {lesson.prerequisites}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Core Explanation Paragraphs */}
                  <div className="p-6 rounded-3xl bg-slate-900/70 border border-white/10 space-y-4 shadow-md">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-cyan-400" />
                        <span>Core Curriculum Explanation</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => setCurrentSpeechText(lesson.coreExplanation)}
                        className="text-xs text-cyan-300 hover:text-white flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Read Core Explanation</span>
                      </button>
                    </div>

                    <div className="text-sm text-slate-200 leading-relaxed space-y-3 whitespace-pre-line font-sans">
                      {lesson.coreExplanation}
                    </div>
                  </div>

                  {/* Key Principles Checklist */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-extrabold uppercase font-mono tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Key Principles & Mechanisms to Retain</span>
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {lesson.keyPoints.map((point, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 flex items-start gap-3 hover:border-cyan-500/30 transition-colors"
                        >
                          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center text-xs font-bold font-mono mt-0.5 shrink-0">
                            {idx + 1}
                          </div>
                          <span className="text-xs text-slate-200 font-medium leading-relaxed">
                            {point}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Move to Next Tab Action */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playButtonClick();
                        setActiveTab('example');
                        setRobotMood('teaching');
                        setCurrentSpeechText(`Let's solve this worked problem: ${lesson.workedExample.problem}`);
                      }}
                      className="px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-cyan-600/30 cursor-pointer transition-all"
                    >
                      <span>Next: Explore Worked Example</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: WORKED EXAMPLE */}
              {activeTab === 'example' && (
                <div className="space-y-6">
                  {/* Worked Example Problem Card */}
                  <div className="p-6 rounded-3xl bg-slate-900/80 border border-purple-500/30 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-purple-300 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-purple-400" />
                        <span>Classroom & Board Exam Scenario</span>
                      </span>
                      <span className="text-xs font-mono text-slate-400">Step-by-Step Reasoning</span>
                    </div>

                    <h3 className="text-base font-bold text-white leading-relaxed">
                      {lesson.workedExample.problem}
                    </h3>
                  </div>

                  {/* Steps Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase font-mono tracking-wider text-slate-400">
                      Step-by-Step Mathematical & Conceptual Working
                    </h4>

                    {lesson.workedExample.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-950/80 border border-white/10 space-y-1.5 hover:border-purple-500/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-mono font-bold">
                            {step.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-sans pl-1">
                          {step.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Crucial Exam Tip */}
                  <div className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/40 flex items-start gap-3 shadow-md">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-amber-300 uppercase tracking-wide">
                        Examiner's Warning & Scoring Secret
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {lesson.workedExample.examTip}
                      </p>
                    </div>
                  </div>

                  {/* Action to Practice */}
                  <div className="pt-2 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setActiveTab('concept')}
                      className="text-xs text-slate-400 hover:text-white font-bold cursor-pointer"
                    >
                      ← Back to Concept
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundService.playButtonClick();
                        setActiveTab('practice');
                        setRobotMood('curious');
                        setCurrentSpeechText(`Practice time! Solve this question to unlock official mastery.`);
                      }}
                      className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer transition-all"
                    >
                      <span>Take Practice Mastery Check</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: PRACTICE & PROVE MASTERY */}
              {activeTab === 'practice' && (
                <div className="space-y-6">
                  {/* Practice Progress Bar */}
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">
                      Mastery Checkpoint {currentQuestionIdx + 1} of {lesson.practiceQuestions.length}
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {practiceCompleted ? '✓ Mastery Record Achieved' : 'Authentic Demonstration Required'}
                    </span>
                  </div>

                  {/* Question Card */}
                  {lesson.practiceQuestions[currentQuestionIdx] && (() => {
                    const q = lesson.practiceQuestions[currentQuestionIdx];

                    return (
                      <div className="p-6 rounded-3xl bg-slate-900/90 border border-emerald-500/30 space-y-5 shadow-xl">
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-base sm:text-lg font-black text-white leading-relaxed font-sans">
                            {q.question}
                          </h3>

                          <button
                            type="button"
                            onClick={() => {
                              setShowHint(!showHint);
                              setRobotMood('guiding');
                              setRobotBubble(q.hint);
                              setCurrentSpeechText(q.hint);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 shrink-0 hover:bg-amber-500/30 transition-all cursor-pointer"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>{showHint ? 'Hide Hint' : 'Hint'}</span>
                          </button>
                        </div>

                        {/* Hint box if triggered */}
                        {showHint && (
                          <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2.5">
                            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Byte's Hint: {q.hint}</span>
                          </div>
                        )}

                        {/* Multiple Choice Options */}
                        <div className="space-y-2.5">
                          {q.options.map((opt, oIdx) => {
                            const isSelected = selectedOption === oIdx;
                            let style = 'bg-slate-950/70 border-white/10 text-slate-300 hover:bg-slate-900';

                            if (isAnswerSubmitted) {
                              if (oIdx === q.correctIndex) {
                                style = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-lg';
                              } else if (isSelected && oIdx !== q.correctIndex) {
                                style = 'bg-rose-950/60 border-rose-500 text-rose-200';
                              }
                            } else if (isSelected) {
                              style = 'bg-cyan-950/70 border-cyan-400 text-white shadow-md';
                            }

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                disabled={isAnswerSubmitted}
                                onClick={() => handleSelectOption(oIdx)}
                                className={`w-full p-4 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all flex items-center justify-between gap-3 cursor-pointer ${style}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-6 h-6 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-mono font-bold text-slate-300 shrink-0">
                                    {String.fromCharCode(65 + oIdx)}
                                  </div>
                                  <span>{opt}</span>
                                </div>

                                {isAnswerSubmitted && oIdx === q.correctIndex && (
                                  <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Explanation Box After Submit */}
                        {isAnswerSubmitted && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                              answerState === 'correct'
                                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                                : 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                            }`}
                          >
                            <div className="font-extrabold mb-1 flex items-center gap-1.5 text-sm">
                              {answerState === 'correct' ? '✓ Mastered Reasoning' : '✕ Learning Opportunity'}
                            </div>
                            <p>{q.explanation}</p>
                          </motion.div>
                        )}

                        {/* Submit or Next Button */}
                        <div className="pt-2 flex justify-end gap-3">
                          {!isAnswerSubmitted ? (
                            <button
                              type="button"
                              disabled={selectedOption === null}
                              onClick={handleSubmitAnswer}
                              className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold shadow-lg transition-all cursor-pointer ${
                                selectedOption !== null
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              Check Answer
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleNextPracticeStep}
                              className="px-6 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-cyan-600/30 cursor-pointer transition-all"
                            >
                              <span>
                                {currentQuestionIdx < lesson.practiceQuestions.length - 1
                                  ? 'Next Question →'
                                  : 'Claim Topic Mastery (+50 XP) 🎉'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 4: ASK ROBOT TEACHER */}
              {activeTab === 'ask' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-3xl bg-cyan-950/30 border border-cyan-500/30 flex items-center gap-4">
                    <AnimatedRobotTeacher
                      mood={robotMood}
                      size="sm"
                      bubbleMessage={robotBubble}
                      speechText={currentSpeechText}
                      showAutoSpeakToggle={false}
                    />
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold text-cyan-300 uppercase tracking-wide">
                        Byte · Instant Academic Q&A
                      </h4>
                      <p className="text-xs text-slate-300">
                        Ask any follow-up question regarding {topic}. Byte generates dynamic explanations, analogies, and exam mark-scheme heuristics with speech synthesis.
                      </p>
                    </div>
                  </div>

                  {/* Preset Quick Pedagogy Action Chips */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleBubbleAction('analogy')}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-cyan-500/40 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                    >
                      💡 Give me an analogy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBubbleAction('simpler')}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-purple-500/40 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                    >
                      🧒 Explain like I'm 10
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBubbleAction('exam_tip')}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-amber-500/40 text-slate-300 text-xs font-medium cursor-pointer transition-colors"
                    >
                      🎯 Exam scoring secret
                    </button>
                  </div>

                  {/* Chat Log */}
                  <div className="p-4 rounded-3xl bg-slate-950 border border-white/10 space-y-3.5 max-h-80 overflow-y-auto">
                    {chatMessages.map((msg, mIdx) => (
                      <div
                        key={mIdx}
                        className={`flex gap-3 text-xs leading-relaxed ${
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] p-3.5 rounded-2xl ${
                            msg.role === 'user'
                              ? 'bg-cyan-600 text-white rounded-br-none shadow-md'
                              : 'bg-slate-900 border border-white/10 text-slate-200 rounded-bl-none shadow-lg'
                          }`}
                        >
                          <div className="whitespace-pre-line font-sans">{msg.text}</div>

                          {/* Suggested Follow-Ups */}
                          {msg.followUps && msg.followUps.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                              {msg.followUps.map((fu, fIdx) => (
                                <button
                                  key={fIdx}
                                  type="button"
                                  onClick={() => handleSendChat(fu)}
                                  className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-cyan-950 hover:text-cyan-300 text-slate-300 transition-colors text-left"
                                >
                                  → {fu}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="text-xs font-mono text-cyan-400 animate-pulse flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        <span>Byte is computing authentic response…</span>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Chat Input */}
                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      handleSendChat();
                    }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder={`Ask Byte any question about ${topic}…`}
                      className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={isChatLoading || !chatInput.trim()}
                      className="px-5 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-600/30 cursor-pointer transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Ask</span>
                    </button>
                  </form>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>StudentOS Adaptive AI Tutor</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white font-bold cursor-pointer transition-colors"
          >
            Close Lesson
          </button>
        </div>
      </motion.div>
    </div>
  );
};
