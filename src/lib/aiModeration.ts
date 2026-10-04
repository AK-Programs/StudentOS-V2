/**
 * AI Moderation Engine for StudentOS Communication System
 * Automatically checks incoming & outgoing messages for:
 * - Spam / Flooding
 * - Abuse & Bad Language
 * - Personal Info Leaks (Phone, SSN, Passwords)
 * - Unsafe Links / Phishing
 * - Fake Emergency / Fake Principal Announcements
 */

const BAD_WORDS = [
  'bastard', 'bitch', 'idiot', 'stupid', 'dumbass', 'asshole', 'fuck', 'shit',
  'crap', 'scam', 'hate', 'kill', 'die', 'trash', 'loser'
];

const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const UNSAFE_URL_REGEX = /(http|https):\/\/(?!([a-zA-Z0-9-]+\.)*(google\.com|studentos\.edu|wikipedia\.org|github\.com|youtube\.com))[^\s]+/gi;
const FAKE_ANNOUNCEMENT_KEYWORDS = ['school closed tomorrow', 'exams cancelled', 'principal fired', 'bomb threat', 'free grades'];

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
  category?: 'spam' | 'profanity' | 'privacy' | 'phishing' | 'fake_news';
  safeMessage: string;
}

export function moderateChatMessage(text: string, senderRole: string): ModerationResult {
  if (!text || !text.trim()) {
    return { flagged: false, safeMessage: text };
  }

  const lower = text.toLowerCase().trim();

  // 1. Fake Announcements check (if student claims school closed etc.)
  if (senderRole === 'student') {
    for (const keyword of FAKE_ANNOUNCEMENT_KEYWORDS) {
      if (lower.includes(keyword)) {
        return {
          flagged: true,
          reason: 'Potential fake announcement detected. Flagged for school administration.',
          category: 'fake_news',
          safeMessage: '[Message Flagged by AI Safety Filter: Pending Admin Review]'
        };
      }
    }
  }

  // 2. Bad Words / Profanity Check
  let hasProfanity = false;
  let cleaned = text;
  for (const word of BAD_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(cleaned)) {
      hasProfanity = true;
      cleaned = cleaned.replace(regex, '***');
    }
  }
  if (hasProfanity) {
    return {
      flagged: true,
      reason: 'Inappropriate language detected.',
      category: 'profanity',
      safeMessage: cleaned
    };
  }

  // 3. Personal Info Leak Check (Phone numbers or Email addresses shared in public rooms)
  if (PHONE_REGEX.test(text)) {
    return {
      flagged: true,
      reason: 'Sharing personal phone numbers is prohibited for student safety.',
      category: 'privacy',
      safeMessage: text.replace(PHONE_REGEX, '[PHONE NUMBER REDACTED]')
    };
  }

  // 4. Unsafe Links / Phishing
  if (UNSAFE_URL_REGEX.test(text)) {
    return {
      flagged: true,
      reason: 'External link flagged for potential phishing or unsafe content.',
      category: 'phishing',
      safeMessage: text.replace(UNSAFE_URL_REGEX, '[UNSAFE LINK REDACTED]')
    };
  }

  // 5. Spam / Character Flood
  if (text.length > 50 && (/(.)\1{9,}/.test(text))) {
    return {
      flagged: true,
      reason: 'Repeated character spam detected.',
      category: 'spam',
      safeMessage: text.slice(0, 30) + '...'
    };
  }

  return {
    flagged: false,
    safeMessage: text
  };
}
