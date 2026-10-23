/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StudentOS — Multilingual Internationalization (i18n) Engine
 * Native, responsive support for English ('en') and Hindi ('hi') across navigation,
 * Byte prompts, onboarding, study tools, and dashboard interfaces.
 */

import { useState, useEffect } from 'react';

export type SupportedLanguage = 'en' | 'hi';

export interface TranslationDictionary {
  // Navigation & Core Tabs
  home: string;
  studyHub: string;
  tasks: string;
  homework: string;
  syllabus: string;
  flashcards: string;
  planner: string;
  aiBuddy: string;
  byteChat: string;
  brainBattle: string;
  whiteboard: string;
  materials: string;
  lectureNotes: string;
  analytics: string;
  settings: string;
  notices: string;
  menu: string;

  // Onboarding
  welcomeTitle: string;
  welcomeSubtitle: string;
  setupTimeEstimate: string;
  startSetup: string;
  skipSetup: string;
  nextStep: string;
  previousStep: string;
  finishSetup: string;
  languageSelectTitle: string;
  languageSelectDesc: string;
  interfaceLanguageLabel: string;
  byteVoiceLanguageLabel: string;
  learningPrefsTitle: string;
  learningPrefsDesc: string;
  targetSubjectsLabel: string;
  explanationStyleLabel: string;
  autoVoiceLabel: string;
  sessionLengthLabel: string;
  revisionRemindersLabel: string;
  guidedTourTitle: string;
  guidedTourDesc: string;
  startTourBtn: string;
  skipTourBtn: string;
  setupCompleteTitle: string;
  setupCompleteDesc: string;
  startLearningBtn: string;
  openDashboardBtn: string;

  // Byte Greetings & Actions
  byteName: string;
  byteRole: string;
  openNotice: string;
  doHomework: string;
  startChallenge: string;
  continueLearning: string;
  listenAloud: string;
  pauseSpeech: string;
  autoVoiceOn: string;
  autoVoiceOff: string;
  streakDays: string;
  streakProtected: string;

