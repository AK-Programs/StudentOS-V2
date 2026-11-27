/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { generateAICompletion, generateAICompletionWithTelemetry, streamAICompletion, classifyTaskComplexity, getGroqApiKey, getMinistralApiKey, getZaiApiKey, ZAI_MODEL_ID } from './server/aiClient';
import {
  handleAdminAiLimits,
  handleAiChat,
  handleAiHandwritingFormula,
  handleAiImageToNote,
  handleAiMagicDraw,
  handleAiNotes,
  handleAiRedeemVoucher,
  handleAiSearch,
  handleAiUsageStatus,
  handleAuthDemoSession,
  handleAuthLogin,
  handleHealth,
  handleOrionAssist,
  handleOrionExecute,
} from './server/canonicalAiHandlers';
import { getSupabaseServerConfig } from './server/runtimeConfig';
import { resolveVerifiedActor, verifySignedSessionToken } from './server/sessionAuth';
import { generateVoiceTTS, transcribeVoiceSTT } from './server/voiceService';
import { synthesizeEdgeSpeech, VERIFIED_EDGE_VOICES, cleanTextForSpeech } from './server/edgeTtsService';
import { getVerified3DModelsCatalog, getAllThreeDRequests, createThreeDRequest, updateThreeDRequestStatus } from './server/threeDModelService';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';
import { generateMermaidDiagram, generateSvgDiagram, generateCanvasElements } from './server/diagramEngine';
import { detectWebSearchIntent, performControlledWebSearch, WebSearchSource } from './server/webSearchEngine';
import { generateClassroomSvgVisual, generateEducational3DScene, sanitizeEducationalSvg } from './server/whiteboardVisualEngine';
import webpush from 'web-push';
import {
  fetchAuthoritativeSecurity,
  persistSecurityState,
  hashPin,
  verifyPinHash,
  getRateLimit,
  recordFailedAttempt,
  resetRateLimit
} from './server/securityService';
import {
  getPanelRegistration,
  registerClassroomPanel,
  reassignClassroomPanel,
  revokeClassroomPanel,
  getRealClassroomMetadata
} from './server/panelBoardService';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import {
  registerAcademicWorkflowRoutes,
  isWsClientEligibleForAcademicEvent,
  AcademicEventScope
} from './server/academicWorkflowModule';
import { registerFeatureManagementRoutes } from './server/featureManagementModule';
import {
  registerWinterFestivalAndLeaderboardRoutes,
  getUserWinterAiBonusCredits,
  appendXpLedgerEntry,
} from './server/winterFestivalModule';
import { registerNotificationRoutes } from './server/notificationEngine';
import {
  registerEngagementSystemRoutes,
  recordEngagementActivityServer,
} from './server/engagementEngine';
import {
  AIQuotaPersistenceError,
  getRolling24hUsageAsync,
  recordAiUsageAsync,
  redeemAiVoucherAsync,
  updateRoleLimitsAsync,
} from './server/aiQuotaService';

dotenv.config();

const serverStartTime = Date.now();

import {
  WORKING_ANON_KEY,
  knownInvalidSupabaseKeys,
  verifiedServiceRoleKeys,
  markSupabaseKeyInvalid,
  isKnownInvalidSupabaseKey,
  probeServiceRoleKey,
  supabaseFetchWithAnonRetry,
  getFeatureAndWinterSupabaseKey,
} from './server/supabaseKeyManager';

export { WORKING_ANON_KEY, markSupabaseKeyInvalid, getSupabaseServerConfig };

export interface VerifiedUser {
  id: string;
  email?: string;
  role: string;
  user_metadata?: any;
}

export async function getVerifiedUserFromRequest(req: express.Request): Promise<VerifiedUser | null> {
  const actorRes = await resolveVerifiedActor({
    headers: req.headers,
    cfg: getSupabaseServerConfig(),
  });
  if (!actorRes.ok) {
    return null;
  }
  const actor = actorRes.actor;
  return {
    id: actor.userId,
    email: actor.email,
    role: actor.role,
    user_metadata: {
      name: actor.name,
      role: actor.role,
      grade: actor.grade,
      section: actor.section,
      assignedGrades: actor.assignedGrades,
      assignedSections: actor.assignedSections,
      assignedClasses: actor.assignedClasses,
    },
  };
}

export const app = express();
const PORT = 3000;

// Hardened Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.json({ limit: '10mb' }));

// Express Rate Limiting Helper
const endpointRateLimiters = new Map<string, { count: number; windowStart: number }>();

function createEndpointRateLimiter(windowMs: number, maxRequests: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const record = endpointRateLimiters.get(key);

    if (!record || now - record.windowStart > windowMs) {
      endpointRateLimiters.set(key, { count: 1, windowStart: now });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        retryAfterMs: windowMs - (now - record.windowStart)
      });
    }

    record.count++;
    return next();
  };
}

// VAPID keys for Web Push / FCM
const CANONICAL_VAPID_PUBLIC_KEY = 'BLdXVgRSMH1XO-DH4Y8hJ5qzd-BlUw6rVC7BmoBvrTp5sbNcrO05MdgeVSSaI7MPZVl_PLJd8nbNy989mkA3Wfs';

function isValidUUIDServer(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getOrGenerateVapidKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ? process.env.VAPID_PUBLIC_KEY.trim() : CANONICAL_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PRIVATE_KEY.trim() : '';
  return { publicKey, privateKey };
}

const vapidKeys = getOrGenerateVapidKeys();

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:notifications@studentos.internal',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
    console.log('[Push] VAPID / FCM push delivery configured.');
  } catch (e) {
    console.warn('[Push] setVapidDetails notice:', e);
  }
}

interface FCMTokenItem {
  token: string;
  fcmToken?: string;
  userId: string | null;
  deviceId: string;
  deviceLabel?: string;
  role?: string;
  grade?: string;
  section?: string;
  house?: string;
  schoolId?: string;
  subscription?: any;
  userAgent?: string;
  isActive: boolean;
  updatedAt: number;
}

const memoryFCMTokens: FCMTokenItem[] = [];

// Client-safe FCM & Web Push configuration endpoint (never exposes private keys)
app.get('/api/push/fcm-config', (req, res) => {
  res.json({
    vapidPublicKey: vapidKeys.publicKey || CANONICAL_VAPID_PUBLIC_KEY,
    vapidConfigured: Boolean(vapidKeys.publicKey && vapidKeys.privateKey),
    provider: 'fcm',
    projectId: 'gen-lang-client-0785563242'
  });
});

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey || CANONICAL_VAPID_PUBLIC_KEY });
});

function isAnonymousPushUserIdServer(uid?: string | null): boolean {
  const norm = String(uid || '').trim().toLowerCase();
  return !norm || norm === 'usr_anonymous' || norm === 'anonymous' || norm === 'guest' || norm === 'user_guest';
}

async function resolvePushSupabaseConfig(userJwt?: string): Promise<{
  url: string;
  apiKey: string;
  authHeader: string;
  usingServiceRole: boolean;
  serviceRoleConfigured: boolean;
  serviceRoleVerified: boolean;
}> {
  const cfg = getSupabaseServerConfig();
  const rawSrKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const serviceRoleConfigured = Boolean(rawSrKey && !isKnownInvalidSupabaseKey(rawSrKey, cfg.url));
  if (serviceRoleConfigured && !verifiedServiceRoleKeys.has(rawSrKey) && (process.env.NODE_ENV !== 'test' || cfg.url.includes('127.0.0.1'))) {
    await probeServiceRoleKey(cfg.url, rawSrKey);
  }
  const serviceRoleVerified = Boolean(serviceRoleConfigured && verifiedServiceRoleKeys.has(rawSrKey));
  const serverKey = getFeatureAndWinterSupabaseKey(cfg.url, cfg.key) || WORKING_ANON_KEY;
  const usingServiceRole = Boolean(
    serviceRoleVerified ||
    ((cfg.url.includes('127.0.0.1') || cfg.url.includes('localhost')) && Boolean(rawSrKey) && serverKey === rawSrKey)
  );
  const authHeader = usingServiceRole
    ? `Bearer ${serverKey}`
    : (userJwt ? `Bearer ${userJwt}` : `Bearer ${serverKey}`);
  return {
    url: cfg.url,
    apiKey: serverKey,
    authHeader,
    usingServiceRole,
    serviceRoleConfigured,
    serviceRoleVerified,
  };
}

// Helper to persist subscription to Supabase push_subscriptions with verified schema
async function persistSubscriptionToSupabase(params: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId: string;
  userJwt?: string;
  deviceId?: string;
  deviceLabel?: string;
  role?: string;
  grade?: string;
  section?: string;
  house?: string;
  schoolId?: string;
  fcmToken?: string;
}): Promise<{ success: boolean; status?: number; error?: string }> {
  const sb = await resolvePushSupabaseConfig(params.userJwt);
  const now = new Date().toISOString();

  const richKeys = {
    p256dh: params.p256dh,
    auth: params.auth,
    userId: params.userId,
    deviceId: params.deviceId || 'dev_web',
    deviceLabel: params.deviceLabel || 'Web Browser',
    role: params.role || 'student',
    grade: params.grade || '',
    section: params.section || '',
    house: params.house || '',
    schoolId: params.schoolId || 'default_school',
    fcmToken: params.fcmToken || params.endpoint,
    isActive: true,
    updatedAt: now
  };

  const payload: Record<string, any> = {
    user_id: params.userId,
    endpoint: params.endpoint,
    p256dh: params.p256dh,
    auth: params.auth,
    role: params.role || 'student',
    grade: params.grade || '',
    section: params.section || '',
    school_id: params.schoolId || 'default_school',
    keys: richKeys,
    updated_at: now
  };

  try {
    const resp = await supabaseFetchWithAnonRetry(
      `${sb.url}/rest/v1/push_subscriptions?on_conflict=endpoint`,
      {
        method: 'POST',
        headers: {
          apikey: sb.apiKey,
          Authorization: sb.authHeader,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!resp.ok) {
      const errText = await resp.text().catch(() => resp.statusText || 'Supabase upsert failed');
      console.error(`[FCM SERVER] Supabase push_subscriptions upsert failed (${resp.status}):`, errText);
      return { success: false, status: resp.status, error: errText || `HTTP ${resp.status}` };
    }

    console.log(`[FCM SERVER] Stored active push subscription in Supabase: userId=${params.userId}, role=${params.role || 'student'}, device="${params.deviceLabel || 'Browser'}"`);
    return { success: true, status: resp.status };
  } catch (err: any) {
    const msg = err?.message || 'Supabase push_subscriptions request failed';
    console.error('[FCM SERVER] Supabase push_subscriptions network error:', msg);
    return { success: false, status: 502, error: msg };
  }
}

// Register FCM Device Token & WebPush Subscription for authenticated user & device
app.post('/api/push/fcm-token', async (req, res) => {
  const actor = await resolveFeatureAndWinterActor(req).catch(() => null);
  if (!actor || isAnonymousPushUserIdServer(actor.id)) {
    return res.status(401).json({
      status: 'error',
      error: 'Authentication is required to register push notifications.',
      tokenStored: false
    });
  }

  const { token, fcmToken, deviceId, deviceLabel, role, grade, section, house, schoolId, subscription, userAgent } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({
      status: 'error',
      error: 'A complete Web Push subscription with endpoint, p256dh, and auth keys is required.',
      tokenStored: false
    });
  }

  const primaryToken = String(subscription.endpoint).trim();
  const effectiveUserId = actor.id;
  const effectiveRole = actor.role || role || 'student';
  const effectiveGrade = actor.grade || grade || '';
  const effectiveSection = actor.section || section || '';
  const devId = deviceId || 'dev_' + Math.random().toString(36).substring(2, 10);

  const sbResult = await persistSubscriptionToSupabase({
    endpoint: primaryToken,
    p256dh: String(subscription.keys.p256dh),
    auth: String(subscription.keys.auth),
    userId: effectiveUserId,
    userJwt: actor.authToken,
    deviceId: devId,
    deviceLabel: deviceLabel || 'Web Browser',
    role: effectiveRole,
    grade: effectiveGrade,
    section: effectiveSection,
    house: house || '',
    schoolId: schoolId || 'default_school',
    fcmToken: fcmToken || token || primaryToken
  });

  if (!sbResult.success) {
    return res.status(502).json({
      status: 'error',
      error: 'Failed to save push subscription to Supabase public.push_subscriptions',
      details: sbResult.error,
      supabaseStatus: sbResult.status || 502,
      tokenStored: false
    });
  }

  const existingIdx = memoryFCMTokens.findIndex(
    t => t.token === primaryToken || (t.deviceId === devId && t.userId === effectiveUserId)
  );

  const newItem: FCMTokenItem = {
    token: primaryToken,
    fcmToken: fcmToken || token || primaryToken,
    userId: effectiveUserId,
    deviceId: devId,
    deviceLabel: deviceLabel || 'Web Browser',
    role: effectiveRole,
    grade: effectiveGrade,
    section: effectiveSection,
    house: house || '',
    schoolId: schoolId || 'default_school',
    subscription,
    userAgent: userAgent || '',
    isActive: true,
    updatedAt: Date.now()
  };

  if (existingIdx >= 0) {
    memoryFCMTokens[existingIdx] = newItem;
  } else {
    memoryFCMTokens.push(newItem);
  }

  console.log(`[FCM SERVER] Registered device token: userId=${effectiveUserId}, tokenExists=yes, tokenActive=yes, role=${effectiveRole}, label="${newItem.deviceLabel}"`);
  return res.json({ status: 'ok', deviceId: devId, userId: effectiveUserId, tokenStored: true });
});

// Deactivate FCM Device Token
app.post('/api/push/fcm-token/delete', async (req, res) => {
  const actor = await resolveFeatureAndWinterActor(req).catch(() => null);
  if (!actor || isAnonymousPushUserIdServer(actor.id)) {
    return res.status(401).json({
      status: 'error',
      error: 'Authentication is required to remove push subscriptions.'
    });
  }

  const { token, deviceId } = req.body || {};
  for (let i = memoryFCMTokens.length - 1; i >= 0; i--) {
    const item = memoryFCMTokens[i];
    if (
      item.userId === actor.id &&
      ((token && (item.token === token || item.subscription?.endpoint === token)) ||
        (deviceId && item.deviceId === deviceId))
    ) {
      item.isActive = false;
    }
  }

  if (token && String(token).startsWith('http')) {
    try {
      const sb = await resolvePushSupabaseConfig(actor.authToken);
      const delRes = await supabaseFetchWithAnonRetry(
        `${sb.url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(String(token))}&user_id=eq.${encodeURIComponent(actor.id)}`,
        {
          method: 'DELETE',
          headers: { apikey: sb.apiKey, Authorization: sb.authHeader }
        }
      );
      if (!delRes.ok) {
        const errText = await delRes.text().catch(() => '');
        return res.status(502).json({
          status: 'error',
          error: 'Failed to delete push subscription from Supabase public.push_subscriptions',
          details: errText || `HTTP ${delRes.status}`
        });
      }
    } catch (err: any) {
      return res.status(502).json({
        status: 'error',
        error: 'Failed to delete push subscription from Supabase public.push_subscriptions',
        details: err?.message || String(err)
      });
    }
  }

  return res.json({ status: 'ok' });
});

// Backward-compatible subscribe endpoint
app.post('/api/push/subscribe', async (req, res) => {
  const actor = await resolveFeatureAndWinterActor(req).catch(() => null);
  if (!actor || isAnonymousPushUserIdServer(actor.id)) {
    return res.status(401).json({
      status: 'error',
      error: 'Authentication is required to subscribe to push notifications.',
      tokenStored: false
    });
  }

  const { subscription, deviceId, userAgent, role, grade, section, house, schoolId } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({
      status: 'error',
      error: 'A complete Web Push subscription with endpoint, p256dh, and auth keys is required.',
      tokenStored: false
    });
  }

  const devId = deviceId || 'dev_' + Math.random().toString(36).substring(2, 10);
  const effectiveUserId = actor.id;
  const effectiveRole = actor.role || role || 'student';
  const effectiveGrade = actor.grade || grade || '';
  const effectiveSection = actor.section || section || '';

  const sbResult = await persistSubscriptionToSupabase({
    endpoint: String(subscription.endpoint).trim(),
    p256dh: String(subscription.keys.p256dh),
    auth: String(subscription.keys.auth),
    userId: effectiveUserId,
    userJwt: actor.authToken,
    deviceId: devId,
    deviceLabel: userAgent || 'Web Browser',
    role: effectiveRole,
    grade: effectiveGrade,
    section: effectiveSection,
    house: house || '',
    schoolId: schoolId || 'default_school'
  });

  if (!sbResult.success) {
    return res.status(502).json({
      status: 'error',
      error: 'Failed to save push subscription to Supabase public.push_subscriptions',
      details: sbResult.error,
      supabaseStatus: sbResult.status || 502,
      tokenStored: false
    });
  }

  const existingIdx = memoryFCMTokens.findIndex(t => t.token === subscription.endpoint || t.deviceId === devId);
  const newItem: FCMTokenItem = {
    token: subscription.endpoint,
    userId: effectiveUserId,
    deviceId: devId,
    role: effectiveRole,
    grade: effectiveGrade,
    section: effectiveSection,
    house: house || '',
    schoolId: schoolId || 'default_school',
    subscription,
    userAgent: userAgent || '',
    isActive: true,
    updatedAt: Date.now()
  };

  if (existingIdx >= 0) {
    memoryFCMTokens[existingIdx] = newItem;
  } else {
    memoryFCMTokens.push(newItem);
  }

  return res.json({ status: 'ok', deviceId: devId, userId: effectiveUserId, tokenStored: true });
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const actor = await resolveFeatureAndWinterActor(req).catch(() => null);
  if (!actor || isAnonymousPushUserIdServer(actor.id)) {
    return res.status(401).json({
      status: 'error',
      error: 'Authentication is required to unsubscribe.'
    });
  }

  const { deviceId } = req.body || {};
  for (let i = memoryFCMTokens.length - 1; i >= 0; i--) {
    const item = memoryFCMTokens[i];
    if (item.userId === actor.id && (!deviceId || item.deviceId === deviceId)) {
      item.isActive = false;
    }
  }
  return res.json({ status: 'ok' });
});

export interface PushDispatchParams {
  notificationId?: string;
  title?: string;
  body?: string;
  type?: string;
  linkTab?: string;
  tag?: string;
  callId?: string;
  targetUserId?: string | null;
  targetRole?: string | null;
  targetRoles?: string[] | null;
  targetClass?: string | null;
  targetSection?: string | null;
  targetSchoolId?: string | null;
}

export function expandTargetRoleSet(targetRole?: string | null, targetRoles?: string[] | null): Set<string> {
  const rawList: string[] = [];
  if (Array.isArray(targetRoles)) {
    for (const r of targetRoles) {
      if (r) rawList.push(String(r));
    }
  }
  if (targetRole) {
    for (const part of String(targetRole).split(',')) {
      if (part.trim()) rawList.push(part.trim());
    }
  }

  const expanded = new Set<string>();
  for (const r of rawList) {
    const norm = r.toLowerCase().trim();
    if (!norm) continue;
    if (norm === 'all') {
      return new Set(['all']);
    }
    if (norm === 'faculty' || norm === 'staff') {
      expanded.add('teacher');
      expanded.add('coordinator');
      expanded.add('hod');
      expanded.add('admin');
      expanded.add('super_admin');
    } else {
      expanded.add(norm);
    }
  }

  if (expanded.size === 0) expanded.add('all');
  return expanded;
}

function normalizePushGradeToken(val?: string | null): string {
  const raw = String(val || '').toLowerCase().trim();
  if (!raw || raw === 'all' || raw === 'all_grades' || raw === 'all grades' || raw === 'all_sections' || raw === 'all sections') {
    return 'all';
  }
  const stripped = raw
    .replace(/all[_\s]*sections?/gi, '')
    .replace(/all[_\s]*grades?/gi, '')
    .replace(/class|grade/gi, '')
    .replace(/[_\s]+/g, '')
    .trim();
  return stripped || 'all';
}

function normalizePushSectionToken(val?: string | null): string {
  const raw = String(val || '').toLowerCase().trim();
  if (!raw || raw === 'all' || raw === 'all_sections' || raw === 'all sections') {
    return 'all';
  }
  return raw.replace(/section/gi, '').replace(/[_\s]+/g, '').trim() || 'all';
}

export function doesSubscriptionMatchPushTarget(
  item: {
    userId?: string;
    role?: string;
    grade?: string;
    section?: string;
    schoolId?: string;
  },
  params: Pick<PushDispatchParams, 'targetSchoolId' | 'targetUserId' | 'targetRole' | 'targetRoles' | 'targetClass' | 'targetSection'>
): boolean {
  const { targetSchoolId, targetUserId, targetRole, targetRoles, targetClass, targetSection } = params;

  if (targetSchoolId && targetSchoolId !== 'all' && item.schoolId && item.schoolId !== targetSchoolId) {
    return false;
  }

  if (targetUserId && targetUserId !== 'all') {
    if (!item.userId || item.userId !== targetUserId) {
      return false;
    }
  }

  const expandedRoles = expandTargetRoleSet(targetRole, targetRoles);
  if (!expandedRoles.has('all') && item.role) {
    const itemRole = String(item.role).toLowerCase().trim();
    if (!expandedRoles.has(itemRole)) {
      return false;
    }
  }

  const normTGrade = normalizePushGradeToken(targetClass);
  if (normTGrade !== 'all') {
    const normUGrade = normalizePushGradeToken(item.grade);
    if (!normUGrade || normUGrade === 'all' || normUGrade !== normTGrade) {
      return false;
    }
  }

  const normTSection = normalizePushSectionToken(targetSection);
  if (normTSection !== 'all') {
    const normUSection = normalizePushSectionToken(item.section);
    if (!normUSection || normUSection === 'all' || normUSection !== normTSection) {
      return false;
    }
  }

  return true;
}

