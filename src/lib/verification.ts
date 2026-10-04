import { supabase } from './supabase';
import { UserProfile } from '../types';

export interface VerificationStatus {
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerified: boolean;
  verifiedCount: number;
  isVerified: boolean; // True when at least TWO methods are verified
  maskedPhone?: string;
  maskedEmail?: string;
  phone?: string;
  email?: string;
}

/**
 * Masks a phone number securely (e.g. "+91 9876543210" -> "+91 ••••••3210")
 */
export function maskPhone(phone?: string): string {
  if (!phone || phone.trim().length < 4) return 'Not Provided';
  const clean = phone.trim();
  if (clean.length <= 6) return '••••' + clean.slice(-2);
  const lastFour = clean.slice(-4);
  const prefix = clean.startsWith('+') ? clean.slice(0, 3) + ' ' : '';
  return `${prefix}••••••${lastFour}`;
}

/**
 * Masks an email address securely (e.g. "student@school.edu" -> "s••••••@school.edu")
 */
export function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return 'Not Provided';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}•@${domain}`;
  return `${local[0]}••••${local.slice(-1)}@${domain}`;
}

/**
 * Centrally calculates the user's verification status.
 * Requires at least TWO verified methods (e.g. Email + Phone, or Email + Govt ID)
 * to award the official StudentOS Verified Badge.
 */
export function getVerificationStatus(user?: UserProfile | any): VerificationStatus {
  if (!user) {
    return {
      emailVerified: false,
      phoneVerified: false,
      identityVerified: false,
      verifiedCount: 0,
      isVerified: false,
      maskedPhone: undefined,
      maskedEmail: undefined
    };
  }

  const raw = user.raw_data || {};
  const verificationData = raw.verification || {};

  // 1. Email verification state
  // Check Supabase Auth confirmation flags or user profile flag
  const emailVerified = Boolean(
    user.email_confirmed_at ||
    user.confirmed_at ||
    user.email_verified === true ||
    verificationData.emailVerified === true ||
    user.accountStatus === 'approved' // School-admin approved accounts have verified organizational emails
  );

  // 2. Phone verification state
  const rawPhone = user.phone || raw.phone || '';
  const phoneVerified = Boolean(
    rawPhone && (
      user.phone_confirmed_at ||
      verificationData.phoneVerified === true ||
      (raw.phoneVerifiedAt && raw.phone === rawPhone)
    )
  );

  // 3. Government ID verification state
  // NEVER faked; strictly reflects authoritative verification provider state if configured
  const identityVerified = Boolean(
    verificationData.identityVerified === true &&
    verificationData.identityProviderRef
  );

  // Calculate count of verified methods
  let verifiedCount = 0;
  if (emailVerified) verifiedCount++;
  if (phoneVerified) verifiedCount++;
  if (identityVerified) verifiedCount++;

  // Minimum of 2 verified methods required for the verified badge
  const isVerified = verifiedCount >= 2;

  return {
    emailVerified,
    phoneVerified,
    identityVerified,
    verifiedCount,
    isVerified,
    maskedPhone: rawPhone ? maskPhone(rawPhone) : undefined,
    maskedEmail: user.email ? maskEmail(user.email) : undefined,
    phone: rawPhone,
    email: user.email
  };
}

/**
 * Checks current Supabase Auth session user to verify latest auth state
 */
export async function syncAuthVerificationFromSupabase(): Promise<{ emailConfirmed: boolean; phoneConfirmed: boolean }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return { emailConfirmed: false, phoneConfirmed: false };
    }

    const emailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
    const phoneConfirmed = Boolean(user.phone_confirmed_at);

    return { emailConfirmed, phoneConfirmed };
  } catch (e) {
    console.warn('[VERIFICATION] Could not check Supabase auth status:', e);
    return { emailConfirmed: false, phoneConfirmed: false };
  }
}

/**
 * Requests an email verification link to be sent to user's registered email
 */
export async function resendEmailVerification(email: string): Promise<{ success: boolean; message: string }> {
  if (!email) {
    return { success: false, message: 'No email provided.' };
  }

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
      }
    });

    if (error) {
      return { success: false, message: error.message || 'Failed to send verification email.' };
    }

    return { 
      success: true, 
      message: `Verification link successfully dispatched to ${maskEmail(email)}. Please check your inbox and spam folders.` 
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error sending verification email.' };
  }
}

/**
 * Initiates phone OTP verification through Supabase Auth
 */
export async function requestPhoneOtp(phone: string): Promise<{ success: boolean; message: string }> {
  if (!phone || phone.trim().length < 8) {
    return { success: false, message: 'Please enter a valid phone number with country code (e.g. +91 9876543210).' };
  }

  const cleanPhone = phone.trim().replace(/[\s-]/g, '');

  try {
    const { error } = await supabase.auth.updateUser({
      phone: cleanPhone
    });

    if (error) {
      // If Twilio SMS provider is not active in this Supabase tier, explain clearly
      if (error.message?.toLowerCase().includes('sms') || error.message?.toLowerCase().includes('provider') || error.message?.toLowerCase().includes('unsupported')) {
        return {
          success: false,
          message: 'SMS verification gateway is currently not active in this environment. School administrative OTP is required.'
        };
      }
      return { success: false, message: error.message };
    }

    return { 
      success: true, 
      message: `One-Time Password (OTP) dispatched to ${maskPhone(cleanPhone)}. Enter the 6-digit code below.` 
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Failed to dispatch phone verification OTP.' };
  }
}

/**
 * Confirms OTP code entered by user
 */
export async function verifyPhoneOtpCode(phone: string, token: string): Promise<{ success: boolean; message: string }> {
  if (!phone || !token) {
    return { success: false, message: 'Phone number and 6-digit OTP code are required.' };
  }

  const cleanPhone = phone.trim().replace(/[\s-]/g, '');

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: cleanPhone,
      token: token.trim(),
      type: 'phone_change'
    });

    if (error) {
      // Also try 'sms' type fallback
      const { data: altData, error: altErr } = await supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: token.trim(),
        type: 'sms'
      });

      if (altErr) {
        return { success: false, message: altErr.message || 'Invalid or expired OTP code.' };
      }
    }

    return { success: true, message: 'Phone number successfully verified!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'OTP verification failed.' };
  }
}