  // Tour Labels
  tourStepCount: (current: number, total: number) => string;
  whatIsItFor: string;
  whatYouCanDo: string;
  howItConnects: string;
  tryItNow: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationDictionary> = {
  en: {
    home: 'Home',
    studyHub: 'Study Hub',
    tasks: 'Tasks',
    homework: 'Homework',
    syllabus: 'Syllabus & Learning Path',
    flashcards: 'Flashcards',
    planner: 'Study Planner',
    aiBuddy: 'Byte AI Tutor',
    byteChat: 'Byte Chat',
    brainBattle: 'Brain Battle',
    whiteboard: 'Whiteboard',
    materials: 'Material Hub',
    lectureNotes: 'Lecture Notes',
    analytics: 'Performance Analytics',
    settings: 'Settings & Profile',
    notices: 'Notices & Circulars',
    menu: 'Menu',

    welcomeTitle: 'Welcome to StudentOS',
    welcomeSubtitle: 'Your intelligent academic companion designed for focused, structured learning.',
    setupTimeEstimate: 'Takes only 2 minutes to personalize',
    startSetup: 'Get Started',
    skipSetup: 'Skip for Now',
    nextStep: 'Continue',
    previousStep: 'Back',
    finishSetup: 'Complete Setup',
    languageSelectTitle: 'Choose Your Language',
    languageSelectDesc: 'Select your preferred language for the StudentOS interface and Byte teaching voice.',
    interfaceLanguageLabel: 'Interface Language',
    byteVoiceLanguageLabel: 'Byte Teaching Voice',
    learningPrefsTitle: 'Personalize Your Learning',
    learningPrefsDesc: 'Help Byte tailor explanation styles and practice sessions to match how you learn best.',
    targetSubjectsLabel: 'Subjects you want help with',
    explanationStyleLabel: 'Preferred Explanation Style',
    autoVoiceLabel: 'Speak Explanations Aloud by Default',
    sessionLengthLabel: 'Practice Session Length',
    revisionRemindersLabel: 'Spaced Revision Reminders',
    guidedTourTitle: 'Interactive Product Tour',
    guidedTourDesc: 'Take a quick 2-minute walkthrough of your core learning tools and workspaces.',
    startTourBtn: 'Start Interactive Tour',
    skipTourBtn: 'Explore on My Own',
    setupCompleteTitle: 'You are all set!',
    setupCompleteDesc: 'Your learning preferences have been configured. Byte is ready to help you conquer your goals.',
    startLearningBtn: 'Begin Learning with Byte',
    openDashboardBtn: 'Go to Dashboard',

    byteName: 'Byte',
    byteRole: 'AI Study Companion',
    openNotice: 'Open notice',
    doHomework: 'Do homework',
    startChallenge: 'Start challenge',
    continueLearning: 'Continue learning',
    listenAloud: 'Listen Aloud',
    pauseSpeech: 'Pause',
    autoVoiceOn: 'Auto-Voice: ON',
    autoVoiceOff: 'Auto-Voice: OFF',
    streakDays: 'Day Streak',
    streakProtected: 'Streak protected',

    tourStepCount: (cur, tot) => `Step ${cur} of ${tot}`,
    whatIsItFor: 'What it is for',
    whatYouCanDo: 'What you can do',
    howItConnects: 'How it connects to your studies',
    tryItNow: 'Quick Action'
  },
  hi: {
    home: 'होम',
    studyHub: 'स्टडी हब',
    tasks: 'कार्य (टास्क)',
    homework: 'गृहकार्य (होमवर्क)',
    syllabus: 'पाठ्यक्रम और लर्निंग पाथ',
    flashcards: 'फ्लैशकार्ड्स',
    planner: 'स्टडी प्लानर',
    aiBuddy: 'बाइट एआई ट्यूटर',
    byteChat: 'बाइट चैट',
    brainBattle: 'ब्रेन बैटल',
    whiteboard: 'व्हाइटबोर्ड',
    materials: 'अध्ययन सामग्री',
    lectureNotes: 'लेक्चर नोट्स',
    analytics: 'प्रगति और अंक',
    settings: 'सेटिंग्स व प्रोफ़ाइल',
    notices: 'सूचनाएं व परिपत्र',
    menu: 'मेनू',

    welcomeTitle: 'स्टूडेंट ओएस में आपका स्वागत है',
    welcomeSubtitle: 'आपका बुद्धिमान शैक्षणिक साथी, जो पढ़ाई को आसान और प्रभावी बनाता है।',
    setupTimeEstimate: 'सेटअप में केवल 2 मिनट लगेंगे',
    startSetup: 'शुरू करें',
    skipSetup: 'बाद में करें',
    nextStep: 'आगे बढ़ें',
    previousStep: 'पीछे',
    finishSetup: 'सेटअप पूरा करें',
    languageSelectTitle: 'अपनी भाषा चुनें',
    languageSelectDesc: 'स्टूडेंट ओएस इंटरफेस और बाइट की आवाज के लिए अपनी पसंदीदा भाषा चुनें।',
    interfaceLanguageLabel: 'इंटरफ़ेस भाषा',
    byteVoiceLanguageLabel: 'बाइट की बोलने की भाषा',
    learningPrefsTitle: 'अपनी पढ़ाई को अनुकूलित करें',
    learningPrefsDesc: 'बाइट को बताएं कि आप सबसे अच्छा कैसे सीखते हैं ताकि वह सही व्याख्या प्रदान कर सके।',
    targetSubjectsLabel: 'वे विषय जिनमें आप मदद चाहते हैं',
    explanationStyleLabel: 'पसंदीदा व्याख्या शैली',
    autoVoiceLabel: 'व्याख्या स्वतः बोलकर सुनाएं',
    sessionLengthLabel: 'अभ्यास सत्र की अवधि',
    revisionRemindersLabel: 'पुनरावृत्ति (रिवीजन) स्मरण पत्र',
    guidedTourTitle: 'उत्पाद की संक्षिप्त यात्रा',
    guidedTourDesc: 'अपने मुख्य अध्ययन उपकरणों और कार्यक्षेत्रों की 2 मिनट की निर्देशित यात्रा करें।',
    startTourBtn: 'टूर शुरू करें',
    skipTourBtn: 'सीधे डैशबोर्ड पर जाएं',
    setupCompleteTitle: 'बधाई हो, आप तैयार हैं!',
    setupCompleteDesc: 'आपकी प्राथमिकताएं सहेज ली गई हैं। बाइट आपके शैक्षणिक लक्ष्यों को प्राप्त करने में मदद के लिए तैयार है।',
    startLearningBtn: 'बाइट के साथ पढ़ाई शुरू करें',
    openDashboardBtn: 'डैशबोर्ड खोलें',

    byteName: 'बाइट',
    byteRole: 'एआई अध्ययन साथी',
    openNotice: 'सूचना देखें',
    doHomework: 'होमवर्क करें',
    startChallenge: 'चुनौती शुरू करें',
    continueLearning: 'पढ़ाई जारी रखें',
    listenAloud: 'बोलकर सुनें',
    pauseSpeech: 'रोकें',
    autoVoiceOn: 'ऑटो-वॉइस: चालू',
    autoVoiceOff: 'ऑटो-वॉइस: बंद',
    streakDays: 'दिनों का स्ट्रीक',
    streakProtected: 'स्ट्रीक सुरक्षित है',

    tourStepCount: (cur, tot) => `चरण ${cur} / ${tot}`,
    whatIsItFor: 'यह किसलिए है',
    whatYouCanDo: 'आप यहाँ क्या कर सकते हैं',
    howItConnects: 'यह आपकी पढ़ाई से कैसे जुड़ता है',
    tryItNow: 'तुरंत आज़माएं'
  }
};

const LANG_STORAGE_KEY = 'studentos_language';

let currentLanguage: SupportedLanguage = (() => {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'hi' || saved === 'en') return saved;
  } catch (_) {}
  return 'en';
})();

const languageListeners = new Set<(lang: SupportedLanguage) => void>();

export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

export function setLanguage(lang: SupportedLanguage) {
  if (lang !== 'en' && lang !== 'hi') return;
  currentLanguage = lang;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
  } catch (_) {}
  languageListeners.forEach(listener => listener(lang));
}

export function useTranslation() {
  const [lang, setLangState] = useState<SupportedLanguage>(currentLanguage);

  useEffect(() => {
    const listener = (newLang: SupportedLanguage) => {
      setLangState(newLang);
    };
    languageListeners.add(listener);
    return () => {
      languageListeners.delete(listener);
    };
  }, []);

  return {
    t: TRANSLATIONS[lang],
    currentLanguage: lang,
    setLanguage
  };
}