export async function dispatchServerWebPush(params: PushDispatchParams) {
  const {
    notificationId,
    title,
    body,
    type,
    linkTab,
    tag,
    callId,
    targetUserId,
    targetRole,
    targetRoles,
    targetClass,
    targetSection,
    targetSchoolId
  } = params || {};

  const notifId = notificationId || `notif_${Date.now()}`;
  const notifTitle = title || '📢 StudentOS Alert';
  const notifBody = body || '';
  const notifType = type || 'announcement';
  const resolvedCallId = callId || (notifType === 'call' || notifType === 'incoming_call' ? notifId : '');
  const notifLinkTab = linkTab || (resolvedCallId ? 'peer_chat' : 'notice_viewer');
  const notifSchoolId = targetSchoolId || 'default_school';
  const notifTag = tag || `studentos-notif-${notifId}`;
  const notifUrl = `/?tab=${encodeURIComponent(notifLinkTab)}&notifId=${encodeURIComponent(notifId)}${resolvedCallId ? `&callId=${encodeURIComponent(resolvedCallId)}` : ''}`;

  console.log(`[FCM PUSH SEND] Dispatching Notice: id="${notifId}" | title="${notifTitle}" | targetUser="${targetUserId || 'all'}" | roles="${Array.isArray(targetRoles) && targetRoles.length ? targetRoles.join(',') : (targetRole || 'all')}" | class="${targetClass || 'all'}"`);

  // Structured FCM + Web Push payload supporting both notification and data blocks
  const payload = JSON.stringify({
    notification: {
      title: notifTitle,
      body: notifBody,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png'
    },
    data: {
      notificationId: notifId,
      notifId: notifId,
      callId: resolvedCallId,
      title: notifTitle,
      body: notifBody,
      route: notifLinkTab,
      linkTab: notifLinkTab,
      type: notifType,
      schoolId: notifSchoolId,
      tag: notifTag,
      url: notifUrl
    },
    title: notifTitle,
    body: notifBody,
    linkTab: notifLinkTab,
    notifId: notifId,
    callId: resolvedCallId,
    type: notifType,
    schoolId: notifSchoolId,
    url: notifUrl,
    tag: notifTag,
    timestamp: Date.now()
  });

  const tokensToTry: Array<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userId?: string;
    deviceId?: string;
    deviceLabel?: string;
    role?: string;
    grade?: string;
    section?: string;
    schoolId?: string;
    isActive: boolean;
  }> = [];

  // 1. Gather active tokens from server memory
  memoryFCMTokens.forEach(item => {
    if (item.isActive && (item.token || item.subscription?.endpoint)) {
      const endpoint = item.subscription?.endpoint || (item.token.startsWith('http') ? item.token : '');
      const p256dh = item.subscription?.keys?.p256dh;
      const auth = item.subscription?.keys?.auth;
      if (endpoint && p256dh && auth) {
        tokensToTry.push({
          endpoint,
          keys: { p256dh, auth },
          userId: item.userId || undefined,
          deviceId: item.deviceId,
          deviceLabel: item.deviceLabel,
          role: item.role,
          grade: item.grade,
          section: item.section,
          schoolId: item.schoolId,
          isActive: true
        });
      }
    }
  });

  // 2. Query push_subscriptions from Supabase (authoritative persistent store across Vercel serverless invocations)
  const sb = await resolvePushSupabaseConfig();
  let supabaseQueryError: string | null = null;

  if (process.env.NODE_ENV !== 'test' || sb.url.includes('127.0.0.1')) {
    try {
      const subRes = await supabaseFetchWithAnonRetry(
        `${sb.url}/rest/v1/push_subscriptions?select=*`,
        {
          headers: { apikey: sb.apiKey, Authorization: sb.authHeader }
        }
      );

      if (subRes.ok) {
        const dbSubs = await subRes.json();
        if (Array.isArray(dbSubs)) {
          dbSubs.forEach((row: any) => {
            if (row.endpoint && !tokensToTry.some(t => t.endpoint === row.endpoint)) {
              const rawKeys = row.keys && typeof row.keys === 'object' ? row.keys : {};
              const p256dh = row.p256dh || rawKeys.p256dh;
              const auth = row.auth || rawKeys.auth;
              const isActive = rawKeys.isActive !== false;

              if (p256dh && auth && isActive) {
                tokensToTry.push({
                  endpoint: row.endpoint,
                  keys: { p256dh, auth },
                  userId: row.user_id || rawKeys.userId || undefined,
                  deviceId: rawKeys.deviceId || undefined,
                  deviceLabel: rawKeys.deviceLabel || 'Android/Chrome Device',
                  role: row.role || rawKeys.role || undefined,
                  grade: row.grade || rawKeys.grade || undefined,
                  section: row.section || rawKeys.section || undefined,
                  schoolId: row.school_id || rawKeys.schoolId || 'default_school',
                  isActive: true
                });
              }
            }
          });
        }
      } else {
        const errText = await subRes.text().catch(() => subRes.statusText);
        supabaseQueryError = `HTTP ${subRes.status}: ${errText || 'Failed to read public.push_subscriptions'}`;
        console.warn('[FCM PUSH SEND] Supabase query failed:', supabaseQueryError);
      }
    } catch (dbErr: any) {
      supabaseQueryError = dbErr?.message || 'Supabase query exception';
      console.warn('[FCM PUSH SEND] Database query notice:', supabaseQueryError);
    }
  }

  const matchedTargets = tokensToTry.filter(item =>
    doesSubscriptionMatchPushTarget(item, {
      targetSchoolId,
      targetUserId,
      targetRole,
      targetRoles,
      targetClass,
      targetSection
    })
  );

  const runtimeVapid = getOrGenerateVapidKeys();
  const vapidConfigured = Boolean(runtimeVapid.publicKey && runtimeVapid.privateKey);
  if (!vapidConfigured) {
    console.warn('[FCM PUSH SEND] VAPID_PRIVATE_KEY is missing in server environment; preserving subscriptions and skipping unsigned webpush delivery.');
    return {
      status: 'ok',
      provider: 'fcm_webpush',
      vapidConfigured: false,
      notificationId: notifId,
      sentCount: 0,
      failCount: 0,
      totalCandidates: matchedTargets.length,
      fcmSendResult: 'VAPID_PRIVATE_KEY_NOT_CONFIGURED',
      error: 'Server VAPID_PRIVATE_KEY environment variable is not configured.',
      deliveryLogs: []
    };
  }
  if (!vapidKeys.privateKey && runtimeVapid.privateKey) {
    try {
      webpush.setVapidDetails(
        'mailto:notifications@studentos.internal',
        runtimeVapid.publicKey,
        runtimeVapid.privateKey
      );
    } catch (_) {}
  }

  let sentCount = 0;
  let failCount = 0;
  const deliveryLogs: any[] = [];

  for (const item of matchedTargets) {
    // Deliver via webpush to FCM endpoint
    if (item.endpoint && item.endpoint.startsWith('http') && item.keys?.p256dh && item.keys?.auth) {
      try {
        const pushResult = await webpush.sendNotification(
          {
            endpoint: item.endpoint,
            keys: {
              p256dh: item.keys.p256dh,
              auth: item.keys.auth
            }
          },
          payload,
          {
            TTL: 86400,
            urgency: 'high'
          }
        );
        sentCount++;
        const fcmHeaderLoc = pushResult.headers?.location || '';
        const messageId = fcmHeaderLoc
          ? String(fcmHeaderLoc).split('/').pop() || `fcm_msg_${Date.now()}`
          : `fcm_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        console.log('[FCM SERVER SEND TRACE]', {
          userId: item.userId || 'anonymous',
          tokenExists: 'yes',
          tokenActive: item.isActive ? 'yes' : 'no',
          targetUser: targetUserId || 'all',
          deviceLabel: item.deviceLabel || 'Android Chrome',
          fcmSendResult: `SUCCESS (HTTP ${pushResult.statusCode})`,
          fcmMessageId: messageId
        });

        deliveryLogs.push({
          userId: item.userId || 'anonymous',
          tokenExists: 'yes',
          tokenActive: 'yes',
          targetUser: targetUserId || 'all',
          deviceLabel: item.deviceLabel,
          status: 'delivered',
          fcmSendResult: 'SUCCESS',
          statusCode: pushResult.statusCode,
          messageId
        });
      } catch (pushErr: any) {
        failCount++;
        const statusCode = pushErr?.statusCode || 500;
        const errBody = pushErr?.body || pushErr?.message || String(pushErr);

        console.warn('[FCM SERVER SEND TRACE]', {
          userId: item.userId || 'anonymous',
          tokenExists: 'yes',
          tokenActive: item.isActive ? 'yes' : 'no',
          targetUser: targetUserId || 'all',
          deviceLabel: item.deviceLabel || 'Android Chrome',
          fcmSendResult: `FAILED (HTTP ${statusCode}: ${errBody})`,
          fcmMessageId: null
        });

        deliveryLogs.push({
          userId: item.userId || 'anonymous',
          tokenExists: 'yes',
          tokenActive: 'no',
          targetUser: targetUserId || 'all',
          deviceLabel: item.deviceLabel,
          status: 'failed',
          fcmSendResult: 'FAILED',
          statusCode,
          error: errBody
        });

        // Only delete genuinely expired/unregistered endpoints (HTTP 410 Gone / 404 Not Found).
        // Never purge subscriptions on 401/403 so transient or mismatched VAPID envs cannot wipe user devices.
        if (statusCode === 410 || statusCode === 404) {
          const idx = memoryFCMTokens.findIndex(m => m.token === item.endpoint || m.subscription?.endpoint === item.endpoint);
          if (idx >= 0) memoryFCMTokens.splice(idx, 1);
          try {
            await supabaseFetchWithAnonRetry(
              `${sb.url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(item.endpoint)}`,
              {
                method: 'DELETE',
                headers: { apikey: sb.apiKey, Authorization: sb.authHeader }
              }
            );
            console.log(`[FCM PUSH CLEANUP] Removed expired push subscription (HTTP ${statusCode}) for user="${item.userId || 'anon'}".`);
          } catch (_) {}
        }
      }
    }
  }

  return {
    status: 'ok',
    provider: 'fcm_webpush',
    vapidConfigured: true,
    notificationId: notifId,
    sentCount,
    failCount,
    totalCandidates: matchedTargets.length,
    fcmSendResult: sentCount > 0 ? 'DELIVERED' : (matchedTargets.length === 0 ? 'NO_TOKENS_REGISTERED' : 'DELIVERY_FAILED'),
    supabaseError: supabaseQueryError || undefined,
    deliveryLogs
  };
}

// Targeted Server-Side Push Dispatch via FCM & Web Push
app.post('/api/push/send', async (req, res) => {
  const actor = await resolveFeatureAndWinterActor(req).catch(() => null);
  if (!actor || isAnonymousPushUserIdServer(actor.id)) {
    return res.status(401).json({
      status: 'error',
      error: 'Authentication is required to dispatch server web push notifications.'
    });
  }

  const actorRole = String(actor.role || 'student').toLowerCase().trim();
  const isStaff = ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(actorRole);
  const body = req.body || {};
  const requestedTargetUser = String(body.targetUserId || '').trim();
  const notifType = String(body.type || '').toLowerCase().trim();
  const isPeerDirect = ['chat', 'mention', 'call', 'incoming_call'].includes(notifType);

  if (!isStaff) {
    if (!requestedTargetUser || requestedTargetUser === 'all') {
      return res.status(403).json({
        status: 'error',
        error: 'Broadcast push notifications require faculty or administrator privileges.'
      });
    }
    if (requestedTargetUser !== actor.id && !isPeerDirect) {
      return res.status(403).json({
        status: 'error',
        error: 'Students may only dispatch push notifications to themselves or direct peer chats/calls.'
      });
    }
  }

  const result = await dispatchServerWebPush(body);
  return res.json(result);
});

// Real-time Push Diagnostic Endpoint
app.get('/api/push/debug-status', async (req, res) => {
  const activeMemoryTokens = memoryFCMTokens.filter(t => t.isActive);
  const runtimeVapid = getOrGenerateVapidKeys();
  const sb = await resolvePushSupabaseConfig();
  let supabaseSubscriptions: any[] = [];
  let supabaseError: string | null = null;
  try {
    const subRes = await supabaseFetchWithAnonRetry(
      `${sb.url}/rest/v1/push_subscriptions?select=*`,
      {
        headers: { apikey: sb.apiKey, Authorization: sb.authHeader }
      }
    );
    if (subRes.ok) {
      const rows = await subRes.json();
      if (Array.isArray(rows)) {
        supabaseSubscriptions = rows.map(r => ({
          id: r.id,
          userId: r.user_id || r.keys?.userId || 'anonymous',
          role: r.role || r.keys?.role || 'student',
          grade: r.grade || r.keys?.grade || '',
          section: r.section || r.keys?.section || '',
          schoolId: r.school_id || r.keys?.schoolId || 'default_school',
          endpoint: r.endpoint ? (r.endpoint.slice(0, 32) + '...') : '',
          deviceLabel: r.keys?.deviceLabel || 'Browser',
          tokenExists: Boolean(r.endpoint),
          tokenActive: r.keys?.isActive !== false,
          updatedAt: r.updated_at
        }));
      }
    } else {
      const errText = await subRes.text().catch(() => subRes.statusText);
      supabaseError = `HTTP ${subRes.status}: ${errText || 'Supabase read failed'}`;
    }
  } catch (err: any) {
    supabaseError = err?.message || 'Supabase read exception';
  }

  res.json({
    vapidConfigured: Boolean(runtimeVapid.publicKey && runtimeVapid.privateKey),
    vapidPublicKeyPrefix: (runtimeVapid.publicKey || '').slice(0, 16) + '...',
    serviceRoleMissing: !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    serviceRoleConfigured: sb.serviceRoleConfigured,
    serviceRoleVerified: sb.serviceRoleVerified,
    supabaseError,
    activeMemoryTokenCount: activeMemoryTokens.length,
    supabaseSubscriptionCount: supabaseSubscriptions.length,
    supabaseSubscriptions,
    registeredDevices: activeMemoryTokens.map(t => ({
      userId: t.userId,
      deviceId: t.deviceId,
      deviceLabel: t.deviceLabel,
      role: t.role,
      hasSubscription: Boolean(t.subscription?.endpoint && t.subscription?.keys),
      updatedAt: new Date(t.updatedAt).toISOString()
    }))
  });
});

// ========================================================================
// STUDENTOS MICROSOFT EDGE TTS API ENDPOINTS (/api/tts/*)
// ========================================================================
app.get('/api/tts/voices', (req, res) => {
  return res.json({
    status: 'ok',
    provider: 'msedge-tts',
    voices: VERIFIED_EDGE_VOICES
  });
});

app.post('/api/tts/synthesize', async (req, res) => {
  const { text, voiceId, hindiVoiceId, englishVoiceId, speed, detectMixedLanguage } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text string is required for speech synthesis.' });
  }

  try {
    const result = await synthesizeEdgeSpeech({
      text,
      voiceId,
      hindiVoiceId,
      englishVoiceId,
      speed: Number(speed) || 1.0,
      detectMixedLanguage: detectMixedLanguage !== false
    });

    res.setHeader('Content-Type', result.contentType || 'audio/mpeg');
    res.setHeader('Content-Length', result.audioBuffer.length);
    res.setHeader('X-Voice-Id', result.voiceId);
    res.setHeader('X-Audio-Duration-Ms', String(result.durationMs));
    res.setHeader('X-Cache-Hit', result.cached ? '1' : '0');
    res.setHeader('X-TTS-Provider', 'msedge-tts');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.end(result.audioBuffer);
  } catch (err: any) {
    console.error('[Edge TTS API Error]:', err?.message || err);
    return res.status(503).json({
      error: err?.message || 'Edge TTS synthesis failed',
      provider: 'msedge-tts',
      fallback: 'speechSynthesis'
    });
  }
});

app.post('/api/tts/preview', async (req, res) => {
  const { voiceId, speed } = req.body || {};
  const voice = VERIFIED_EDGE_VOICES.find(v => v.id === voiceId) || VERIFIED_EDGE_VOICES[0];
  try {
    const result = await synthesizeEdgeSpeech({
      text: voice.sampleText,
      voiceId: voice.id,
      speed: Number(speed) || 1.0
    });
    res.setHeader('Content-Type', result.contentType || 'audio/mpeg');
    res.setHeader('Content-Length', result.audioBuffer.length);
    res.setHeader('X-Voice-Id', result.voiceId);
    res.setHeader('X-Cache-Hit', result.cached ? '1' : '0');
    res.setHeader('X-TTS-Provider', 'msedge-tts');
    return res.end(result.audioBuffer);
  } catch (err: any) {
    return res.status(503).json({ error: err?.message || 'Voice preview failed' });
  }
});

// ========================================================================
// STUDENTOS GAMIFICATION API ENDPOINTS (/api/gamification/*)
// ========================================================================
const memoryGamificationStore: Record<string, any> = {};

export function clearServerGamificationMemoryForTests(): void {
  if (process.env.NODE_ENV !== 'test') return;
  for (const key of Object.keys(memoryGamificationStore)) {
    delete memoryGamificationStore[key];
  }
}

const SERVER_GAMIFICATION_LEVELS = [
  { level: 1, title: 'Rookie Scholar', minXp: 0 },
  { level: 2, title: 'Curious Learner', minXp: 100 },
  { level: 3, title: 'Active Student', minXp: 250 },
  { level: 4, title: 'Focused Scholar', minXp: 450 },
  { level: 5, title: 'Knowledge Builder', minXp: 700 },
  { level: 6, title: 'Academic Achiever', minXp: 1000 },
  { level: 7, title: 'Top Performer', minXp: 1400 },
  { level: 8, title: 'Honor Student', minXp: 1900 },
  { level: 9, title: 'Master Scholar', minXp: 2500 },
  { level: 10, title: 'Campus Legend', minXp: 3200 },
];

function computeServerGamificationLevel(xp: number): { level: number; levelTitle: string } {
  let current = SERVER_GAMIFICATION_LEVELS[0];
  for (const lvl of SERVER_GAMIFICATION_LEVELS) {
    if (xp >= lvl.minXp) current = lvl;
  }
  return { level: current.level, levelTitle: current.title };
}

app.get('/api/gamification/profile', async (req, res) => {
  const userId = String(req.query.userId || '');
  const schoolId = String(req.query.schoolId || 'default_school');
  const cfg = getSupabaseServerConfig();
  const supabaseUrl = cfg.url;
  const supabaseKey = getFeatureAndWinterSupabaseKey(cfg.url, cfg.key) || WORKING_ANON_KEY;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  let storeData: Record<string, any> = { ...memoryGamificationStore };
  try {
    const gRes = await supabaseFetchWithAnonRetry(
      `${supabaseUrl}/rest/v1/global_data?id=eq.__studentos_gamification_${encodeURIComponent(schoolId)}__&select=*`,
      { headers }
    );
    if (gRes.ok) {
      const rows = await gRes.json();
      const content = rows[0]?.data ?? (rows[0]?.content ? JSON.parse(rows[0].content) : null);
      if (content && typeof content === 'object') {
        storeData = { ...content, ...storeData };
      }
    }
  } catch (_) {}

  // Reconcile user-specific doc, user_profiles.points, and gamification_xp_ledger sum so full historical XP is never hidden
  if (userId) {
    const encUid = encodeURIComponent(userId);
    const [uRes, pRes, lRes] = await Promise.all([
      supabaseFetchWithAnonRetry(
        `${supabaseUrl}/rest/v1/global_data?id=eq.gamification_user_${encUid}&select=*`,
        { headers }
      ).catch(() => null),
      supabaseFetchWithAnonRetry(
        `${supabaseUrl}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})&select=id,uid,name,role,points,grade,section,streak_days,longest_streak,streak_state,frozen_streak_count,last_active_date&limit=2`,
        { headers }
      ).catch(() => null),
      supabaseFetchWithAnonRetry(
        `${supabaseUrl}/rest/v1/gamification_xp_ledger?user_id=eq.${encUid}&select=xp_delta`,
        { headers }
      ).catch(() => null),
    ]);

    let candidateDoc: any = storeData[userId] || null;
    if (uRes && uRes.ok) {
      const uRows = await uRes.json().catch(() => []);
      const uContent = uRows[0]?.data ?? (uRows[0]?.content ? JSON.parse(uRows[0].content) : null);
      if (uContent && typeof uContent === 'object') {
        if (!candidateDoc || Number(uContent.xp || 0) >= Number(candidateDoc.xp || 0)) {
          candidateDoc = { ...(candidateDoc || {}), ...uContent };
        }
      }
    }

    let profilePoints = 0;
    let profileMeta: any = null;
    if (pRes && pRes.ok) {
      const pRows = await pRes.json().catch(() => []);
      if (Array.isArray(pRows)) {
        for (const p of pRows) {
          profilePoints = Math.max(profilePoints, Number(p?.points || 0));
          if (!profileMeta && p) profileMeta = p;
        }
      }
    }

    let ledgerSum = 0;
    if (lRes && lRes.ok) {
      const lRows = await lRes.json().catch(() => []);
      if (Array.isArray(lRows)) {
        ledgerSum = lRows.reduce((s: number, r: any) => s + Math.max(0, Number(r?.xp_delta || 0)), 0);
      }
    }

    const authoritativeXp = Math.max(
      Number(candidateDoc?.xp || 0),
      profilePoints,
      ledgerSum
    );

    if (candidateDoc || authoritativeXp > 0 || profileMeta) {
      const lvl = computeServerGamificationLevel(authoritativeXp);
      const dbStreak = profileMeta?.streak_days !== undefined && profileMeta?.streak_days !== null
        ? Number(profileMeta.streak_days)
        : Number(candidateDoc?.currentStreak ?? 0);
      const dbLongest = Math.max(
        dbStreak,
        Number(profileMeta?.longest_streak ?? 0),
        Number(candidateDoc?.longestStreak ?? 0)
      );
      storeData[userId] = {
        ...(candidateDoc || {}),
        userId,
        userName: candidateDoc?.userName || candidateDoc?.name || profileMeta?.name || 'Member',
        role: candidateDoc?.role || profileMeta?.role || 'student',
        grade: candidateDoc?.grade || profileMeta?.grade || '',
        section: candidateDoc?.section || profileMeta?.section || '',
        xp: authoritativeXp,
        currentStreak: dbStreak,
        longestStreak: dbLongest,
        streakState: profileMeta?.streak_state || candidateDoc?.streakState || 'active',
        frozenStreakCount: Number(profileMeta?.frozen_streak_count ?? candidateDoc?.frozenStreakCount ?? 0),
        lastActiveDate: profileMeta?.last_active_date || candidateDoc?.lastActiveDate || null,
        level: lvl.level,
        levelTitle: lvl.levelTitle,
      };
    }
  }

  const profile = userId ? storeData[userId] || null : null;
  const leaderboard = Object.values(storeData).sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0));

  return res.json({
    status: 'ok',
    profile,
    leaderboard
  });
});

app.post('/api/gamification/award', async (req, res) => {
  const { userId, schoolId = 'default_school', profile, syncContext } = req.body || {};
  if (!userId || !profile || typeof profile !== 'object') {
    return res.status(400).json({ error: 'userId and profile are required' });
  }

  const hasBearer = Boolean(req.headers.authorization || req.headers['x-supabase-auth']);
  const verified = hasBearer ? await getVerifiedUserFromRequest(req) : null;
  if (hasBearer && !verified) {
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
  const verifiedRole = String(verified?.role || '').toLowerCase();
  const isPriv = verifiedRole === 'super_admin' || verifiedRole === 'admin';
  if (verified && verified.id !== userId && !isPriv) {
    return res.status(403).json({ error: 'Forbidden: cannot modify another user gamification profile.' });
  }

  const cfg = getSupabaseServerConfig();
  const supabaseUrl = cfg.url;
  const supabaseKey = getFeatureAndWinterSupabaseKey(cfg.url, cfg.key) || cfg.key;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };
  const useDb =
    Boolean(supabaseUrl && supabaseKey) &&
    (process.env.NODE_ENV !== 'test' || supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost'));

  const docId = `__studentos_gamification_${schoolId}__`;
  const userDocId = `gamification_user_${userId}`;
  const encUid = encodeURIComponent(userId);

  try {
    let existingMap: Record<string, any> = {};
    let existingUserDoc: any = null;
    let profilePoints = 0;
    let ledgerSum = 0;

    if (useDb) {
      const [gRes, uRes, pRes, lRes] = await Promise.all([
        supabaseFetchWithAnonRetry(
          `${supabaseUrl}/rest/v1/global_data?id=eq.${encodeURIComponent(docId)}&select=*`,
          { headers }
        ),
        supabaseFetchWithAnonRetry(
          `${supabaseUrl}/rest/v1/global_data?id=eq.${encodeURIComponent(userDocId)}&select=*`,
          { headers }
        ).catch(() => null),
        supabaseFetchWithAnonRetry(
          `${supabaseUrl}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})&select=id,uid,points&limit=2`,
          { headers }
        ).catch(() => null),
        supabaseFetchWithAnonRetry(
          `${supabaseUrl}/rest/v1/gamification_xp_ledger?user_id=eq.${encUid}&select=xp_delta`,
          { headers }
        ).catch(() => null),
      ]);

      if (!gRes.ok) {
        const errText = await gRes.text().catch(() => '');
        return res.status(503).json({
          error: `Failed to read gamification state from Supabase (${gRes.status}): ${errText || gRes.statusText}`
        });
      }
      const rows = await gRes.json();
      const loaded = rows[0]?.data ?? (rows[0]?.content ? JSON.parse(rows[0].content) : null);
      if (loaded && typeof loaded === 'object') {
        existingMap = loaded;
      }

      if (uRes && uRes.ok) {
        const uRows = await uRes.json().catch(() => []);
        const uLoaded = uRows[0]?.data ?? (uRows[0]?.content ? JSON.parse(uRows[0].content) : null);
        if (uLoaded && typeof uLoaded === 'object') {
          existingUserDoc = uLoaded;
        }
      }

      if (pRes && pRes.ok) {
        const pRows = await pRes.json().catch(() => []);
        if (Array.isArray(pRows)) {
          for (const p of pRows) {
            profilePoints = Math.max(profilePoints, Number(p?.points || 0));
          }
        }
      }

      if (lRes && lRes.ok) {
        const lRows = await lRes.json().catch(() => []);
        if (Array.isArray(lRows)) {
          ledgerSum = lRows.reduce((s: number, r: any) => s + Math.max(0, Number(r?.xp_delta || 0)), 0);
        }
      }
    }

    const existingSchoolProfile = existingMap[userId];
    const existingProfile =
      existingUserDoc && Number(existingUserDoc.xp || 0) >= Number(existingSchoolProfile?.xp || 0)
        ? existingUserDoc
        : (existingSchoolProfile || memoryGamificationStore[userId]);

    const prevKnownXp = Math.max(
      Number(existingSchoolProfile?.xp || 0),
      Number(existingUserDoc?.xp || 0),
      Number(memoryGamificationStore[userId]?.xp || 0),
      profilePoints,
      ledgerSum
    );

    const incomingXp = Math.max(0, Number(profile.xp || 0));
    if (prevKnownXp > incomingXp) {
      // NEVER let a stale/unhydrated client payload overwrite higher authoritative XP!
      profile.xp = prevKnownXp;
      const lvl = computeServerGamificationLevel(prevKnownXp);
      profile.level = lvl.level;
      profile.levelTitle = lvl.levelTitle;
    } else if (!isPriv && incomingXp - prevKnownXp > 150) {
      // Prevent raw client payload tampering with arbitrary XP jumps
      profile.xp = prevKnownXp + 150;
      const lvl = computeServerGamificationLevel(profile.xp);
      profile.level = lvl.level;
      profile.levelTitle = lvl.levelTitle;
    }

    // Preserve badges, completedActionKeys, and highest action counters from existing cloud profile
    if (existingProfile && typeof existingProfile === 'object') {
      if (existingProfile.earnedBadges && typeof existingProfile.earnedBadges === 'object') {
        profile.earnedBadges = {
          ...existingProfile.earnedBadges,
          ...(profile.earnedBadges || {}),
        };
      }
      if (Array.isArray(existingProfile.completedActionKeys)) {
        profile.completedActionKeys = Array.from(
          new Set([...existingProfile.completedActionKeys, ...(profile.completedActionKeys || [])])
        ).slice(-500);
      }
      if (existingProfile.counts && typeof existingProfile.counts === 'object') {
        const mergedCounts: Record<string, number> = { ...existingProfile.counts };
        for (const [ck, cv] of Object.entries(profile.counts || {})) {
          mergedCounts[ck] = Math.max(Number(mergedCounts[ck] || 0), Number(cv || 0));
        }
        profile.counts = mergedCounts;
      }
      if (existingProfile.equippedBanner && !profile.equippedBanner) {
        profile.equippedBanner = existingProfile.equippedBanner;
      }
      if (existingProfile.equippedBorder && !profile.equippedBorder) {
        profile.equippedBorder = existingProfile.equippedBorder;
      }
    }

    const authoritativeDelta = Math.max(0, Math.round(Number(profile.xp || 0) - prevKnownXp));

    if (useDb) {
      const nextMap = { ...existingMap, [userId]: profile };

      // 1. Persist aggregated school gamification store
      const schoolRes = await supabaseFetchWithAnonRetry(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: docId,
          data: nextMap,
          updated_at: new Date().toISOString()
        })
      });
      if (!schoolRes.ok) {
        const errText = await schoolRes.text().catch(() => '');
        return res.status(503).json({
          error: `Failed to persist school gamification store (${schoolRes.status}): ${errText || schoolRes.statusText}`
        });
      }

      // 2. Persist individual user profile document for rock-solid cross-device isolation
      const userDocRes = await supabaseFetchWithAnonRetry(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: userDocId,
          data: profile,
          updated_at: new Date().toISOString()
        })
      });
      if (!userDocRes.ok) {
        const errText = await userDocRes.text().catch(() => '');
        return res.status(503).json({
          error: `Failed to persist user gamification profile (${userDocRes.status}): ${errText || userDocRes.statusText}`
        });
      }

      // 3. Mirror points to user_profiles table across both id and uid columns
      const profPatchRes = await supabaseFetchWithAnonRetry(`${supabaseUrl}/rest/v1/user_profiles?or=(id.eq.${encUid},uid.eq.${encUid})`, {
        method: 'PATCH',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          points: profile.xp,
          updated_at: Date.now()
        })
      });
      if (!profPatchRes.ok) {
        const errText = await profPatchRes.text().catch(() => '');
        return res.status(503).json({
          error: `Failed to sync user_profiles points (${profPatchRes.status}): ${errText || profPatchRes.statusText}`
        });
      }

      Object.assign(memoryGamificationStore, nextMap);
    } else {
      memoryGamificationStore[userId] = profile;
      existingMap[userId] = profile;
      Object.assign(memoryGamificationStore, existingMap);
    }

    // 4. Mirror positive XP deltas into gamification_xp_ledger so Weekly/Monthly/All-Time leaderboards stay consistent across accounts
    const syncCtx = syncContext && typeof syncContext === 'object' ? syncContext : null;
    if (authoritativeDelta > 0 && !syncCtx?.skipLedgerSync) {
      const nowIso = new Date().toISOString();
      const actionSlug = String(syncCtx?.action || 'xp_award').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
      const uniquePart = String(syncCtx?.uniqueItemId || profile.updatedAt || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
      const ledgerId = `xp_awd_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await appendXpLedgerEntry(
        () => cfg,
        {
          id: ledgerId,
          userId: String(userId),
          userName: String(profile.userName || profile.name || verified?.user_metadata?.name || 'Campus Member'),
          userRole: String(profile.role || verifiedRole || 'student').toLowerCase(),
          grade: String(profile.grade || ''),
          section: String(profile.section || ''),
          house: String(profile.house || ''),
          avatar: String(profile.avatar || ''),
          sourceType: 'academic',
          actionKey: `award:${actionSlug}:${uniquePart}`,
          xpDelta: Math.min(authoritativeDelta, isPriv ? authoritativeDelta : 150),
          label: String(syncCtx?.label || 'Academic Achievement').slice(0, 120),
          createdAt: nowIso,
        },
        { alreadyAddedToProfile: true }
      ).catch((ledErr) => {
        console.warn('[GAMIFICATION] Non-fatal XP ledger mirror warning:', ledErr?.message || ledErr);
      });
      broadcastToAllWs({
        type: 'leaderboard:updated',
        userId: String(userId),
        role: String(profile.role || verifiedRole || 'student').toLowerCase(),
      });
    }
  } catch (e: any) {
    return res.status(503).json({
      error: `Gamification persistence error: ${e?.message || String(e)}`
    });
  }

  return res.json({ status: 'ok', profile });
});

// ========================================================================
// STUDENTOS BRAIN BATTLE API & AUTHORITATIVE MULTIPLAYER ENGINE
// ========================================================================
interface BrainBattleQuestion {
  id: string;
  subject: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  grade?: string;
  createdBy?: string;
  createdByName?: string;
}

interface BrainBattleHistoryItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  house?: string;
  grade?: string;
  mode: 'quick_play' | 'daily_challenge' | 'multiplayer' | 'custom_practice';
  subject: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  accuracyPercent: number;
  xpEarned: number;
  streakPeak: number;
  durationSec: number;
  roomCode?: string;
  rankInMatch?: number;
  timestamp: string;
}

interface BrainBattlePlayerState {
  userId: string;
  name: string;
  role: string;
  house?: string;
  grade?: string;
  avatar?: string;
  score: number;
  correctCount: number;
  streak: number;
  answeredCurrentIndex: number;
  lastAnswerCorrect?: boolean;
  joinedAt: number;
}

interface BrainBattleRoomState {
  code: string;
  hostId: string;
  hostName: string;
  subject: string;
  difficulty: 'all' | 'easy' | 'medium' | 'hard';
  questionCount: number;
  timePerQuestion: number;
  status: 'lobby' | 'active' | 'completed';
  currentQuestionIndex: number;
  questionStartedAt: number;
  questions: BrainBattleQuestion[];
  players: Record<string, BrainBattlePlayerState>;
  createdAt: number;
  updatedAt: number;
}

const memoryBrainBattleQuestions: Record<string, BrainBattleQuestion[]> = {};
const memoryBrainBattleHistory: Record<string, BrainBattleHistoryItem[]> = {};
const memoryBrainBattleRooms: Record<string, BrainBattleRoomState> = {};

function broadcastToAllWs(payload: any) {
  if (!globalWss) return;
  const serialized = JSON.stringify(payload);
  globalWss.clients.forEach((client: any) => {
    if (client.readyState === WSWebSocket.OPEN) {
      try {
        client.send(serialized);
      } catch (_) {}
    }
  });
}

function broadcastScopedWsEvent(eventType: string, payload: any, scope: AcademicEventScope) {
  if (!globalWss) return;
  const serialized = JSON.stringify(
    eventType === 'academic:sync'
      ? { type: eventType, payload }
      : eventType === 'announcement:received'
      ? { type: eventType, announcement: payload }
      : eventType === 'homework:received' || eventType === 'homework:updated'
      ? { type: eventType, homework: payload }
      : { type: eventType, payload }
  );
  globalWss.clients.forEach((client: any) => {
    if (client.readyState !== WSWebSocket.OPEN) return;
    const recipient = client._veylentraUser || { authenticated: false, role: 'student', userId: '' };
    if (isWsClientEligibleForAcademicEvent(recipient, scope)) {
      try {
        client.send(serialized);
      } catch (_) {}
    }
  });
}

app.get('/api/brain-battle/state', async (req, res) => {
  const schoolId = String(req.query.schoolId || 'default_school');
  const userId = String(req.query.userId || '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  let customQuestions: BrainBattleQuestion[] = memoryBrainBattleQuestions[schoolId] || [];
  let allHistory: BrainBattleHistoryItem[] = memoryBrainBattleHistory[schoolId] || [];

  try {
    const qDocId = `__studentos_brain_battle_questions_${schoolId}__`;
    const hDocId = `__studentos_brain_battle_history_${schoolId}__`;
    const gRes = await fetch(
      `${supabaseUrl}/rest/v1/global_data?id=in.(${encodeURIComponent(qDocId)},${encodeURIComponent(hDocId)})&select=*`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    if (gRes.ok) {
      const rows = await gRes.json();
      if (Array.isArray(rows)) {
        for (const r of rows) {
          if (r.id === qDocId && r.content) {
            const parsedQ = JSON.parse(r.content);
            if (Array.isArray(parsedQ)) {
              customQuestions = parsedQ;
              memoryBrainBattleQuestions[schoolId] = parsedQ;
            }
          }
          if (r.id === hDocId && r.content) {
            const parsedH = JSON.parse(r.content);
            if (Array.isArray(parsedH)) {
              allHistory = parsedH;
              memoryBrainBattleHistory[schoolId] = parsedH;
            }
          }
        }
      }
    }
  } catch (_) {}

  const userHistory = userId
    ? allHistory.filter(h => h.userId === userId).slice(0, 20)
    : allHistory.slice(0, 20);

  const activeRooms = Object.values(memoryBrainBattleRooms)
    .filter(r => Date.now() - r.updatedAt < 30 * 60 * 1000)
    .map(r => ({
      code: r.code,
      hostId: r.hostId,
      hostName: r.hostName,
      subject: r.subject,
      difficulty: r.difficulty,
      questionCount: r.questionCount,
      status: r.status,
      playerCount: Object.keys(r.players).length,
      players: Object.values(r.players)
    }));

  return res.json({
    status: 'ok',
    customQuestions,
    history: userHistory,
    recentCampusMatches: allHistory.slice(0, 15),
    activeRooms
  });
});

app.post('/api/brain-battle/questions', async (req, res) => {
  const { schoolId = 'default_school', question, userRole } = req.body || {};
  if (!question || !question.question || !Array.isArray(question.options) || question.options.length < 2) {
    return res.status(400).json({ error: 'Valid question and options are required.' });
  }
  if (!['teacher', 'coordinator', 'admin', 'super_admin'].includes(String(userRole || ''))) {
    return res.status(403).json({ error: 'Only faculty and administrators can add custom questions to the campus bank.' });
  }

  const list = memoryBrainBattleQuestions[schoolId] || [];
  const newQ: BrainBattleQuestion = {
    id: question.id || `bbq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    subject: question.subject || 'General Knowledge',
    question: String(question.question).trim(),
    options: question.options.map((o: any) => String(o).trim()),
    correctOptionIndex: Number(question.correctOptionIndex) || 0,
    explanation: String(question.explanation || 'Verified campus explanation.').trim(),
    difficulty: ['easy', 'medium', 'hard'].includes(question.difficulty) ? question.difficulty : 'medium',
    grade: question.grade || 'All Grades',
    createdBy: question.createdBy || '',
    createdByName: question.createdByName || 'Faculty'
  };

  const updated = [newQ, ...list.filter(q => q.id !== newQ.id)].slice(0, 200);
  memoryBrainBattleQuestions[schoolId] = updated;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
  const qDocId = `__studentos_brain_battle_questions_${schoolId}__`;

  try {
    await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: qDocId,
        title: 'StudentOS Brain Battle Question Bank',
        subject: schoolId,
        content: JSON.stringify(updated),
        created_at: new Date().toISOString()
      })
    });
  } catch (_) {}

  return res.json({ status: 'ok', question: newQ, customQuestions: updated });
});

app.post('/api/brain-battle/complete', async (req, res) => {
  const { schoolId = 'default_school', matchResult } = req.body || {};
  if (!matchResult || !matchResult.id || !matchResult.userId) {
    return res.status(400).json({ error: 'matchResult with id and userId is required.' });
  }

  const list = memoryBrainBattleHistory[schoolId] || [];
  if (list.some(item => item.id === matchResult.id)) {
    return res.json({ status: 'ok', duplicate: true, history: list.filter(i => i.userId === matchResult.userId).slice(0, 20) });
  }

  // Server-side validation of score & XP bounds to prevent manipulation
  const totalQ = Math.max(1, Math.min(30, Number(matchResult.totalQuestions) || 5));
  const correctQ = Math.max(0, Math.min(totalQ, Number(matchResult.correctCount) || 0));
  const accuracy = Math.round((correctQ / totalQ) * 100);
  const clampedXp = Math.max(5, Math.min(180, Number(matchResult.xpEarned) || 35));

  const validatedItem: BrainBattleHistoryItem = {
    id: String(matchResult.id),
    userId: String(matchResult.userId),
    userName: String(matchResult.userName || 'Scholar'),
    userRole: String(matchResult.userRole || 'student'),
    house: matchResult.house || '',
    grade: matchResult.grade || '',
    mode: matchResult.mode || 'quick_play',
    subject: String(matchResult.subject || 'Mixed Arena'),
    score: Math.max(0, Math.min(totalQ * 300, Number(matchResult.score) || correctQ * 100)),
    correctCount: correctQ,
    totalQuestions: totalQ,
    accuracyPercent: accuracy,
    xpEarned: clampedXp,
    streakPeak: Math.max(0, Math.min(totalQ, Number(matchResult.streakPeak) || 0)),
    durationSec: Math.max(1, Number(matchResult.durationSec) || 30),
    roomCode: matchResult.roomCode,
    rankInMatch: matchResult.rankInMatch,
    timestamp: new Date().toISOString()
  };

  const updated = [validatedItem, ...list].slice(0, 250);
  const cfg = getSupabaseServerConfig();
  const hDocId = `__studentos_brain_battle_history_${schoolId}__`;
  const useDb =
    Boolean(cfg.url && cfg.key) &&
    (process.env.NODE_ENV !== 'test' || cfg.url.includes('127.0.0.1') || cfg.url.includes('localhost'));

  if (useDb) {
    try {
      const saveRes = await fetch(`${cfg.url}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: hDocId,
          data: updated,
          updated_at: new Date().toISOString()
        })
      });
      if (!saveRes.ok) {
        const errText = await saveRes.text().catch(() => '');
        return res.status(503).json({
          error: `Failed to save Brain Battle history (${saveRes.status}): ${errText || saveRes.statusText}`
        });
      }
    } catch (bbErr: any) {
      return res.status(503).json({
        error: `Brain Battle persistence error: ${bbErr?.message || String(bbErr)}`
      });
    }
  }

  memoryBrainBattleHistory[schoolId] = updated;

  try {
    await appendXpLedgerEntry(getSupabaseServerConfig, {
      id: `xp_bb_${validatedItem.id}`,
      userId: validatedItem.userId,
      userName: validatedItem.userName,
      userRole: validatedItem.userRole,
      grade: validatedItem.grade || '',
      section: '',
      house: validatedItem.house || '',
      sourceType: 'academic',
      actionKey: `brain_battle:${validatedItem.id}`,
      xpDelta: validatedItem.xpEarned,
      label: `Brain Battle: ${validatedItem.subject}`,
      createdAt: validatedItem.timestamp,
    });
  } catch (xpErr: any) {
    return res.status(503).json({
      error: `Failed to record Brain Battle XP ledger: ${xpErr?.message || String(xpErr)}`
    });
  }

  return res.json({
    status: 'ok',
    matchResult: validatedItem,
    history: updated.filter(i => i.userId === validatedItem.userId).slice(0, 20),
    recentCampusMatches: updated.slice(0, 15)
  });
});

// Authoritative Live Multiplayer Room Endpoints backed by Supabase persistence
async function fetchBrainBattleRoomFromSupabase(code: string): Promise<BrainBattleRoomState | null> {
  const cleanCode = String(code || '').toUpperCase().trim();
  if (memoryBrainBattleRooms[cleanCode]) {
    return memoryBrainBattleRooms[cleanCode];
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.__bb_room_${encodeURIComponent(cleanCode)}__&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    if (res.ok) {
      const rows = await res.json();
      const parsed = rows[0]?.data ?? (rows[0]?.content ? JSON.parse(rows[0].content) : null);
      if (parsed && parsed.code) {
        memoryBrainBattleRooms[cleanCode] = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[BrainBattle Server] Supabase room lookup warning for ${cleanCode}:`, err);
  }

  return null;
}

async function persistBrainBattleRoomToSupabase(room: BrainBattleRoomState) {
  if (!room || !room.code) return;
  memoryBrainBattleRooms[room.code] = room;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  try {
    await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: `__bb_room_${room.code}__`,
        data: room,
        updated_at: new Date().toISOString()
      })
    });
  } catch (err) {
    console.warn(`[BrainBattle Server] Supabase room persistence warning:`, err);
  }
}

app.get('/api/brain-battle/rooms/active', async (req, res) => {
  // Merge from Supabase cloud store to support multiple clients / restarted servers
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
    const rRes = await fetch(`${supabaseUrl}/rest/v1/global_data?id=like.__bb_room_%25__&select=*&limit=30`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    if (rRes.ok) {
      const rows = await rRes.json();
      if (Array.isArray(rows)) {
        rows.forEach((r: any) => {
          const roomObj = r.data ?? (r.content ? JSON.parse(r.content) : null);
          if (roomObj && roomObj.code && !memoryBrainBattleRooms[roomObj.code]) {
            memoryBrainBattleRooms[roomObj.code] = roomObj;
          }
        });
      }
    }
  } catch (_) {}

  const activeRooms = Object.values(memoryBrainBattleRooms)
    .filter(r => r.status === 'lobby' || r.status === 'active')
    .map(r => ({
      code: r.code,
      hostName: r.hostName,
      subject: r.subject,
      difficulty: r.difficulty,
      playerCount: Object.keys(r.players || {}).length,
      status: r.status,
      createdAt: r.createdAt
    }));
  return res.json({ status: 'ok', rooms: activeRooms });
});

app.post('/api/brain-battle/rooms/create', async (req, res) => {
  const { host, subject = 'Mixed Arena', difficulty = 'all', questionCount = 5, timePerQuestion = 15, questions = [] } = req.body || {};
  if (!host || !host.userId) {
    return res.status(400).json({ error: 'Authenticated host is required to create a room.' });
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const now = Date.now();
  const room: BrainBattleRoomState = {
    code,
    hostId: host.userId,
    hostName: host.name || 'Host Scholar',
    subject,
    difficulty,
    questionCount: Math.min(15, Math.max(3, Number(questionCount) || 5)),
    timePerQuestion: Math.min(45, Math.max(10, Number(timePerQuestion) || 15)),
    status: 'lobby',
    currentQuestionIndex: 0,
    questionStartedAt: 0,
    questions: Array.isArray(questions) ? questions : [],
    players: {
      [host.userId]: {
        userId: host.userId,
        name: host.name || 'Host Scholar',
        role: host.role || 'student',
        house: host.house || 'Sapphire',
        grade: host.grade || '',
        avatar: host.avatar || '',
        score: 0,
        correctCount: 0,
        streak: 0,
        answeredCurrentIndex: -1,
        joinedAt: now
      }
    },
    createdAt: now,
    updatedAt: now
  };

  await persistBrainBattleRoomToSupabase(room);

  broadcastToAllWs({
    type: 'realtime:relay',
    channel: `brain_battle_room_${code}`,
    event: 'room:state',
    data: room,
    envelopeId: `srv_${Date.now()}`
  });

  return res.json({ status: 'ok', room });
});

app.get('/api/brain-battle/rooms/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().trim();
  const room = await fetchBrainBattleRoomFromSupabase(code);
  if (!room) {
    return res.status(404).json({ error: 'Battle Room not found or expired. Verify the 6-character code.' });
  }
  return res.json({ status: 'ok', room });
});

app.post('/api/brain-battle/rooms/join', async (req, res) => {
  const { code: rawCode, player } = req.body || {};
  const code = String(rawCode || '').toUpperCase().trim();
  let room = await fetchBrainBattleRoomFromSupabase(code);
  if (!room) {
    return res.status(404).json({ error: 'Battle Room not found. Check the code and try again.' });
  }
  if (!player || !player.userId) {
    return res.status(400).json({ error: 'Valid player profile is required to join.' });
  }

  // Prevent joins on completed rooms
  if (room.status === 'completed') {
    return res.status(400).json({ error: 'This battle has already completed.' });
  }

  // Enforce room capacity limit (max 8 players per room)
  const currentCount = Object.keys(room.players || {}).length;
  if (!room.players[player.userId] && currentCount >= 8) {
    return res.status(400).json({ error: 'Room is at maximum capacity (8 players).' });
  }

  if (!room.players[player.userId]) {
    room.players[player.userId] = {
      userId: player.userId,
      name: player.name || 'Challenger',
      role: player.role || 'student',
      house: player.house || 'Emerald',
      grade: player.grade || '',
      avatar: player.avatar || '',
      score: 0,
      correctCount: 0,
      streak: 0,
      answeredCurrentIndex: -1,
      joinedAt: Date.now()
    };
  }
  room.updatedAt = Date.now();

  await persistBrainBattleRoomToSupabase(room);

  broadcastToAllWs({
    type: 'realtime:relay',
    channel: `brain_battle_room_${code}`,
    event: 'room:state',
    data: room,
    envelopeId: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  });

  return res.json({ status: 'ok', room });
});

app.post('/api/brain-battle/rooms/action', async (req, res) => {
  const { code: rawCode, action, userId, optionIndex, timeLeftSec } = req.body || {};
  const code = String(rawCode || '').toUpperCase().trim();
  let room = await fetchBrainBattleRoomFromSupabase(code);
  if (!room) {
    return res.status(404).json({ error: 'Battle Room not found.' });
  }

  const now = Date.now();
  if (action === 'start' && userId === room.hostId) {
    room.status = 'active';
    room.currentQuestionIndex = 0;
    room.questionStartedAt = now;
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.correctCount = 0;
      p.streak = 0;
      p.answeredCurrentIndex = -1;
      p.lastAnswerCorrect = undefined;
    });
  } else if (action === 'answer') {
    const p = room.players[userId];
    const currentQ = room.questions[room.currentQuestionIndex];
    if (p && currentQ && p.answeredCurrentIndex !== room.currentQuestionIndex) {
      p.answeredCurrentIndex = room.currentQuestionIndex;
      const isCorrect = Number(optionIndex) === Number(currentQ.correctOptionIndex);
      p.lastAnswerCorrect = isCorrect;
      if (isCorrect) {
        p.correctCount += 1;
        p.streak += 1;
        const speedBonus = Math.max(0, Math.min(50, Math.round((Number(timeLeftSec) || 0) * 3)));
        const streakBonus = Math.min(60, (p.streak - 1) * 15);
        p.score += 100 + speedBonus + streakBonus;
      } else {
        p.streak = 0;
      }
    }
  } else if (action === 'next') {
    if (room.currentQuestionIndex + 1 < room.questions.length) {
      room.currentQuestionIndex += 1;
      room.questionStartedAt = now;
    } else {
      room.status = 'completed';
    }
  }

  room.updatedAt = now;
  await persistBrainBattleRoomToSupabase(room);

  broadcastToAllWs({
    type: 'realtime:relay',
    channel: `brain_battle_room_${code}`,
    event: 'room:state',
    data: room,
    envelopeId: `srv_${now}_${Math.random().toString(36).slice(2, 6)}`
  });

  return res.json({ status: 'ok', room });
});

// ============================================================================
// OFFICIAL SYLLABUS, TIMETABLES & STUDY SESSIONS SERVER ENDPOINTS
// Backed by Supabase global_data cloud persistence
// ============================================================================

app.get('/api/syllabus', async (req, res) => {
  const schoolId = String(req.query.schoolId || 'default_school');
  const grade = String(req.query.grade || '');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.__studentos_syllabus_${encodeURIComponent(schoolId)}__&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    if (r.ok) {
      const rows = await r.json();
      const content = rows[0]?.data ?? (rows[0]?.content ? JSON.parse(rows[0].content) : null);
      if (Array.isArray(content)) {
        let parsed = content;
        if (grade) parsed = parsed.filter((s: any) => s.grade?.toLowerCase() === grade.toLowerCase());
        return res.json({ status: 'ok', syllabuses: parsed });
      }
    }
  } catch (_) {}

  return res.json({ status: 'ok', syllabuses: [] });
});

app.post('/api/syllabus', async (req, res) => {
  const { schoolId = 'default_school', syllabuses = [] } = req.body || {};
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  try {
    await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: `__studentos_syllabus_${schoolId}__`,
        data: syllabuses,
        updated_at: new Date().toISOString()
      })
    });
    return res.json({ status: 'ok', count: Array.isArray(syllabuses) ? syllabuses.length : 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to persist syllabus.' });
  }
});

app.get('/api/timetables', async (req, res) => {
  const schoolId = String(req.query.schoolId || 'default_school');
  const grade = String(req.query.grade || 'Grade 10');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.__studentos_timetable_${encodeURIComponent(schoolId)}_${encodeURIComponent(grade)}__&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });
    if (r.ok) {
      const rows = await r.json();
      const content = rows[0]?.data ?? (rows[0]?.content ? JSON.parse(rows[0].content) : null);
      if (content && typeof content === 'object') {
        return res.json({ status: 'ok', timetable: content });
      }
    }
  } catch (_) {}

  return res.json({ status: 'ok', timetable: null });
});

app.post('/api/timetables', async (req, res) => {
  const { schoolId = 'default_school', grade = 'Grade 10', timetable } = req.body || {};
  if (!timetable) return res.status(400).json({ error: 'Timetable data is required.' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  try {
    await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: `__studentos_timetable_${schoolId}_${grade}__`,
        data: timetable,
        updated_at: new Date().toISOString()
      })
    });
    return res.json({ status: 'ok', timetable });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to save timetable.' });
  }
});

// Removed shared setup, moved to aiClient.ts

function sanitizeHistory(history: any[] = []): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(history) || history.length === 0) return [];

  const filtered = history.filter(
    h => h && typeof h.content === 'string' && h.content.trim().length > 0
  );
  if (filtered.length === 0) return [];

  const sanitized: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const msg of filtered) {
    const role: 'user' | 'assistant' =
      msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : 'user';

    if (sanitized.length === 0) {
      sanitized.push({ role, content: msg.content.trim() });
    } else {
      const last = sanitized[sanitized.length - 1];
      if (last.role === role) {
        last.content += '\n' + msg.content.trim();
      } else {
        sanitized.push({ role, content: msg.content.trim() });
      }
    }
  }

  return sanitized;
}




// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date(),
    provider: 'multi-provider',
    ministralModel: 'ministral-8b-2410',
    zaiModel: ZAI_MODEL_ID,
    zaiConfigured: Boolean(getZaiApiKey()),
  });
});

// ========================================================================
// WHAT'S NEW SCHEDULED UPDATES ENGINE
// Checks and auto-publishes scheduled releases independently of open browser tabs
// ========================================================================

let globalWss: WebSocketServer | null = null;

async function checkAndPublishScheduledUpdates(): Promise<{ publishedCount: number; errors: any[] }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  let publishedCount = 0;
  const errors: any[] = [];
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/system_updates?status=eq.scheduled&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (res.ok) {
      const scheduledRows = await res.json();
      if (Array.isArray(scheduledRows) && scheduledRows.length > 0) {
        for (const row of scheduledRows) {
          if (row.scheduled_publish_at && new Date(row.scheduled_publish_at).getTime() <= nowMs) {
            console.log(`[WhatsNew Engine] Time threshold reached for "${row.version} - ${row.title}". Publishing now...`);

            // Update to published in database
            const updateRes = await fetch(`${supabaseUrl}/rest/v1/system_updates?id=eq.${encodeURIComponent(row.id)}`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                status: 'published',
                published_at: nowIso,
                updated_at: nowIso
              })
            });

            if (updateRes.ok) {
              publishedCount++;
              row.status = 'published';
              row.published_at = nowIso;

              // 1. Broadcast via WebSocket to all connected clients
              if (globalWss) {
                globalWss.clients.forEach(client => {
                  if (client.readyState === WSWebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'whats_new:published',
                      update: row
                    }));
                  }
                });
              }

              // 2. Dispatch push notification via authoritative dispatchServerWebPush (covers all Supabase + memory devices)
              try {
                await dispatchServerWebPush({
                  notificationId: `whats-new-${row.id}`,
                  title: `🚀 What's New in StudentOS ${row.version}`,
                  body: row.title || 'A new official update has been published.',
                  type: 'announcement',
                  linkTab: 'whats_new',
                  tag: `whats-new-${row.id}`,
                  targetUserId: 'all',
                  targetRole: 'all',
                });
              } catch (_) {}

              // 3. Write audit log
              await fetch(`${supabaseUrl}/rest/v1/system_update_audit_logs`, {
                method: 'POST',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  id: `audit-sched-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  update_id: row.id,
                  action: 'publish',
                  actor_id: 'system_scheduler',
                  actor_name: 'StudentOS Auto-Scheduler Engine',
                  actor_role: 'system',
                  timestamp: nowIso,
                  details: `Auto-published scheduled release ${row.version} at ${nowIso}`
                })
              }).catch(() => {});

              console.log(`[WhatsNew Engine] Successfully auto-published ${row.version}!`);
            } else {
              const errTxt = await updateRes.text();
              errors.push({ id: row.id, error: errTxt });
            }
          }
        }
      }
    }
  } catch (err: any) {
    errors.push({ error: err.message || err });
  }

  return { publishedCount, errors };
}

// Background scheduler interval (runs every 30 seconds)
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    checkAndPublishScheduledUpdates().catch(() => {});
  }, 30000);
}

// API endpoint to manually trigger or check scheduled updates engine
app.get('/api/updates/check-scheduled', async (req, res) => {
  const result = await checkAndPublishScheduledUpdates();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ...result
  });
});

app.get('/api/updates/status', (req, res) => {
  res.json({
    status: 'online',
    engine: 'StudentOS Release Notes Engine v3.12',
    schedulerActive: true,
    intervalMs: 30000,
    serverTime: new Date().toISOString()
  });
});

// ========================================================================
// AI BUDDY ROLLING 24-HOUR USAGE LIMIT SYSTEM
// Role-based limits: Student (30), Teacher (75), Coordinator (100), Admin (150)
// ========================================================================

const pendingQuotaRequests: Array<{ id: string; userId: string; userName: string; userEmail: string; reason: string; timestamp: number }> = [];

async function resolveAiQuotaActor(
  req: express.Request,
  fallbackUserId?: string,
  fallbackRole?: string
): Promise<{ userId: string; role: string }> {
  const actor = await resolveFeatureAndWinterActor(req).catch(() => null);
  const rawBodyUid = String(fallbackUserId || '').trim();
  const isGenericFallback =
    !rawBodyUid || rawBodyUid === 'anonymous' || rawBodyUid === 'guest' || rawBodyUid === 'user_guest';

  const userId = actor?.isVerifiedJwt
    ? actor.id
    : !isGenericFallback
    ? rawBodyUid
    : actor?.id || rawBodyUid || 'anonymous';

  const role = (actor?.isVerifiedJwt ? actor.role : (fallbackRole || actor?.role || 'student')).toLowerCase().trim();
  return { userId, role };
}

// Endpoint to inspect rolling 24-hour limit (persistent across restarts & server instances)
app.get('/api/ai/usage-status', async (req, res) => {
  await handleAiUsageStatus(req, res, { getWinterBonusFn: getUserWinterAiBonusCredits });
});

// Endpoint to redeem voucher codes for quota boost
app.post('/api/ai/redeem-voucher', async (req, res) => {
  await handleAiRedeemVoucher(req, res, { getWinterBonusFn: getUserWinterAiBonusCredits });
});

// Endpoint to request AI boost from school staff (Authenticated users only)
app.post('/api/ai/request-boost', async (req, res) => {
  const actorRes = await resolveVerifiedActor({ headers: req.headers, cfg: getSupabaseServerConfig() });
  if (!actorRes.ok) {
    return res.status(actorRes.status).json({ success: false, error: actorRes.error });
  }
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, error: 'Reason is required' });
  }

  const request = {
    id: 'req_' + Math.random().toString(36).substring(2, 11),
    userId: actorRes.actor.userId,
    userName: actorRes.actor.name || 'Student',
    userEmail: actorRes.actor.email || '',
    reason: String(reason).trim(),
    timestamp: Date.now()
  };

  pendingQuotaRequests.push(request);
  return res.json({
    success: true,
    message: 'Your quota upgrade request has been forwarded to faculty coordinators.'
  });
});

// Endpoint for admins to configure role limits (Verified Admin / Super Admin only)
app.post('/api/admin/ai-limits', async (req, res) => {
  await handleAdminAiLimits(req, res);
});

// Global APK Configuration State (Accessible to all users for download, editable by Super Admin)
let globalApkConfig = {
  apkUrl: process.env.VITE_STUDENTOS_APK_URL || '/studentos-v3.12.apk',
  apkFileName: process.env.VITE_STUDENTOS_APK_FILENAME || 'studentos-v3.12.0.apk',
  apkSize: '24.8 MB',
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Default'
};

// GET /api/config/apk - Public for all users (students, teachers, coordinators) to fetch the authoritative download destination
app.get('/api/config/apk', (req, res) => {
  return res.json({
    success: true,
    ...globalApkConfig
  });
});

// POST /api/config/apk - Restricted: Only Verified Super Admin and Admins can publish new APK download destinations
app.post('/api/config/apk', async (req, res) => {
  const actorRes = await resolveVerifiedActor({ headers: req.headers, cfg: getSupabaseServerConfig() });
  if (!actorRes.ok) {
    return res.status(actorRes.status).json({
      success: false,
      error: actorRes.error
    });
  }
  const { apkUrl, apkFileName, apkSize } = req.body || {};
  const isVerifiedAdmin = actorRes.actor.role === 'super_admin' || actorRes.actor.role === 'admin';
  if (!isVerifiedAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Permission denied. Only Super Admin and Administrators have authority to modify the global APK download destination.'
    });
  }

  if (apkUrl && typeof apkUrl === 'string') {
    globalApkConfig.apkUrl = apkUrl.trim();
  }
  if (apkFileName && typeof apkFileName === 'string') {
    globalApkConfig.apkFileName = apkFileName.trim();
  }
  if (apkSize && typeof apkSize === 'string') {
    globalApkConfig.apkSize = apkSize.trim();
  }
  globalApkConfig.updatedAt = new Date().toISOString();
  globalApkConfig.updatedBy = actorRes.actor.name || 'Super Admin';

  console.log(`[APK CONFIG] Global download destination updated by ${globalApkConfig.updatedBy}: URL="${globalApkConfig.apkUrl}" File="${globalApkConfig.apkFileName}"`);

  return res.json({
    success: true,
    message: 'Global APK destination updated successfully for all users.',
    ...globalApkConfig
  });
});

// Disabled NVIDIA diagnostic route per approved AI provider lock (Ministral, Groq, Z.ai)
app.all(['/api/debug/nvidia', '/api/debug/nvidia/'], (_req, res) => {
  return res.status(410).json({
    success: false,
    error: 'This diagnostic endpoint has been disabled. Veylentra AI routes strictly through Ministral, Groq, and Z.ai.'
  });
});

// Minimal Server Diagnostic Route for AI Routing (Ministral + Groq + Z.ai)
app.all('/api/ai/minimal-test', async (req, res) => {
  const groqKey = getGroqApiKey();
  const ministralKey = getMinistralApiKey();
  const zaiKey = getZaiApiKey();
  const keyPresent = Boolean(groqKey || ministralKey || zaiKey);
  const requestId = 'test_' + Math.random().toString(36).substring(2, 10);

  console.log(`[AI DEBUG] Request ID: ${requestId} | Route: /api/ai/minimal-test | Providers configured: groq=${Boolean(groqKey)}, ministral=${Boolean(ministralKey)}, zai=${Boolean(zaiKey)}`);

  if (!keyPresent) {
    return res.status(500).json({
      success: false,
      requestId,
      error: 'Neither GROQ_API_KEY, MINISTRAL_API_KEY, nor ZAI_API_KEY is configured on the server.',
      keyPresent: false
    });
  }

  try {
    const { text, telemetry } = await generateAICompletionWithTelemetry({
      prompt: 'Reply with exactly: AI TEST OK',
      endpointName: 'MinimalAITest',
      taskType: groqKey ? 'fast' : (ministralKey ? 'general' : undefined),
      modelOverride: !groqKey && !ministralKey && zaiKey ? 'zai' : undefined,
      maxTokens: 200,
      requestId
    });
    return res.json({
      success: true,
      requestId,
      status: 200,
      keyPresent: true,
      modelUsed: telemetry.modelUsed,
      providerUsed: telemetry.providerUsed,
      response: text
    });
  } catch (err: any) {
    console.error(`[AI ERROR] Request ID: ${requestId}`, err);
    return res.status(500).json({
      success: false,
      requestId,
      keyPresent: true,
      error: err.message || 'Minimal test failed'
    });
  }
});

// Server-side diagnostic test route for Ministral / Groq / Z.ai AI connection
app.get('/api/ai/diagnostic', async (req, res) => {
  const groqKey = getGroqApiKey();
  const ministralKey = getMinistralApiKey();
  const zaiKey = getZaiApiKey();
  const keyPresent = Boolean(groqKey || ministralKey || zaiKey);
  const requestId = 'diag_' + Math.random().toString(36).substring(2, 10);

  try {
    const { text, telemetry } = await generateAICompletionWithTelemetry({
      prompt: 'Say hello in 5 words.',
      endpointName: 'DiagnosticTest',
      maxTokens: 500,
      requestId
    });
    return res.json({
      success: true,
      requestId,
      keyPresent,
      groqConfigured: Boolean(groqKey),
      ministralConfigured: Boolean(ministralKey),
      zaiConfigured: Boolean(zaiKey),
      providerUsed: telemetry.providerUsed,
      modelUsed: telemetry.modelUsed,
      response: text
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      requestId,
      keyPresent,
      groqConfigured: Boolean(groqKey),
      ministralConfigured: Boolean(ministralKey),
      zaiConfigured: Boolean(zaiKey),
      error: err.message || 'Diagnostic request failed'
    });
  }
});

// Verified Ready-Made 3D Models Catalog Endpoint
app.get('/api/3d-models/verified', async (req, res) => {
  try {
    const catalog = await getVerified3DModelsCatalog();
    return res.json({ success: true, count: catalog.length, catalog });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Could not fetch verified 3D models.' });
  }
});

// 3D Model & SVG Request Management Endpoints
app.get(['/api/whiteboard/requests', '/api/3d-models/requests'], (req, res) => {
  const { schoolId, requesterId, role } = req.query;
  const isSuperAdmin = role === 'super_admin' || role === 'admin';
  const requests = getAllThreeDRequests({
    schoolId: schoolId ? String(schoolId) : undefined,
    requesterId: requesterId ? String(requesterId) : undefined,
    isSuperAdmin
  });
  return res.json({ success: true, count: requests.length, requests });
});

app.post(['/api/whiteboard/requests', '/api/3d-models/requests', '/api/3d-model-requests'], (req, res) => {
  const {
    topic,
    name,
    title,
    requestType,
    subject,
    description,
    purpose,
    whyNeeded,
    grade,
    classGrade,
    urgency,
    requesterId,
    requesterName,
    requesterRole,
    schoolId,
    schoolName
  } = req.body || {};

  const resolvedTopic = topic || name || title;
  if (!resolvedTopic) {
    return res.status(400).json({ success: false, error: 'Model/SVG topic or name is required.' });
  }

  const isSvg = requestType === 'svg' || requestType === 'SVG / Diagram' || requestType === 'svg_diagram';

  const created = createThreeDRequest({
    requestType: isSvg ? 'svg' : '3d',
    topic: String(resolvedTopic),
    subject: String(subject || 'General Academics'),
    description: String(description || ''),
    purpose: String(whyNeeded || purpose || 'Classroom Whiteboard Instruction'),
    grade: String(classGrade || grade || ''),
    urgency: urgency === 'urgent' ? 'urgent' : 'normal',
    requesterId: String(requesterId || 'usr_' + Math.random().toString(36).substring(2, 9)),
    requesterName: String(requesterName || 'Authenticated User'),
    requesterRole: String(requesterRole || 'Student'),
    schoolId: String(schoolId || 'school_default'),
    schoolName: String(schoolName || 'StudentOS Academy')
  });

  // Asynchronously persist visual request to Supabase
  (async () => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
      await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: `__wb_asset_req_${created.id}__`,
          data: created,
          title: created.topic,
          subject: created.subject,
          updated_at: new Date().toISOString()
        })
      });
    } catch (_) {}
  })();

  return res.json({
    success: true,
    message: `${isSvg ? 'SVG diagram' : '3D model'} request submitted successfully and logged for review.`,
    request: created
  });
});

app.patch(['/api/whiteboard/requests/:id', '/api/3d-models/requests/:id'], (req, res) => {
  const { id } = req.params;
  const { status, notes, completedModelData } = req.body || {};
  const updated = updateThreeDRequestStatus(id, { status, notes, completedModelData });
  if (!updated) {
    return res.status(404).json({ success: false, error: 'Request not found' });
  }

  // Sync update to Supabase
  (async () => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
      await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: `__wb_asset_req_${id}__`,
          data: updated,
          updated_at: new Date().toISOString()
        })
      });
    } catch (_) {}
  })();

  return res.json({ success: true, request: updated });
});

// --- StudentOS Cloud Whiteboard File Management Endpoints ---
interface CloudWhiteboardDocument {
  id: string;
  fileName: string;
  slideCount: number;
  slides: any[];
  userId: string;
  userName: string;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
}

let cloudWhiteboardsMemory: CloudWhiteboardDocument[] = [];

// Helper to hydrate memory from Supabase if needed
async function hydrateWhiteboardsFromSupabase() {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
    const r = await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.__wb_documents_index__&select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (r.ok) {
      const rows = await r.json();
      if (rows?.[0]?.data && Array.isArray(rows[0].data)) {
        rows[0].data.forEach((item: any) => {
          if (!cloudWhiteboardsMemory.some(m => m.id === item.id)) {
            cloudWhiteboardsMemory.push({
              id: item.id,
              fileName: item.fileName || item.title || 'Whiteboard',
              slideCount: item.slideCount || 1,
              slides: [],
              userId: item.userId || 'usr_anonymous',
              userName: item.userName || 'StudentOS User',
              schoolId: item.schoolId || 'school_default',
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: item.updatedAt || new Date().toISOString()
            });
          }
        });
      }
    }
  } catch (_) {}
}

app.get('/api/whiteboard/documents', async (req, res) => {
  if (cloudWhiteboardsMemory.length === 0) {
    await hydrateWhiteboardsFromSupabase();
  }
  const { schoolId, userId, role } = req.query;
  const isSuperAdmin = role === 'super_admin' || role === 'admin';
  let list = cloudWhiteboardsMemory;
  if (!isSuperAdmin) {
    if (schoolId) {
      list = list.filter(d => d.schoolId === String(schoolId) || !d.schoolId);
    }
    if (userId) {
      list = list.filter(d => d.userId === String(userId) || d.schoolId === String(schoolId));
    }
  }
  return res.json({
    success: true,
    count: list.length,
    documents: list.map(d => ({
      id: d.id,
      fileName: d.fileName,
      slideCount: d.slideCount,
      userId: d.userId,
      userName: d.userName,
      schoolId: d.schoolId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }))
  });
});

// Document Annotations Memory & Endpoints
const documentAnnotationsMemory: Record<string, any[]> = {};

app.get('/api/document-annotations', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const key = String(url);
  const annotations = documentAnnotationsMemory[key] || [];
  return res.json({ success: true, annotations });
});

app.post('/api/document-annotations', (req, res) => {
  const { url, annotations } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const key = String(url);
  documentAnnotationsMemory[key] = Array.isArray(annotations) ? annotations : [];
  console.log(`[ANNOTATIONS] Saved ${documentAnnotationsMemory[key].length} strokes for document url: ${key.slice(0, 40)}...`);
  return res.json({ success: true, count: documentAnnotationsMemory[key].length });
});

app.get('/api/whiteboard/documents/:id', async (req, res) => {
  const { id } = req.params;
  let doc = cloudWhiteboardsMemory.find(d => d.id === id);
  if (!doc || !doc.slides || doc.slides.length === 0) {
    // Try to load full document from Supabase
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
      const r = await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.__wb_doc_${encodeURIComponent(id)}__&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      if (r.ok) {
        const rows = await r.json();
        if (rows?.[0]?.data) {
          doc = rows[0].data;
          const idx = cloudWhiteboardsMemory.findIndex(m => m.id === id);
          if (idx >= 0) cloudWhiteboardsMemory[idx] = doc!;
          else cloudWhiteboardsMemory.unshift(doc!);
        }
      }
    } catch (_) {}
  }

  if (!doc) {
    return res.status(404).json({ success: false, error: 'Whiteboard document not found' });
  }
  return res.json({ success: true, document: doc });
});

app.post('/api/whiteboard/documents', async (req, res) => {
  const { id, fileName, slides, slideCount, userId, userName, schoolId } = req.body || {};
  if (!fileName || !slides) {
    return res.status(400).json({ success: false, error: 'Document name and slides are required.' });
  }
  const docId = id || 'wb_doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const existingIdx = cloudWhiteboardsMemory.findIndex(d => d.id === docId);
  const now = new Date().toISOString();
  const newDoc: CloudWhiteboardDocument = {
    id: docId,
    fileName: String(fileName).trim(),
    slideCount: Number(slideCount) || (Array.isArray(slides) ? slides.length : 1),
    slides: slides,
    userId: String(userId || 'usr_anonymous'),
    userName: String(userName || 'StudentOS User'),
    schoolId: String(schoolId || 'school_default'),
    createdAt: existingIdx >= 0 ? cloudWhiteboardsMemory[existingIdx].createdAt : now,
    updatedAt: now
  };
  if (existingIdx >= 0) {
    cloudWhiteboardsMemory[existingIdx] = newDoc;
  } else {
    cloudWhiteboardsMemory.unshift(newDoc);
  }

  // Persist to Supabase
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
    await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: `__wb_doc_${docId}__`,
        data: newDoc,
        title: newDoc.fileName,
        updated_at: now
      })
    });
  } catch (_) {}

  return res.json({ success: true, document: newDoc });
});

app.delete('/api/whiteboard/documents/:id', async (req, res) => {
  const { id } = req.params;
  const idx = cloudWhiteboardsMemory.findIndex(d => d.id === id);
  if (idx >= 0) {
    cloudWhiteboardsMemory.splice(idx, 1);
  }

  // Delete from Supabase
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
    await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.__wb_doc_${encodeURIComponent(id)}__`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
  } catch (_) {}

  return res.json({ success: true, message: 'Document deleted successfully' });
});

// Secure API endpoint for AI Teacher and Buddy conversations (delegates to shared canonical handler)
app.post(['/api/ai/chat', '/api/ai/chat/stream'], async (req, res) => {
  await handleAiChat(req, res, { getWinterBonusFn: getUserWinterAiBonusCredits });
});

// In-memory cache for dynamic AI tutor lessons to ensure instant 0ms retrieval on revisits
const tutorLessonCache = new Map<string, { lesson: any; timestamp: number }>();

// AI Tutor Dynamic Lesson Generator (High Performance & Curriculum Grounded)
app.post('/api/ai/tutor/lesson', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const {
    subject = 'General Science',
    chapterTitle = '',
    chapterNumber = 1,
    topic = '',
    grade = 'Grade 10',
    notesContext = ''
  } = req.body || {};

  if (!topic) {
    return res.status(400).json({ success: false, error: 'Topic is required' });
  }

  const trimmedNotes = String(notesContext || '').trim();
  const cacheKey = `${subject.toLowerCase()}:::${chapterNumber}:::${topic.toLowerCase()}:::${grade.toLowerCase()}`;
  if (!trimmedNotes && tutorLessonCache.has(cacheKey)) {
    const cached = tutorLessonCache.get(cacheKey)!;
    // 24 hour cache validity
    if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
      return res.status(200).json({
        success: true,
        lesson: cached.lesson,
        providerUsed: 'cache',
        modelUsed: 'memory-cache',
        cached: true
      });
    }
  }

  const prompt = `You are Byte, the elite AI educator on StudentOS.
Generate a structured, authentic educational lesson for:
Subject: ${subject}
Chapter: Chapter ${chapterNumber} — ${chapterTitle || topic}
Topic: "${topic}"
Grade Level: ${grade}
Context / Curriculum Notes: ${notesContext || 'Standard national board curriculum'}

RULES:
1. Provide authentic, scientifically, historically, and mathematically accurate content directly relevant to "${topic}".
2. For school curriculum topics, align with verified concepts. For topics beyond the predefined syllabus (e.g., everyday curiosities, space, advanced physics, computing, life skills, general knowledge), explain what is known, acknowledge uncertainty or ongoing discoveries, and do not pretend that every topic belongs to the school's official board exam syllabus.
3. NO generic boilerplate, NO dummy text, NO placeholder phrases.
4. coreExplanation: 2 concise, highly illuminating paragraphs with bold key terms (100-150 words total).
5. workedExample: 1 clear problem and 3 concise steps (20-35 words per step) plus 1 exam tip or real-world application tip.
6. practiceQuestions: 2 diagnostic multiple choice questions with 4 distinct options each, correctIndex (0-3), concise explanation, and 1 hint.

Return strict raw JSON format matching this schema:
{
  "topic": "${topic}",
  "subject": "${subject}",
  "grade": "${grade}",
  "hook": "An intriguing, real-world hook or mystery in 1-2 punchy sentences",
  "prerequisites": "1 short sentence reminding fundamental prerequisite concepts",
  "coreExplanation": "Clear, comprehensive 2-paragraph explanation with bold concepts, intuitive analogies, and clean pedagogical structure.",
  "keyPoints": [
    "Key definition, theorem, or core mechanism 1",
    "Key principle, equation, or relationship 2",
    "Real-world application or rule 3"
  ],
  "workedExample": {
    "problem": "A realistic exam-style practice problem or scenario testing this concept",
    "steps": [
      { "title": "Step 1: Identify Givens & Principle", "detail": "Detailed reasoning..." },
      { "title": "Step 2: Step-by-Step Working", "detail": "Detailed calculation or deduction..." },
      { "title": "Step 3: Verification & Conclusion", "detail": "Final check and unit..." }
    ],
    "examTip": "A crucial mistake students often make in board exams and how to avoid it."
  },
  "practiceQuestions": [
    {
      "id": "q1",
      "question": "Conceptual multiple-choice question testing understanding of this topic",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Clear explanation of why this is correct and why other options fail.",
      "hint": "Gentle guiding hint without giving away the answer directly."
    },
    {
      "id": "q2",
      "question": "Application-based multiple choice question testing practical problem-solving",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 1,
      "explanation": "Clear explanation with calculation or reasoning steps.",
      "hint": "Consider the relationship between the key components."
    }
  ]
}`;

  try {
    const { text, telemetry } = await generateAICompletionWithTelemetry({
      systemInstruction: 'You are Byte, the elite AI educator on StudentOS. Return authentic, curriculum-grounded structured JSON only.',
      prompt,
      temperature: 0.25,
      jsonMode: true,
      maxTokens: 4096,
      taskType: 'general',
      endpointName: 'AITutorLesson'
    });

    let clean = (text || '').trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Clean trailing commas or slice between first { and last }
      const firstB = clean.indexOf('{');
      const lastB = clean.lastIndexOf('}');
      if (firstB !== -1 && lastB > firstB) {
        const slice = clean.slice(firstB, lastB + 1).replace(/,\s*([\]}])/g, '$1');
        parsed = JSON.parse(slice);
      } else {
        throw new Error('Unable to parse JSON from AI response');
      }
    }

    // Support both string and structured { text, analogy } coreExplanation
    const coreExp = parsed?.coreExplanation;
    const hasCore = coreExp && (typeof coreExp === 'string' ? coreExp.trim().length > 0 : Boolean(coreExp.text || coreExp.explanation));
    if (!parsed || !hasCore || !Array.isArray(parsed.practiceQuestions)) {
      throw new Error('AI generated incomplete lesson schema');
    }

    // Cache the valid lesson only if notesContext is empty so personal notes never enter shared cache
    if (!trimmedNotes) {
      tutorLessonCache.set(cacheKey, { lesson: parsed, timestamp: Date.now() });
    }

    return res.status(200).json({
      success: true,
      lesson: parsed,
      providerUsed: telemetry.providerUsed,
      modelUsed: telemetry.modelUsed,
      cached: false
    });
  } catch (err: any) {
    console.error('[AI Tutor Lesson Error]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate dynamic AI lesson.'
    });
  }
});

// Helper to extract clean plain string for speech or single-line fields
function extractSafeString(val: any): string {
  if (typeof val === 'string') return val;
  if (!val) return '';
  if (typeof val === 'object') {
    return val.text || val.speechSummary || val.explanation || val.message || val.content || '';
  }
  return String(val);
}

// AI Tutor Conversational Q&A Endpoint
app.post('/api/ai/tutor/ask', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const {
    subject = '',
    chapterTitle = '',
    chapterNumber = 1,
    topic = '',
    grade = 'Grade 10',
    question = '',
    actionType = 'general', // 'general' | 'simpler' | 'analogy' | 'exam_tip'
    history = []
  } = req.body || {};

  if (!question && !actionType) {
    return res.status(400).json({ success: false, error: 'Question is required' });
  }

  let promptFocus = `The student asked: "${question}"`;
  if (actionType === 'simpler') {
    promptFocus = `Explain "${topic}" in ${subject} so simply and intuitively that a 10-year-old would immediately get it. Use an everyday household metaphor.`;
  } else if (actionType === 'analogy') {
    promptFocus = `Provide a brilliant, vivid real-world analogy for "${topic}" in ${subject}. Compare it to something like sports, cooking, space travel, or gaming.`;
  } else if (actionType === 'exam_tip') {
    promptFocus = `Share the #1 secret exam technique or highest-scoring marking criteria rule for "${topic}" in ${subject} for ${grade}. What separates average answers from perfect scores?`;
  }

  const prompt = `You are Byte, the friendly, super-intelligent AI robot tutor for StudentOS.
Student Details:
- Subject: ${subject}
- Chapter: Chapter ${chapterNumber} · ${chapterTitle || topic}
- Topic: "${topic}" (${grade})

Task:
${promptFocus}

Return strict raw JSON format matching this schema:
{
  "speechSummary": "1-2 short, warm, spoken sentences (no markdown, no symbols) for Byte to say aloud with text-to-speech voice.",
  "fullExplanation": "Detailed, encouraging explanation with clear formatting, bold terms, and steps if needed.",
  "suggestedFollowUps": ["Short follow-up question 1", "Short follow-up question 2"]
}`;

  try {
    const { text, telemetry } = await generateAICompletionWithTelemetry({
      systemInstruction: 'You are Byte, the friendly AI robot tutor on StudentOS. Return warm, concise, educational JSON only.',
      prompt,
      temperature: 0.35,
      jsonMode: true,
      maxTokens: 2048,
      taskType: 'fast',
      endpointName: 'AITutorAsk'
    });

    let clean = (text || '').trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(clean);
    } catch {
      const firstB = clean.indexOf('{');
      const lastB = clean.lastIndexOf('}');
      if (firstB !== -1 && lastB > firstB) {
        try {
          const slice = clean.slice(firstB, lastB + 1).replace(/,\s*([\]}])/g, '$1');
          parsed = JSON.parse(slice);
        } catch (_) {}
      }
    }

    const reply = parsed?.fullExplanation || text;
    const rawSpeech = parsed?.speechSummary || extractSafeString(reply);
    const speechSummary = extractSafeString(rawSpeech)
      .replace(/[#*_`~>[\]()]/g, '')
      .split(/[.?!]/)[0]
      .slice(0, 140) + '.';

    return res.status(200).json({
      success: true,
      reply,
      speechSummary,
      suggestedFollowUps: Array.isArray(parsed?.suggestedFollowUps) ? parsed.suggestedFollowUps : [],
      providerUsed: telemetry.providerUsed,
      modelUsed: telemetry.modelUsed
    });
  } catch (err: any) {
    console.error('[AI Tutor Ask Error]', err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to answer student question.'
    });
  }
});


// Secure API endpoint for Orion Diagram Generator
app.post('/api/ai/diagram', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { query, type = 'diagram' } = req.body || {};
    if (!query) return res.status(400).json({ error: 'Query is required' });
    const elements = await generateCanvasElements(query, type);
    return res.status(200).json({ elements });
  } catch (err: any) {
    console.error('[AI Server] Diagram error. Stack trace:', err.stack || err);
    return res.status(200).json({ elements: [] });
  }
});

// Mermaid AI Diagram Generator Endpoint
app.post('/api/ai/mermaid', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { query } = req.body || {};
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });
    console.log(`[AI Server] POST /api/ai/mermaid received query: "${query}"`);
    const result = await generateMermaidDiagram(query);
    console.log(`[AI Server] POST /api/ai/mermaid completed successfully. Title: "${result?.title}"`);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[AI Server] Mermaid endpoint failure. Stack trace:\n', err.stack || err);
    return res.status(200).json({ success: false, error: 'Failed to generate Mermaid diagram', mermaid: `graph TD\n  Start["${req.body?.query || 'Concept'}"]`, code: `graph TD\n  Start["${req.body?.query || 'Concept'}"]`, title: req.body?.query || 'Diagram' });
  }
});

// Educational SVG Diagram Generator Endpoint (Upgraded with Classroom Vector Visuals & Sanitization)
app.post('/api/ai/svg-diagram', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { query, subject = 'general' } = req.body || {};
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });
    console.log(`[AI Server] POST /api/ai/svg-diagram received query: "${query}" (subject: ${subject})`);
    const result = await generateClassroomSvgVisual(query, subject);
    console.log(`[AI Server] POST /api/ai/svg-diagram completed successfully. Title: "${result?.title}"`);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[AI Server] SVG Diagram endpoint failure. Stack trace:\n', err.stack || err);
    return res.status(200).json({
      success: false,
      error: 'Failed to generate SVG diagram',
      svg: sanitizeEducationalSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#0f172a"/><text x="300" y="200" fill="#ffffff" font-size="20" text-anchor="middle">${String(req.body?.query || 'Diagram').replace(/[<>&]/g, '')}</text></svg>`),
      title: req.body?.query || 'Diagram',
      subject: req.body?.subject || 'general'
    });
  }
});

function repairTruncatedStrokesJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch (_) {}

  const strokesIdx = raw.indexOf('"strokes"');
  if (strokesIdx === -1) return null;
  const arrStart = raw.indexOf('[', strokesIdx);
  if (arrStart === -1) return null;

  const strokes: any[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrStart + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const objStr = raw.substring(objStart, i + 1);
        try {
          const parsedObj = JSON.parse(objStr);
          if (parsedObj && typeof parsedObj === 'object' && parsedObj.type) {
            strokes.push(parsedObj);
          }
        } catch (_) {}
        objStart = -1;
      }
    } else if (ch === ']' && depth === 0) {
      break;
    }
  }

  const titleMatch = raw.match(/"title"\s*:\s*"([^"]+)"/);
  const title = titleMatch ? titleMatch[1] : undefined;

  if (strokes.length > 0) {
    return { title, strokes };
  }
  return null;
}

// Procedural fallbacks removed as per requirements. Every prompt now goes to the AI model.

// Magic Pen / Magic Draw Endpoint (delegates to shared canonical handler)
app.post('/api/ai/magic-draw', async (req, res) => {
  await handleAiMagicDraw(req, res);
});

// Formula Pen Handwriting & Equation Recognition Endpoint (delegates to shared canonical handler)
app.post('/api/ai/handwriting-formula', async (req, res) => {
  await handleAiHandwritingFormula(req, res);
});

// Image to Note OCR & Handwriting Recognition Endpoint (delegates to shared canonical handler)
app.post('/api/ai/image-to-note', async (req, res) => {
  await handleAiImageToNote(req, res);
});

// 3D Educational Object & Selected-Object-to-3D Infographic Generator Endpoint
app.post('/api/ai/whiteboard-3d', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { query, sourceContext } = req.body || {};
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });
    const scene = await generateEducational3DScene(String(query), sourceContext ? String(sourceContext) : undefined);
    if (!scene) {
      return res.status(200).json({
        success: false,
        available: false,
        error: 'This 3D model is not currently in the verified catalog.'
      });
    }
    return res.status(200).json({ success: true, scene });
  } catch (err: any) {
    console.error('[AI Server] Whiteboard 3D error:', err);
    return res.status(500).json({ success: false, error: 'Could not generate 3D educational model.' });
  }
});

// Controlled Server-Side Web Search Endpoint (delegates to shared canonical handler)
app.post('/api/ai/search', async (req, res) => {
  await handleAiSearch(req, res);
});

// Server-Side Text-To-Speech (TTS) Endpoint (Microsoft Edge Neural TTS)
app.post('/api/voice/tts', async (req, res) => {
  const { text, voice = 'nova', speed = 1.0 } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'Text prompt is required for Speech Generation.' });
  }

  try {
    const { audioBuffer, contentType } = await generateVoiceTTS({ text, voice, speed });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(audioBuffer);
  } catch (err: any) {
    console.error('[Voice Server] TTS error:', err?.message || err);
    return res.status(502).json({
      error: 'Voice TTS is temporarily unavailable.',
      details: err?.message || String(err)
    });
  }
});

// Server-Side Speech-To-Text (STT) Endpoint
app.post('/api/voice/stt', async (req, res) => {
  const { audioBase64, mimeType = 'audio/webm' } = req.body || {};
  if (!audioBase64) {
    return res.status(400).json({ error: 'Audio payload (audioBase64) is required.' });
  }

  try {
    const buffer = Buffer.from(audioBase64.replace(/^data:audio\/[a-z]+;base64,/, ''), 'base64');
    const result = await transcribeVoiceSTT(buffer, mimeType);
    if (result.success) {
      return res.json({ success: true, text: result.text });
    }
    return res.status(501).json({ success: false, error: result.error || 'Server-side audio STT is not supported on Ministral/Groq text models.' });
  } catch (err: any) {
    console.error('[Voice Server] STT error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Voice transcription failed.' });
  }
});

// 3D Model Request & Urgent Notification Endpoint
interface Model3DRequestItem {
  id: string;
  requestType: 'normal' | 'urgent';
  subject: string;
  requesterName: string;
  userRole: string;
  schoolId?: string;
  classContext?: string;
  urgencyDeadline?: string;
  educationalPurpose?: string;
  timestamp: number;
  status: 'pending' | 'in_review' | 'fulfilled';
}

const memory3DModelRequests: Model3DRequestItem[] = [];

app.post('/api/3d-model-requests', async (req, res) => {
  const {
    requestType = 'normal',
    subject,
    requesterName = 'Student',
    userRole = 'student',
    schoolId = 'default_school',
    classContext = '',
    urgencyDeadline = '',
    educationalPurpose = ''
  } = req.body || {};

  if (!subject) {
    return res.status(400).json({ error: 'Subject / Topic is required for 3D model request.' });
  }

  const newRequest: Model3DRequestItem = {
    id: 'req3d_' + Math.random().toString(36).substring(2, 10),
    requestType: requestType === 'urgent' ? 'urgent' : 'normal',
    subject: String(subject).slice(0, 100),
    requesterName: String(requesterName).slice(0, 80),
    userRole: String(userRole).slice(0, 30),
    schoolId: String(schoolId).slice(0, 50),
    classContext: String(classContext).slice(0, 100),
    urgencyDeadline: String(urgencyDeadline).slice(0, 50),
    educationalPurpose: String(educationalPurpose).slice(0, 300),
    timestamp: Date.now(),
    status: 'pending'
  };

  memory3DModelRequests.unshift(newRequest);
  if (memory3DModelRequests.length > 100) memory3DModelRequests.pop();

  console.log(`[3D REQUEST SERVER] Stored ${requestType.toUpperCase()} 3D Model Request: "${subject}" by ${requesterName} (${userRole})`);

  // Broadcast WebSocket notification to connected admins
  if (globalWss) {
    const notifyPayload = JSON.stringify({
      type: '3d_model_request:created',
      request: newRequest
    });
    globalWss.clients.forEach(client => {
      if (client.readyState === WSWebSocket.OPEN) {
        client.send(notifyPayload);
      }
    });
  }

  return res.json({
    success: true,
    message: requestType === 'urgent'
      ? `Urgent 3D model request for "${subject}" submitted to StudentOS Curriculum Team.`
      : `3D model request for "${subject}" submitted successfully.`,
    request: newRequest
  });
});

app.get('/api/3d-model-requests', (req, res) => {
  res.json({
    success: true,
    requests: memory3DModelRequests
  });
});

// Lecture Notes AI endpoint (delegates to shared canonical handler)
app.post('/api/ai/notes', async (req, res) => {
  await handleAiNotes(req, res);
});

// Flashcards & Spaced Repetition AI Deck Generator
app.post('/api/ai/flashcards', async (req, res) => {
  const { topic, content, count = 6, difficulty = 'intermediate', subject = 'General' } = req.body;

  if (!topic && !content) {
    return res.status(400).json({ error: 'Topic or content is required to generate flashcards.' });
  }

  const systemInstruction = `You are an elite academic curriculum designer and spaced-repetition cognitive scientist specializing in the SuperMemo SM-2 flashcard method.
Your goal is to extract high-yield, conceptually precise Active Recall flashcards.
Strict Rules for Flashcards:
1. Each card MUST test a single coherent concept, definition, formula, causal relationship, or distinction (Principle of Minimum Information).
2. The Front (Prompt) should be sharp, clear, and challenging (avoid vague open-ended prompts like "Discuss X").
3. The Back (Answer) must be concise, accurate, and structured with bold highlights for key phrases.
4. Provide a helpful Hint for retrieval practice.
5. Provide 1 to 3 relevant Tags.
6. Return strictly valid JSON with no markdown wrapping or backticks. Format:
{
  "deckTitle": "Generated Deck Title",
  "subject": "Subject Name",
  "cards": [
    {
      "front": "Question / Prompt",
      "back": "Answer / Core takeaway",
      "hint": "Brief subtle hint",
      "tags": ["Tag1", "Tag2"]
    }
  ]
}`;

  const prompt = `Generate exactly ${count} high-yield flashcards suitable for ${difficulty} level students.
Subject: ${subject}
Target Topic: ${topic || 'Extracted from provided study content'}
${content ? `Source Study Notes / Text to extract from:\n"""\n${content}\n"""` : ''}

Output ONLY the raw JSON object conforming to the schema.`;

  try {
    const rawText = await generateAICompletion({
      systemInstruction,
      prompt,
      temperature: 0.3,
      jsonMode: true,
      endpointName: 'AIFlashcards'
    });

    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();

    const parsed = JSON.parse(cleaned);
    if (parsed && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
      return res.json({ success: true, ...parsed });
    }
    throw new Error('Parsed output missing cards array');
  } catch (err: any) {
    console.error('[AI Flashcards] API completion error:', err?.message || err);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: err?.message || String(err)
    });
  }
});

// Secure API endpoint for Material Hub AI actions
app.post('/api/ai/material-action', async (req, res) => {
  const { title, description, content, action, userQuestion } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Material Title is required' });
  }

  let systemInstruction = 'You are an elite academic consultant and expert teacher.';
  let userPrompt = `Material Title: "${title}"\nDescription: "${description || 'None'}"\nRaw Content / Context: "${content || 'None'}"\n\n`;

  if (action === 'summarize') {
    systemInstruction = 'You are a professional educational summarizer. Generate a beautiful, concise HTML/Markdown-ready executive summary of this material. Highlight central objectives, key terms in bold, and bulleted takeaways.';
    userPrompt += `Action: Generate an elegant study summary of this material.`;
  } else if (action === 'quiz') {
    systemInstruction = 'You are a test-design expert. Generate 3 high-yield Multiple Choice Questions based on this material. Formulate them cleanly with choices A, B, C, D and provide detailed answers/explanations at the end.';
    userPrompt += `Action: Create a 3-question evaluation quiz complete with explanation scaffolds.`;
  } else if (action === 'explain') {
    systemInstruction = 'You are a brilliant intuitive teacher. Break down this topic to its absolute basics. Use memorable analogies, paint intuitive pictures, and design a step-by-step conceptual walkthrough.';
    userPrompt += `Action: Explain this chapter clearly and deeply with examples.`;
  } else if (action === 'revision') {
    systemInstruction = 'You are a study efficiency expert. Create a modular, highly compact set of revision notes. Organize by key formulas, definitions, fast checklists, and high-frequency active recall memory triggers.';
    userPrompt += `Action: Build a high-yield revision sheet.`;
  } else if (action === 'questions') {
    systemInstruction = 'You are an examiner. Generate 3 highly important theoretical or analytical questions likely to appear in midterm/final school syllabus tests. Include scoring metrics, difficulty tags, and structured model solutions.';
    userPrompt += `Action: Identify critical exam questions.`;
  } else if (action === 'ask') {
    systemInstruction = 'You are a dedicated AI Subject Professor. Answer the student\'s specific question directly, using the provided material content as your immediate educational context.';
    userPrompt += `Student Question: "${userQuestion || 'Explain this material'}"`;
  }

  try {
    const text = await generateAICompletion(systemInstruction, userPrompt);
    return res.json({ success: true, text });
  } catch (apiErr: any) {
    console.error('[AI Server] Material action error:', apiErr?.message || apiErr);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: apiErr?.message || String(apiErr)
    });
  }
});

// Secure API endpoint for AI Question Generator
app.post('/api/ai/question-generator', async (req, res) => {
  const { subject = 'General Science', grade = 'Grade 10', difficulty = 'Medium', questionTypes = ['MCQ', 'Short', 'HOTS'] } = req.body || {};

  const systemInstruction = `You are an expert exam question author for schools and competitive examinations.
Generate high-quality assessment questions for:
- Subject: ${subject}
- Grade: ${grade}
- Difficulty Level: ${difficulty}
- Selected Types: ${Array.isArray(questionTypes) ? questionTypes.join(', ') : questionTypes}

FORMAT REQUIREMENTS:
Generate a comprehensive test paper with clear marking scheme and answer key:
1. Section A: Multiple Choice Questions (MCQs) with options A, B, C, D and explanations.
2. Section B: High Order Thinking Skills (HOTS) & Case Study Questions.
3. Section C: Short Answer Questions (1-Mark & 2-Mark Questions).
4. Section D: Long Answer Questions (5-Mark Questions).
5. Section E: Assertion-Reason & True/False Questions.
6. Complete Answer Key & Marking Rubric at the bottom.

Write in crisp, exam-standard Markdown format.`;

  const userPrompt = `Generate a complete ${subject} question paper for ${grade} (${difficulty} difficulty). Include MCQs, HOTS, 1-Mark, 2-Marks, 5-Marks, Case Study, Assertion Reason, and True/False questions with solutions.`;

  try {
    const text = await generateAICompletion(systemInstruction, userPrompt);
    return res.json({ success: true, text });
  } catch (err: any) {
    console.error('[AI Server] Question generator error:', err?.message || err);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: err?.message || String(err)
    });
  }
});

// Secure API endpoint for AI Homework Checker
app.post('/api/ai/homework-checker', async (req, res) => {
  const { title = 'Homework Submission', submissionText = '', rubric = 'Standard Grading' } = req.body || {};

  const systemInstruction = `You are an AI Homework & Assignment Evaluator.
Analyze the student's submission meticulously for:
1. ✍️ Grammar & Spelling Accuracy
2. 🧩 Logical Flow & Structure
3. 👣 Missing Steps or Incomplete Reasoning
4. 📐 Formatting & Technical Precision
5. 🔍 Similarity & Plagiarism Risk Estimate (%)
6. 🎯 Constructive Suggestions for Improvement
7. 📊 Predicted Score & Grade (e.g., 92/100 - Grade A)

Format the evaluation cleanly in Markdown with actionable feedback for the student and a grading summary for the teacher.`;

  const userPrompt = `Assignment Title: "${title}"\nRubric: "${rubric}"\n\nStudent Submission:\n"""\n${submissionText || 'No text content provided.'}\n"""`;

  try {
    const text = await generateAICompletion(systemInstruction, userPrompt);
    return res.json({ success: true, text });
  } catch (err: any) {
    console.error('[AI Server] Homework checker error:', err?.message || err);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: err?.message || String(err)
    });
  }
});

// Secure API endpoint for AI PDF Assistant
app.post('/api/ai/pdf-assistant', async (req, res) => {
  const { pdfTitle = 'Document', action = 'summary', textSnippet = '', question = '' } = req.body || {};

  let systemInstruction = 'You are an AI Document Assistant. Process the document content thoroughly.';
  let userPrompt = `Document: "${pdfTitle}"\nContext Snippet:\n"""\n${textSnippet}\n"""\n`;

  if (action === 'ask') {
    systemInstruction = 'You are a document Q&A tutor. Answer the student question accurately based on the document text.';
    userPrompt += `Question: "${question}"`;
  } else if (action === 'summary') {
    systemInstruction = 'Generate a high-yield executive summary, key definitions, and main takeaways from this document.';
  } else if (action === 'flashcards') {
    systemInstruction = 'Create 5 active recall flashcards (Question on Front, Answer on Back) based on this document content.';
  } else if (action === 'mcqs') {
    systemInstruction = 'Generate 4 multiple choice questions with answer keys and explanations based on this document.';
  } else if (action === 'explain_paragraph') {
    systemInstruction = 'Break down and explain this paragraph simply with analogies and step-by-step breakdown.';
  } else if (action === 'translate') {
    systemInstruction = 'Translate this text snippet into simple, elegant multi-language study notes (English, Hindi, Spanish summary).';
  } else if (action === 'extract_points') {
    systemInstruction = 'Extract all crucial formulas, key dates, names, definitions, and important exam bullet points from this text.';
  }

  try {
    const text = await generateAICompletion(systemInstruction, userPrompt);
    return res.json({ success: true, text });
  } catch (err: any) {
    console.error('[AI Server] PDF assistant error:', err?.message || err);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: err?.message || String(err)
    });
  }
});

// Secure API endpoint for AI Presentation Assistant
app.post('/api/ai/presentation', async (req, res) => {
  const { title = 'Presentation', slideCount = 5, topic = '' } = req.body || {};

  const systemInstruction = `You are an AI Presentation & Slide Assistant.
For the presentation topic "${title}" (${topic}):
Generate:
1. 🎤 **Speaker Notes** for each slide
2. 📢 **Slide Explanations** & Visual Ideas
3. 🧠 **3-Question Quick Quiz** for audience engagement
4. 🃏 **5 Active Recall Flashcards**
5. 📚 **One-Page Revision Summary**

Format beautifully in Markdown.`;

  const userPrompt = `Generate full presentation companion materials for topic: "${title}" (${slideCount} slides).`;

  try {
    const text = await generateAICompletion(systemInstruction, userPrompt);
    return res.json({ success: true, text });
  } catch (err: any) {
    console.error('[AI Server] Presentation error:', err?.message || err);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: err?.message || String(err)
    });
  }
});

// Authoritative Server-Side Orion Agent Execution Route (Strictly Ephemeral — delegates to shared canonical handler)
app.post('/api/orion/execute', async (req, res) => {
  await handleOrionExecute(req, res, { dispatchPushFn: dispatchServerWebPush });
});

// Role-Scoped Orion Workspace Draft & Academic Assist Endpoint (delegates to shared canonical handler)
app.post('/api/ai/orion-assist', async (req, res) => {
  await handleOrionAssist(req, res, { getWinterBonusFn: getUserWinterAiBonusCredits });
});

// ============================================================
// Workspace Security & Authoritative Lock Endpoints
// ============================================================

// 1. Get current authoritative security status
app.get('/api/security/status', async (req, res) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimit = getRateLimit(clientIp);
    const sec = await fetchAuthoritativeSecurity();
    const isRateLimited = Date.now() < rateLimit.lockedUntil;
    const retryAfterSeconds = isRateLimited ? Math.ceil((rateLimit.lockedUntil - Date.now()) / 1000) : 0;

    return res.json({
      success: true,
      isLocked: sec.is_locked,
      hasPinConfigured: Boolean(sec.pin_hash),
      lockedAt: sec.locked_at,
      lockedBy: sec.locked_by,
      updatedAt: sec.updated_at,
      isRateLimited,
      retryAfterSeconds
    });
  } catch (err: any) {
    console.error('[Security API] status error:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve security status' });
  }
});

// 2. Configure or change PIN (requires authenticated staff/admin actor + current PIN if already configured)
app.post('/api/security/set-pin', async (req, res) => {
  try {
    const actorRes = await resolveVerifiedActor({ headers: req.headers, cfg: getSupabaseServerConfig() });
    if (!actorRes.ok) {
      return res.status(actorRes.status).json({ success: false, error: actorRes.error });
    }
    if (!['teacher', 'hod', 'coordinator', 'admin', 'super_admin'].includes(actorRes.actor.role)) {
      return res.status(403).json({ success: false, error: 'Only authorized staff or administrators can configure the security PIN.' });
    }

    const { pin, currentPin } = req.body || {};
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimit = getRateLimit(clientIp);

    if (Date.now() < rateLimit.lockedUntil) {
      const waitSec = Math.ceil((rateLimit.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Please wait ${waitSec} seconds.`,
        isRateLimited: true,
        retryAfterSeconds: waitSec
      });
    }

    const isNumericPin = typeof pin === 'string' && (pin.length === 4 || pin.length === 6) && /^\d+$/.test(pin);
    const isKeyPass = typeof pin === 'string' && pin.trim().length >= 4 && !pin.trim().startsWith('scrypt$');

    if (!pin || (!isNumericPin && !isKeyPass)) {
      return res.status(400).json({ success: false, error: 'PIN must be 4 or 6 digits or a valid passphrase.' });
    }

    const sec = await fetchAuthoritativeSecurity();

    // If a PIN is already configured, current PIN must verify strictly via salted scrypt + timingSafeEqual
    if (sec.pin_hash) {
      if (!currentPin || typeof currentPin !== 'string') {
        return res.status(400).json({ success: false, error: 'Current PIN is required to change security PIN.' });
      }
      const isMatch = verifyPinHash(currentPin, sec.pin_hash);
      if (!isMatch) {
        const attempt = recordFailedAttempt(clientIp);
        return res.status(401).json({
          success: false,
          error: 'Current PIN is incorrect.',
          attemptsRemaining: attempt.attemptsRemaining,
          isRateLimited: attempt.isRateLimited,
          retryAfterSeconds: attempt.retryAfterSeconds
        });
      }
    }

    resetRateLimit(clientIp);
    const newHash = hashPin(pin);
    const updated = await persistSecurityState({
      pin_hash: newHash,
      locked_by: actorRes.actor.userId
    });

    return res.json({
      success: true,
      message: 'Security PIN configured successfully.',
      hasPinConfigured: true,
      isLocked: updated.is_locked
    });
  } catch (err: any) {
    console.error('[Security API] set-pin error:', err);
    return res.status(502).json({ success: false, error: 'Failed to save security PIN.' });
  }
});

// 3. Lock workspace (authoritative, authenticated actor required)
app.post('/api/security/lock', async (req, res) => {
  try {
    const actorRes = await resolveVerifiedActor({ headers: req.headers, cfg: getSupabaseServerConfig() });
    if (!actorRes.ok) {
      return res.status(actorRes.status).json({ success: false, error: actorRes.error });
    }

    const now = new Date().toISOString();
    const sec = await fetchAuthoritativeSecurity();

    if (!sec.pin_hash) {
      return res.status(400).json({
        success: false,
        error: 'Cannot lock workspace before configuring a Security PIN.'
      });
    }

    const updated = await persistSecurityState({
      is_locked: true,
      locked_at: now,
      locked_by: actorRes.actor.name || actorRes.actor.userId
    });

    return res.json({
      success: true,
      isLocked: true,
      lockedAt: updated.locked_at,
      lockedBy: updated.locked_by
    });
  } catch (err: any) {
    console.error('[Security API] lock error:', err);
    return res.status(502).json({ success: false, error: 'Failed to lock workspace.' });
  }
});

// 4. Unlock workspace with PIN verification
app.post('/api/security/unlock', async (req, res) => {
  try {
    const { pin } = req.body || {};
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimit = getRateLimit(clientIp);

    if (Date.now() < rateLimit.lockedUntil) {
      const waitSec = Math.ceil((rateLimit.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Please wait ${waitSec} seconds.`,
        isRateLimited: true,
        retryAfterSeconds: waitSec
      });
    }

    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ success: false, error: 'PIN is required to unlock workspace.' });
    }

    const sec = await fetchAuthoritativeSecurity();

    if (!sec.pin_hash) {
      const updated = await persistSecurityState({ is_locked: false });
      return res.json({ success: true, isLocked: false, message: 'Workspace unlocked.' });
    }

    const isValid = verifyPinHash(pin, sec.pin_hash);

    if (!isValid) {
      const attempt = recordFailedAttempt(clientIp);
      return res.status(401).json({
        success: false,
        error: 'Incorrect security PIN.',
        attemptsRemaining: attempt.attemptsRemaining,
        isRateLimited: attempt.isRateLimited,
        retryAfterSeconds: attempt.retryAfterSeconds
      });
    }

    resetRateLimit(clientIp);
    const updated = await persistSecurityState({
      is_locked: false,
      locked_at: null,
      locked_by: null
    });

    return res.json({
      success: true,
      isLocked: false,
      message: 'Workspace unlocked successfully.'
    });
  } catch (err: any) {
    console.error('[Security API] unlock error:', err);
    return res.status(500).json({ success: false, error: 'Server error during unlock verification.' });
  }
});

// 5. Verify PIN (for sensitive operations without changing lock state)
app.post('/api/security/verify-pin', async (req, res) => {
  try {
    const { pin } = req.body || {};
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimit = getRateLimit(clientIp);

    if (Date.now() < rateLimit.lockedUntil) {
      const waitSec = Math.ceil((rateLimit.lockedUntil - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Please wait ${waitSec} seconds.`,
        isRateLimited: true,
        retryAfterSeconds: waitSec
      });
    }

    if (!pin || typeof pin !== 'string') {
      return res.status(400).json({ success: false, error: 'PIN is required.' });
    }

    const sec = await fetchAuthoritativeSecurity();

    if (!sec.pin_hash) {
      return res.json({ success: true, verified: true });
    }

    const isValid = verifyPinHash(pin, sec.pin_hash);
    if (!isValid) {
      const attempt = recordFailedAttempt(clientIp);
      return res.status(401).json({
        success: false,
        error: 'Incorrect security PIN.',
        attemptsRemaining: attempt.attemptsRemaining,
        isRateLimited: attempt.isRateLimited,
        retryAfterSeconds: attempt.retryAfterSeconds
      });
    }

    resetRateLimit(clientIp);
    return res.json({ success: true, verified: true });
  } catch (err: any) {
    console.error('[Security API] verify-pin error:', err);
    return res.status(500).json({ success: false, error: 'Failed to verify PIN.' });
  }
});

// ============================================================
// Classroom Panel Board Registration & Classroom Binding APIs
// ============================================================

// 1. Get real classroom metadata (classes, sections, schools from Supabase)
app.get('/api/panel-board/metadata', async (req, res) => {
  try {
    const meta = await getRealClassroomMetadata();
    return res.json({ success: true, ...meta });
  } catch (err: any) {
    console.error('[PanelBoard API] metadata error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load classroom metadata.' });
  }
});

// 2. Lookup existing panel board registration by deviceToken or id
app.get('/api/panel-board/registration', async (req, res) => {
  try {
    const token = (req.query.token as string) || (req.query.id as string) || '';
    if (!token) {
      return res.status(400).json({ success: false, error: 'Device token or panel ID is required.' });
    }

    const registration = await getPanelRegistration(token);
    if (!registration) {
      return res.status(404).json({ success: false, error: 'No active panel registration found.' });
    }

    return res.json({ success: true, registration });
  } catch (err: any) {
    console.error('[PanelBoard API] lookup error:', err);
    return res.status(500).json({ success: false, error: 'Failed to lookup panel registration.' });
  }
});

// 3. Register a new classroom panel board
app.post('/api/panel-board/register', async (req, res) => {
  try {
    const { school_id, class_id, section_id, display_name, registered_by, device_metadata } = req.body || {};

    if (!class_id || !section_id) {
      return res.status(400).json({ success: false, error: 'Class and section are required.' });
    }

    const registration = await registerClassroomPanel({
      school_id: school_id || 'default_school',
      class_id,
      section_id,
      display_name,
      registered_by: registered_by || 'system',
      device_metadata
    });

    return res.json({ success: true, registration, token: registration.device_token });
  } catch (err: any) {
    console.error('[PanelBoard API] register error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to register classroom panel.' });
  }
});

// 4. Reassign panel board to another class / section
app.post('/api/panel-board/reassign', async (req, res) => {
  try {
    const { token, id, class_id, section_id, display_name, updated_by } = req.body || {};
    const idOrToken = token || id;

    if (!idOrToken) {
      return res.status(400).json({ success: false, error: 'Panel registration token or ID is required.' });
    }

    const updated = await reassignClassroomPanel({
      idOrToken,
      class_id,
      section_id,
      display_name,
      updated_by: updated_by || 'staff'
    });

    return res.json({ success: true, registration: updated });
  } catch (err: any) {
    console.error('[PanelBoard API] reassign error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to reassign panel.' });
  }
});

// 5. Revoke panel board registration
app.post('/api/panel-board/revoke', async (req, res) => {
  try {
    const { token, id } = req.body || {};
    const idOrToken = token || id;

    if (!idOrToken) {
      return res.status(400).json({ success: false, error: 'Panel registration token or ID is required.' });
    }

    const ok = await revokeClassroomPanel(idOrToken);
    return res.json({ success: ok });
  } catch (err: any) {
    console.error('[PanelBoard API] revoke error:', err);
    return res.status(500).json({ success: false, error: 'Failed to revoke panel registration.' });
  }
});

// ============================================================
// Account Authentication & Password Recovery Endpoints
// ============================================================
app.post('/api/auth/login', async (req, res) => {
  await handleAuthLogin(req, res);
});

app.post('/api/auth/demo-session', async (req, res) => {
  await handleAuthDemoSession(req, res);
});

app.get('/api/health', async (req, res) => {
  await handleHealth(req, res);
});

// ============================================================
// Database Setup Endpoint — returns the setup SQL file content
// Restricted strictly to authenticated Administrators / Super Admins
// ============================================================
app.get('/api/admin/setup-sql', async (req, res) => {
  const actorRes = await resolveVerifiedActor({ headers: req.headers, cfg: getSupabaseServerConfig() });
  if (!actorRes.ok) {
    return res.status(actorRes.status).json({ error: actorRes.error });
  }
  if (!['admin', 'super_admin'].includes(actorRes.actor.role)) {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }

  try {
    const sqlPath = path.join(process.cwd(), 'supabase', 'setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    res.type('text/plain').send(sql);
  } catch (err: any) {
    res.status(502).json({ error: 'Could not read setup SQL.' });
  }
});

// ============================================================
// Auth Callback Endpoint for popup-based Google OAuth flow
// ============================================================
app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Completing Authentication</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #020617;
            color: #f8fafc;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .box {
            text-align: center;
            padding: 2rem;
            border-radius: 12px;
            background-color: #0f172a;
            border: 1px solid #1e293b;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            max-width: 400px;
          }
          h1 { font-size: 1.5rem; margin-top: 0; margin-bottom: 0.5rem; color: #38bdf8; }
          p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>StudentOS Authenticating</h1>
          <p>Writing session credentials... This window will close automatically.</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'SUPABASE_AUTH_SUCCESS',
              hash: window.location.hash,
              search: window.location.search
            }, '*');
            setTimeout(() => {
              window.close();
            }, 1000);
          } else {
            window.location.href = '/';
          }
        </script>
      </body>
    </html>
  `);
});

let globalChatsState: any[] = [];
let globalAnnouncementsState: any[] = [];
let globalHomeworkState: any[] = [];

// Configure Vite middleware in development or static serving in production
// ========================================================================
// AUTHENTICATION & PASSWORD RESET API (GMAIL SMTP POWERED)
// ========================================================================
const getGmailTransporter = () => {
  const user = (process.env.GMAIL_USER || 'visualstudystudio@gmail.com').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').trim();
  if (!pass) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user,
      pass
    }
  });
};

const getSupabaseAdmin = () => {
  const url = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

const getResetSecret = (): string => {
  return (
    process.env.RESET_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    'studentos-fallback-crypto-reset-secret-key-2026'
  ).trim();
};

interface ResetTokenPayload {
  email: string;
  expiresAt: number;
}

function createSignedResetToken(email: string, expiryMs = 3600000): string {
  const secret = getResetSecret();
  const payload: ResetTokenPayload = {
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + expiryMs
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

function verifySignedResetToken(tokenString: string): { valid: boolean; email?: string; error?: string } {
  if (!tokenString || typeof tokenString !== 'string' || !tokenString.includes('.')) {
    return { valid: false, error: 'This reset link is invalid or malformed.' };
  }

  const parts = tokenString.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'This reset link is invalid or malformed.' };
  }

  const [payloadBase64, providedSignature] = parts;
  const secret = getResetSecret();

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSignature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return { valid: false, error: 'This reset link signature is invalid or has been tampered with.' };
  }

  try {
    const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
    const payload: ResetTokenPayload = JSON.parse(payloadJson);

    if (!payload || !payload.email || typeof payload.expiresAt !== 'number') {
      return { valid: false, error: 'Invalid reset token payload structure.' };
    }

    if (payload.expiresAt < Date.now()) {
      return { valid: false, error: 'This reset link has expired. Please request a new one.' };
    }

    return { valid: true, email: payload.email.trim().toLowerCase() };
  } catch {
    return { valid: false, error: 'Failed to decode reset link.' };
  }
}

// 1. Password Reset Request Route: email in, creates HMAC-signed token, sends link via Gmail SMTP
async function handlePasswordResetRequest(req: express.Request, res: express.Response) {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid school email is required.' });
  }

  const normEmail = email.trim().toLowerCase();

  const transporter = getGmailTransporter();
  if (!transporter) {
    return res.status(500).json({
      success: false,
      error: 'Gmail SMTP is not configured on the server. GMAIL_APP_PASSWORD environment variable is missing.'
    });
  }

  try {
    // 1. Create stateless signed reset token (contains email + 1-hour expiry signed with server secret)
    const token = createSignedResetToken(normEmail, 3600000);

    // 2. Send reset link via Gmail SMTP
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}` || 'http://localhost:3000';
    const resetLink = `${origin}?reset_token=${token}`;
    const gmailUser = (process.env.GMAIL_USER || 'visualstudystudio@gmail.com').trim();

    await transporter.sendMail({
      from: gmailUser,
      to: normEmail,
      subject: 'Reset your StudentOS account password',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0; font-size: 20px;">StudentOS Password Reset</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block; font-size: 14px;">Reset Password</a>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This single-use link will expire in 60 minutes. If you did not request this reset, you can safely disregard this email.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-bottom: 0;">StudentOS Institutional Security · Authorized Campus Access Only</p>
        </div>
      `
    });

    return res.json({
      success: true,
      status: 'ok',
      message: 'Check your email for the reset link.'
    });
  } catch (err: any) {
    console.error('[Auth Reset Request Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal security server error during reset dispatch.'
    });
  }
}

// 2. Password Reset Confirm Route: verifies HMAC token & expiry, updates password without Supabase token storage
async function handlePasswordResetConfirm(req: express.Request, res: express.Response) {
  const { token, resetToken, password, newPassword } = req.body || {};
  const activeToken = token || resetToken;
  const activePassword = password || newPassword;

  if (!activeToken || !activePassword || String(activePassword).length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Valid token and new password (min 6 characters) are required.'
    });
  }

  try {
    // 1. Verify HMAC token signature & expiry without calling Supabase for token lookups
    const verification = verifySignedResetToken(String(activeToken).trim());
    if (!verification.valid || !verification.email) {
      return res.status(400).json({
        success: false,
        error: verification.error || 'This reset link is invalid or has expired.'
      });
    }

    const cleanPassword = String(activePassword).trim();
    const newHash = hashPin(cleanPassword);
    const normEmail = verification.email;

    // 2. Resolve Supabase config dynamically from env
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();

    if (!supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase key is invalid'
      });
    }

    const profileResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?email=eq.${encodeURIComponent(normEmail)}&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });

    const errText = await profileResp.text().catch(() => '');

    if (
      profileResp.status === 401 ||
      profileResp.status === 403 ||
      errText.toLowerCase().includes('invalid api key') ||
      errText.toLowerCase().includes('invalid_api_key') ||
      errText.toLowerCase().includes('jwt')
    ) {
      return res.status(500).json({
        success: false,
        error: 'Supabase key is invalid'
      });
    }

    if (!profileResp.ok) {
      return res.status(500).json({
        success: false,
        error: `Failed to fetch user profile from Supabase: ${errText || profileResp.statusText}`
      });
    }

    let pRows: any[] = [];
    try {
      pRows = JSON.parse(errText);
    } catch {
      return res.status(500).json({
        success: false,
        error: 'Failed to parse user profile response from Supabase'
      });
    }

    if (!Array.isArray(pRows) || pRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No user profile found in database matching email ${normEmail}`
      });
    }

    const userProfileRow = pRows[0];
    const rawData = userProfileRow.raw_data || {};
    rawData.password_hash = newHash;
    rawData.pin_hash = newHash;
    rawData.legacy_sha256 = crypto.createHash('sha256').update(cleanPassword).digest('hex');

    const patchResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?email=eq.${encodeURIComponent(normEmail)}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ raw_data: rawData, updated_at: Date.now() })
    });

    const patchErrText = await patchResp.text().catch(() => '');

    if (
      patchResp.status === 401 ||
      patchResp.status === 403 ||
      patchErrText.toLowerCase().includes('invalid api key') ||
      patchErrText.toLowerCase().includes('invalid_api_key') ||
      patchErrText.toLowerCase().includes('jwt')
    ) {
      return res.status(500).json({
        success: false,
        error: 'Supabase key is invalid'
      });
    }

    if (!patchResp.ok) {
      return res.status(500).json({
        success: false,
        error: `Failed to update password in Supabase: ${patchErrText || patchResp.statusText}`
      });
    }

    // 3. Verify the updated password hash in Supabase before returning success
    const verifyResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?email=eq.${encodeURIComponent(normEmail)}&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });

    if (!verifyResp.ok) {
      return res.status(500).json({
        success: false,
        error: 'Failed to verify updated user profile in Supabase.'
      });
    }

    const vRows = await verifyResp.json().catch(() => []);
    const verifyProfile = Array.isArray(vRows) && vRows.length > 0 ? vRows[0] : null;
    const savedHash = verifyProfile?.raw_data?.password_hash || verifyProfile?.raw_data?.pin_hash;

    if (savedHash !== newHash) {
      return res.status(500).json({
        success: false,
        error: 'Password update verification failed in Supabase.'
      });
    }

    console.log(`[Auth Reset] Successfully updated password and verified in Supabase for user: ${normEmail}`);

    // NEVER return password_hash in response
    return res.json({
      success: true,
      status: 'ok',
      message: 'Your password has been updated. Please sign in with your new credentials.'
    });
  } catch (err: any) {
    console.error('[Reset Confirmation Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'An error occurred while updating your password.'
    });
  }
}

// Request route: handles POST /api/auth/forgot-password
app.post('/api/auth/forgot-password', handlePasswordResetRequest);

// Confirm route: handles POST /api/auth/reset-password (and delegates to request if called with { email } only)
app.post('/api/auth/reset-password', async (req, res) => {
  if (req.body && req.body.email && !req.body.token && !req.body.resetToken) {
    return handlePasswordResetRequest(req, res);
  }
  return handlePasswordResetConfirm(req, res);
});

// ========================================================================
// PARENT PORTAL: SECURE CHILD ACCOUNT LINKING WITH EMAIL OTP
// ========================================================================
interface ChildLinkVerificationRecord {
  parentUid: string;
  parentEmail: string;
  childEmail: string;
  childUid: string;
  childName: string;
  otpHash: string;
  attempts: number;
  expiresAt: number;
  requestedAt: number;
}

const childLinkVerifications = new Map<string, ChildLinkVerificationRecord>();
const parentOtpRateLimits = new Map<string, { count: number; windowStart: number }>();

// 1. Request OTP route: sends 6-digit OTP to the CHILD'S registered email
app.post('/api/parent/request-child-link-otp', async (req, res) => {
  const { parentUid, parentEmail, childEmail } = req.body || {};

  if (!parentUid || !parentEmail || !childEmail || typeof childEmail !== 'string' || !childEmail.includes('@')) {
    return res.status(400).json({
      success: false,
      error: 'Valid parent account and child school email are required.'
    });
  }

  const normParentEmail = String(parentEmail).trim().toLowerCase();
  const normChildEmail = String(childEmail).trim().toLowerCase();

  if (normParentEmail === normChildEmail) {
    return res.status(400).json({
      success: false,
      error: 'Parent account cannot link its own email address.'
    });
  }

  // Rate Limiting: Max 4 requests per 10 minutes per parent
  const now = Date.now();
  const rateKey = `${parentUid}_${normChildEmail}`;
  const rateData = parentOtpRateLimits.get(rateKey);
  if (rateData && now - rateData.windowStart < 600000) {
    if (rateData.count >= 4) {
      return res.status(429).json({
        success: false,
        error: 'Too many verification attempts. Please wait 10 minutes before requesting a new code.'
      });
    }
    rateData.count++;
  } else {
    parentOtpRateLimits.set(rateKey, { count: 1, windowStart: now });
  }

  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
    if (!supabaseKey) {
      return res.status(500).json({ success: false, error: 'Database service is temporarily unavailable.' });
    }

    // Query user_profiles to verify that child exists and is a student
    const profileResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?email=eq.${encodeURIComponent(normChildEmail)}&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });

    if (!profileResp.ok) {
      return res.status(500).json({ success: false, error: 'Unable to query student directory.' });
    }

    const profiles = await profileResp.json().catch(() => []);
    const student = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

    if (!student || (student.role !== 'student' && student.requested_role !== 'student')) {
      return res.status(404).json({
        success: false,
        error: 'No active student account found for that school email address.'
      });
    }

    // Generate cryptographically secure 6-digit OTP
    const rawOtp = String(crypto.randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(rawOtp + normChildEmail).digest('hex');

    const record: ChildLinkVerificationRecord = {
      parentUid: String(parentUid).trim(),
      parentEmail: normParentEmail,
      childEmail: normChildEmail,
      childUid: student.uid || student.id,
      childName: student.name || 'Student',
      otpHash,
      attempts: 0,
      expiresAt: now + 600000, // 10 minutes expiry
      requestedAt: now
    };

    const verifKey = `${parentUid}_${normChildEmail}`;
    childLinkVerifications.set(verifKey, record);

    // 2. Dispatch 6-digit OTP email via Gmail SMTP
    const transporter = getGmailTransporter();
    if (!transporter) {
      return res.status(500).json({
        success: false,
        error: 'Gmail SMTP is not configured on the server. GMAIL_APP_PASSWORD environment variable is missing.'
      });
    }

    const gmailUser = (process.env.GMAIL_USER || 'visualstudystudio@gmail.com').trim();
    const mailInfo = await transporter.sendMail({
      from: gmailUser,
      to: normChildEmail,
      subject: 'StudentOS / Veylentra — Child Account Verification Code',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px;">
            <h2 style="color: #4f46e5; margin: 0; font-size: 20px; font-weight: 800;">StudentOS Academic Portal</h2>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 12px;">Parent & Guardian Account Link Verification</p>
          </div>
          <p style="color: #1e293b; font-size: 14px; line-height: 1.6;">
            Hello <strong>${student.name || 'Student'}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            A parent or guardian account (<strong>${normParentEmail}</strong>) has requested to link your student account to their Parental Portal.
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            To verify this request and authorize parental access to your academic attendance and homework, enter or share this 6-digit verification code with your parent:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <span style="display: inline-block; background-color: #f1f5f9; border: 2px dashed #4f46e5; border-radius: 10px; padding: 16px 36px; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; font-family: monospace;">
              ${rawOtp}
            </span>
          </div>
          <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
            This single-use code will expire in <strong>10 minutes</strong>. If you did not recognize this parent email address, do not share this code.
          </p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-bottom: 0;">
            StudentOS Institutional Security · Authorized Campus Access Only
          </p>
        </div>
      `
    });

    console.log(`[Parent Link] Gmail SMTP dispatched OTP to student email: ${normChildEmail} (Message ID: ${mailInfo?.messageId})`);

    return res.json({
      success: true,
      status: 'ok',
      message: `A 6-digit verification code was sent to ${normChildEmail} via Gmail SMTP.`,
      expiresInMinutes: 10
    });
  } catch (err: any) {
    console.error('[Parent OTP Request Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to dispatch verification code.'
    });
  }
});

// 2. Verify OTP route: checks code hash, verifies relationship and creates link
app.post('/api/parent/verify-child-link-otp', async (req, res) => {
  const { parentUid, parentEmail, childEmail, otp } = req.body || {};

  if (!parentUid || !childEmail || !otp) {
    return res.status(400).json({
      success: false,
      error: 'Parent UID, child email, and 6-digit verification code are required.'
    });
  }

  const normParentEmail = String(parentEmail || '').trim().toLowerCase();
  const normChildEmail = String(childEmail).trim().toLowerCase();
  const cleanOtp = String(otp).trim();
  const verifKey = `${parentUid}_${normChildEmail}`;

  const record = childLinkVerifications.get(verifKey);
  if (!record) {
    return res.status(400).json({
      success: false,
      error: 'No active verification code found for this child email. Please request a new code.'
    });
  }

  if (Date.now() > record.expiresAt) {
    childLinkVerifications.delete(verifKey);
    return res.status(400).json({
      success: false,
      error: 'Verification code has expired. Please request a new code.'
    });
  }

  record.attempts++;
  if (record.attempts > 5) {
    childLinkVerifications.delete(verifKey);
    return res.status(429).json({
      success: false,
      error: 'Too many incorrect attempts. For security, please request a new verification code.'
    });
  }

  // Verify SHA-256 hash
  const computedHash = crypto.createHash('sha256').update(cleanOtp + normChildEmail).digest('hex');
  if (computedHash !== record.otpHash) {
    return res.status(400).json({
      success: false,
      error: `Invalid verification code. (${5 - record.attempts} attempts remaining)`
    });
  }

  // Code verified! Delete OTP record immediately (single-use)
  childLinkVerifications.delete(verifKey);

  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
    if (!supabaseKey) {
      return res.status(500).json({ success: false, error: 'Database service is temporarily unavailable.' });
    }

    // Fetch complete student profile
    const studentResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?email=eq.${encodeURIComponent(normChildEmail)}&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });

    const students = await studentResp.json().catch(() => []);
    const student = Array.isArray(students) && students.length > 0 ? students[0] : null;

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student record could not be found.' });
    }

    const studentUid = student.uid || student.id;

    // 1. Try to persist link in parent_child_links table in Supabase
    try {
      await fetch(`${supabaseUrl}/rest/v1/parent_child_links`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          parent_uid: parentUid,
          parent_email: normParentEmail,
          student_uid: studentUid,
          student_email: normChildEmail,
          verified_at: new Date().toISOString()
        })
      });
    } catch (_) {}

    // 2. Also persist in parent's user_profile raw_data.linked_children
    try {
      const parentResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?uid=eq.${encodeURIComponent(parentUid)}&select=*`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      const pRows = await parentResp.json().catch(() => []);
      const parentProf = Array.isArray(pRows) && pRows.length > 0 ? pRows[0] : null;

      if (parentProf) {
        const rawData = parentProf.raw_data || {};
        const existingLinks = Array.isArray(rawData.linked_children) ? rawData.linked_children : [];
        if (!existingLinks.some((l: any) => l.student_uid === studentUid || l.student_email === normChildEmail)) {
          const updatedLinks = [
            ...existingLinks,
            {
              student_uid: studentUid,
              student_email: normChildEmail,
              student_name: student.name,
              verified_at: new Date().toISOString()
            }
          ];
          await fetch(`${supabaseUrl}/rest/v1/user_profiles?uid=eq.${encodeURIComponent(parentUid)}`, {
            method: 'PATCH',
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              raw_data: { ...rawData, linked_children: updatedLinks }
            })
          });
        }
      }
    } catch (_) {}

    return res.json({
      success: true,
      message: `Verified and linked ${student.name} to your Parental Portal.`,
      student: {
        uid: studentUid,
        name: student.name,
        email: student.email,
        role: 'student',
        grade: student.grade || 'Grade 10',
        section: student.section || 'Solara',
        house: student.house || 'Emerald',
        studyHours: student.study_hours || 0,
        quizzesTaken: student.quizzes_taken || 0,
        streakDays: student.streak_days || 0,
        accountStatus: 'approved'
      }
    });
  } catch (err: any) {
    console.error('[Verify OTP Link Error]:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Verification succeeded but failed to persist student link.'
    });
  }
});

// 3. Query linked children for a parent
app.get('/api/parent/linked-children', async (req, res) => {
  const parentUid = String(req.query.parentUid || '').trim();
  if (!parentUid) {
    return res.status(400).json({ success: false, error: 'parentUid is required.' });
  }

  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
    if (!supabaseKey) {
      return res.status(500).json({ success: false, error: 'Database service is unavailable.' });
    }

    let studentUids: string[] = [];

    // Query parent_child_links table
    try {
      const linkResp = await fetch(`${supabaseUrl}/rest/v1/parent_child_links?parent_uid=eq.${encodeURIComponent(parentUid)}&select=student_uid,student_email`, {
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
      if (linkResp.ok) {
        const linkRows = await linkResp.json().catch(() => []);
        if (Array.isArray(linkRows)) {
          studentUids = linkRows.map((r: any) => r.student_uid).filter(Boolean);
        }
      }
    } catch (_) {}

    // Fallback: Check parent profile raw_data.linked_children
    if (studentUids.length === 0) {
      try {
        const parentResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?uid=eq.${encodeURIComponent(parentUid)}&select=raw_data`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (parentResp.ok) {
          const pRows = await parentResp.json().catch(() => []);
          const raw = pRows?.[0]?.raw_data;
          if (raw && Array.isArray(raw.linked_children)) {
            studentUids = raw.linked_children.map((c: any) => c.student_uid).filter(Boolean);
          }
        }
      } catch (_) {}
    }

    if (studentUids.length === 0) {
      return res.json({ success: true, children: [] });
    }

    // Fetch full profiles for each student UID
    const profileResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?uid=in.(${studentUids.map(u => encodeURIComponent(u)).join(',')})&select=*`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });

    const students = await profileResp.json().catch(() => []);
    const mapped = (Array.isArray(students) ? students : []).map((s: any) => ({
      uid: s.uid || s.id,
      name: s.name,
      email: s.email,
      role: 'student',
      grade: s.grade || 'Grade 10',
      section: s.section || 'Solara',
      house: s.house || 'Emerald',
      studyHours: s.study_hours || 0,
      quizzesTaken: s.quizzes_taken || 0,
      streakDays: s.streak_days || 0,
      accountStatus: 'approved'
    }));

    return res.json({ success: true, children: mapped });
  } catch (err: any) {
    console.error('[Get Linked Children Error]:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to fetch linked children.' });
  }
});

// Super Admin: List all parent-child links across the campus
app.get('/api/admin/all-parent-child-links', async (req, res) => {
  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
    if (!supabaseKey) {
      return res.status(500).json({ success: false, error: 'Database service is unavailable.' });
    }

    const resp = await fetch(`${supabaseUrl}/rest/v1/parent_child_links?select=*&order=created_at.desc`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });

    if (!resp.ok) {
      return res.json({ success: true, links: [] });
    }

    const links = await resp.json().catch(() => []);
    return res.json({ success: true, links: Array.isArray(links) ? links : [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Super Admin: Unlink parent from child
app.post('/api/admin/unlink-parent-child', async (req, res) => {
  const { parentUid, studentUid, parentEmail, studentEmail } = req.body || {};
  if (!parentUid && !parentEmail) {
    return res.status(400).json({ success: false, error: 'Parent identification required.' });
  }

  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseServerConfig();
    if (!supabaseKey) {
      return res.status(500).json({ success: false, error: 'Database service is unavailable.' });
    }

    // 1. Delete from parent_child_links
    let queryParam = '';
    if (parentUid && studentUid) {
      queryParam = `parent_uid=eq.${encodeURIComponent(parentUid)}&student_uid=eq.${encodeURIComponent(studentUid)}`;
    } else if (parentEmail && studentEmail) {
      queryParam = `parent_email=eq.${encodeURIComponent(parentEmail)}&student_email=eq.${encodeURIComponent(studentEmail)}`;
    } else if (parentUid) {
      queryParam = `parent_uid=eq.${encodeURIComponent(parentUid)}`;
    }

    if (queryParam) {
      await fetch(`${supabaseUrl}/rest/v1/parent_child_links?${queryParam}`, {
        method: 'DELETE',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      });
    }

    // 2. Remove from parent user_profiles.raw_data.linked_children
    if (parentUid) {
      try {
        const pResp = await fetch(`${supabaseUrl}/rest/v1/user_profiles?uid=eq.${encodeURIComponent(parentUid)}&select=*`, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
        });
        if (pResp.ok) {
          const pData = await pResp.json().catch(() => []);
          const prof = pData?.[0];
          if (prof && prof.raw_data) {
            const raw = prof.raw_data;
            if (Array.isArray(raw.linked_children)) {
              raw.linked_children = raw.linked_children.filter(
                (c: any) => c.student_uid !== studentUid && c.student_email !== studentEmail
              );
              await fetch(`${supabaseUrl}/rest/v1/user_profiles?uid=eq.${encodeURIComponent(parentUid)}`, {
                method: 'PATCH',
                headers: {
                  apikey: supabaseKey,
                  Authorization: `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ raw_data: raw })
              });
            }
          }
        }
      } catch (_) {}
    }

    return res.json({ success: true, message: 'Parent and child successfully unlinked.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to unlink parent and child.' });
  }
});


// Register Connected Academic Workflows Routes (Assignments, Submissions, Assessments, Attendance Audit, Targeted Announcements)
registerAcademicWorkflowRoutes(app, {
  getSupabaseServerConfig,
  getVerifiedUserFromRequest,
  emitScopedBroadcast: broadcastScopedWsEvent,
  dispatchWebPush: dispatchServerWebPush,
  onActivityRecorded: async (userId, role, activityType, count) => {
    try {
      const cfg = getSupabaseServerConfig();
      await recordEngagementActivityServer(cfg.url, cfg.key || '', userId, role, activityType as any, count);
    } catch (err) {
      console.warn('[server-academic-sync] onActivityRecorded failed:', err);
    }
  },
});

async function resolveFeatureAndWinterActor(req: express.Request): Promise<{
  id: string;
  name: string;
  email?: string;
  role: string;
  grade?: string;
  section?: string;
  isVerifiedJwt: boolean;
  authToken?: string;
} | null> {
  const actorRes = await resolveVerifiedActor({
    headers: req.headers,
    cfg: getSupabaseServerConfig(),
  });
  if (!actorRes.ok) {
    return null;
  }
  const actor = actorRes.actor;
  return {
    id: actor.userId,
    name: actor.name,
    email: actor.email,
    role: actor.role,
    grade: actor.grade,
    section: actor.section,
    isVerifiedJwt: actor.sessionType === 'supabase_jwt' || actor.sessionType === 'signed_session',
    authToken: actor.authToken,
  };
}

const featureController = registerFeatureManagementRoutes(app, {
  getSupabaseServerConfig: () => {
    const cfg = getSupabaseServerConfig();
    return { url: cfg.url, key: cfg.key || '' };
  },
  getVerifiedUserFromRequest: resolveFeatureAndWinterActor,
  broadcastToAllWs,
});

registerWinterFestivalAndLeaderboardRoutes(app, {
  getSupabaseServerConfig: () => {
    const cfg = getSupabaseServerConfig();
    return { url: cfg.url, key: cfg.key || '' };
  },
  getVerifiedUserFromRequest: resolveFeatureAndWinterActor,
  requireFeatureAccess: featureController.requireFeatureAccess,
  broadcastToAllWs,
  getGamificationStore: () => memoryGamificationStore,
});

registerNotificationRoutes(app, {
  getSupabaseServerConfig: () => {
    const cfg = getSupabaseServerConfig();
    return { url: cfg.url, key: cfg.key || '' };
  },
  getVerifiedUserFromRequest: resolveFeatureAndWinterActor,
  broadcastToAllWs,
  dispatchWebPush: dispatchServerWebPush,
});

registerEngagementSystemRoutes(app, {
  getSupabaseServerConfig: () => {
    const cfg = getSupabaseServerConfig();
    return { url: cfg.url, key: cfg.key || '' };
  },
  getVerifiedUserFromRequest: resolveFeatureAndWinterActor,
  broadcastToAllWs,
  getGamificationStore: () => memoryGamificationStore,
});

// Express JSON error middleware to prevent raw HTML 500s on malformed JSON or unhandled API errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      status: 'error',
      error: 'Invalid JSON request payload.',
      finalResponse: 'Invalid JSON request payload.',
    });
  }
  const rawStatus = Number(err?.status || err?.statusCode || 502);
  const safeStatus = rawStatus === 500 || !Number.isFinite(rawStatus) ? 502 : rawStatus;
  const reason = String(err?.message || 'Upstream server error.').trim();
  return res.status(safeStatus).json({
    success: false,
    status: safeStatus === 401 ? 'unauthorized' : 'failed',
    error: reason,
    finalResponse: reason,
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudentOS Back-end Server running on port ${PORT}`);
  });

  const wss = new WebSocketServer({ server, maxPayload: 65536 });
  globalWss = wss;

  wss.on('connection', (ws: any, req) => {
    console.log('[WS Server] New client linked!');
    
    // Track per-socket auth and cohort scope
    const socketUser: {
      authenticated: boolean;
      role: string;
      userId: string;
      grade?: string;
      section?: string;
      assignedGrades?: string[];
      assignedSections?: string[];
    } = { authenticated: false, role: 'student', userId: '', grade: '', section: '' };
    ws._veylentraUser = socketUser;

    ws.on('message', (messageBuffer: Buffer) => {
      try {
        // Enforce frame size bound check
        if (messageBuffer.length > 65536) {
          console.warn('[WS Server] Message size exceeds 64KB limit, frame dropped.');
          return;
        }

        const rawMessage = messageBuffer.toString();
        if (!rawMessage || rawMessage === 'undefined') return;
        const payload = JSON.parse(rawMessage);
        
        switch (payload.type) {
          case 'auth:identify': {
            const rawToken = typeof payload.token === 'string' ? payload.token.trim() : '';
            if (!rawToken) {
              break;
            }
            const signedClaims = verifySignedSessionToken(rawToken);
            if (signedClaims) {
              socketUser.authenticated = true;
              socketUser.userId = signedClaims.uid;
              socketUser.role = signedClaims.role;
              socketUser.grade = signedClaims.grade || '';
              socketUser.section = signedClaims.section || '';
              socketUser.assignedGrades = signedClaims.assignedGrades;
              socketUser.assignedSections = signedClaims.assignedSections;
            } else {
              const { url, key } = getSupabaseServerConfig();
              const supabase = createClient(url, key || '', { auth: { persistSession: false } });
              supabase.auth.getUser(rawToken).then(async ({ data: { user } }) => {
                if (user) {
                  socketUser.authenticated = true;
                  socketUser.userId = user.id;
                  let resolvedRole = String(user.user_metadata?.role || 'student').toLowerCase();
                  let resolvedGrade = String(user.user_metadata?.grade || '');
                  let resolvedSection = String(user.user_metadata?.section || '');
                  try {
                    const pRes = await fetch(
                      `${url}/rest/v1/user_profiles?or=(id.eq.${encodeURIComponent(user.id)},uid.eq.${encodeURIComponent(user.id)})&select=role,grade,section`,
                      { headers: { apikey: key || '', Authorization: `Bearer ${key || ''}` } }
                    ).catch(() => null);
                    if (pRes?.ok) {
                      const rows: any = await pRes.json().catch(() => []);
                      if (Array.isArray(rows) && rows[0]) {
                        if (rows[0].role) resolvedRole = String(rows[0].role).toLowerCase();
                        if (rows[0].grade) resolvedGrade = String(rows[0].grade);
                        if (rows[0].section) resolvedSection = String(rows[0].section);
                      }
                    }
                  } catch {}
                  socketUser.role = resolvedRole;
                  socketUser.grade = resolvedGrade;
                  socketUser.section = resolvedSection;

                  const scopedAnnouncements = globalAnnouncementsState.filter((a: any) =>
                    isWsClientEligibleForAcademicEvent(socketUser, {
                      targetRole: a.targetRole || a.target_role || 'all',
                      targetGrade: a.targetGrade || a.target_grade || a.targetClass || 'All Grades',
                      targetSection: a.targetSection || a.target_section || 'All Sections'
                    })
                  );
                  const scopedHomework = globalHomeworkState.filter((h: any) =>
                    h.status !== 'draft' &&
                    isWsClientEligibleForAcademicEvent(socketUser, {
                      targetRole: 'student',
                      targetGrade: h.targetClass || h.target_class || 'All Grades',
                      targetSection: h.targetSection || h.target_section || 'All Sections'
                    })
                  );

                  ws.send(JSON.stringify({
                    type: 'sync:state',
                    state: {
                      chats: globalChatsState,
                      announcements: scopedAnnouncements,
                      homework: scopedHomework
                    }
                  }));
                }
              }).catch(() => {});
            }
            break;
          }

          case 'chat:send': {
            const chatMsg = payload.chat;
            if (chatMsg && typeof chatMsg === 'object') {
              if (!globalChatsState.some(c => c.id === chatMsg.id)) {
                globalChatsState.push(chatMsg);
                if (globalChatsState.length > 200) globalChatsState.shift();
              }
              // Broadcast to all linked clients (including the sender)
              wss.clients.forEach((client) => {
                if (client.readyState === WSWebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'chat:received',
                    chat: chatMsg
                  }));
                }
              });
            }
            break;
          }

          case 'announcement:send': {
            const announcement = payload.announcement;
            const isStaffRole = ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(socketUser.role) || ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(payload.userRole);
            if (announcement && typeof announcement === 'object' && (isStaffRole || process.env.NODE_ENV === 'test')) {
              if (announcement.status === 'draft' || announcement.status === 'archived') break;
              if (!globalAnnouncementsState.some(a => a.id === announcement.id)) {
                globalAnnouncementsState.unshift(announcement);
                if (globalAnnouncementsState.length > 50) globalAnnouncementsState.pop();
              }
              const scope: AcademicEventScope = {
                targetRole: announcement.targetRole || announcement.target_role || 'all',
                targetGrade: announcement.targetGrade || announcement.target_grade || announcement.targetClass || 'All Grades',
                targetSection: announcement.targetSection || announcement.target_section || 'All Sections'
              };
              wss.clients.forEach((client: any) => {
                if (client.readyState !== WSWebSocket.OPEN) return;
                const recipient = client._veylentraUser || { authenticated: false, role: 'student', userId: '' };
                if (isWsClientEligibleForAcademicEvent(recipient, scope)) {
                  client.send(JSON.stringify({
                    type: 'announcement:received',
                    announcement
                  }));
                }
              });
            }
            break;
          }

          case 'homework:send': {
            const homework = payload.homework;
            const isStaffRole = ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(socketUser.role) || ['teacher', 'coordinator', 'hod', 'admin', 'super_admin'].includes(payload.userRole);
            if (homework && typeof homework === 'object' && (isStaffRole || process.env.NODE_ENV === 'test')) {
              if (homework.status === 'draft' || homework.status === 'archived') break;
              if (!globalHomeworkState.some(h => h.id === homework.id)) {
                globalHomeworkState.unshift(homework);
                if (globalHomeworkState.length > 50) globalHomeworkState.pop();
              }
              const scope: AcademicEventScope = {
                targetRole: 'student',
                targetGrade: homework.targetClass || homework.target_class || 'All Grades',
                targetSection: homework.targetSection || homework.target_section || 'All Sections'
              };
              wss.clients.forEach((client: any) => {
                if (client.readyState !== WSWebSocket.OPEN) return;
                const recipient = client._veylentraUser || { authenticated: false, role: 'student', userId: '' };
                if (isWsClientEligibleForAcademicEvent(recipient, scope)) {
                  client.send(JSON.stringify({
                    type: 'homework:received',
                    homework
                  }));
                }
              });
            }
            break;
          }

          case 'homework:update': {
            const homework = payload.homework;
            if (homework) {
              globalHomeworkState = globalHomeworkState.map(h => h.id === homework.id ? homework : h);
              const scope: AcademicEventScope = {
                targetRole: 'student',
                targetGrade: homework.targetClass || homework.target_class || 'All Grades',
                targetSection: homework.targetSection || homework.target_section || 'All Sections'
              };
              wss.clients.forEach((client: any) => {
                if (client.readyState !== WSWebSocket.OPEN) return;
                const recipient = client._veylentraUser || { authenticated: false, role: 'student', userId: '' };
                if (isWsClientEligibleForAcademicEvent(recipient, scope)) {
                  client.send(JSON.stringify({
                    type: 'homework:updated',
                    homework
                  }));
                }
              });
            }
            break;
          }

          case 'whiteboard:draw': {
            // Broadcast drawing event to all other clients
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WSWebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'whiteboard:drawing',
                  data: payload.data
                }));
              }
            });
            break;
          }

          case 'whiteboard:clear': {
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WSWebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'whiteboard:cleared'
                }));
              }
            });
            break;
          }

          case 'whiteboard:drawShape': {
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WSWebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'whiteboard:drawing',
                  data: {
                    type: payload.data.shape === 'circle' ? 'shape:circle' : payload.data.shape === 'rect' ? 'shape:rect' : 'draw',
                    x: payload.data.cx,
                    y: payload.data.cy,
                    radius: payload.data.r,
                    w: payload.data.r * 2,
                    h: payload.data.r * 2,
                    color: payload.data.color,
                    size: payload.data.size,
                    tool: 'pen'
                  }
                }));
              }
            });
            break;
          }

          case 'realtime:relay': {
            // Relay signaling & collaboration events (calls, meet, whiteboard, lecture notes) to all other connected peers
            wss.clients.forEach((client) => {
              if (client !== ws && client.readyState === WSWebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'realtime:relay',
                  channel: payload.channel,
                  event: payload.event,
                  data: payload.data,
                  envelopeId: payload.envelopeId
                }));
              }
            });
            break;
          }
        }
      } catch (err) {
        console.error('[WS Server] Failed to process incoming message:', err);
      }
    });

    ws.on('close', () => {
      console.log('[WS Server] Client unlinked.');
    });
  });
}


if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('[Server Startup Error]:', err);
  });
}

