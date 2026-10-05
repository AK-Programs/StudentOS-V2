/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { generateAICompletion } from './server/aiClient';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';
import { generateMermaidDiagram, generateSvgDiagram, generateCanvasElements } from './server/diagramEngine';
import webpush from 'web-push';

dotenv.config();

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Canonical matched VAPID keypair for Web Push / FCM (ensures 100% consistency across Vercel serverless cold starts)
const CANONICAL_VAPID_PUBLIC_KEY = 'BLdXVgRSMH1XO-DH4Y8hJ5qzd-BlUw6rVC7BmoBvrTp5sbNcrO05MdgeVSSaI7MPZVl_PLJd8nbNy989mkA3Wfs';
const CANONICAL_VAPID_PRIVATE_KEY = 'sU2176BZPM_YXVCnkceqxV5Oeyrjl8ehA3mt8TTXF8I';

function isValidUUIDServer(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function getOrGenerateVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY.trim(),
      privateKey: process.env.VAPID_PRIVATE_KEY.trim()
    };
  }
  return {
    publicKey: CANONICAL_VAPID_PUBLIC_KEY,
    privateKey: CANONICAL_VAPID_PRIVATE_KEY
  };
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
    provider: 'fcm',
    projectId: 'gen-lang-client-0785563242'
  });
});

app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey || CANONICAL_VAPID_PUBLIC_KEY });
});

// Helper to persist subscription to Supabase push_subscriptions with verified schema
async function persistSubscriptionToSupabase(params: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userId?: string | null;
  deviceId?: string;
  deviceLabel?: string;
  role?: string;
  grade?: string;
  section?: string;
  house?: string;
  schoolId?: string;
  fcmToken?: string;
}) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
  const now = new Date().toISOString();

  const richKeys = {
    p256dh: params.p256dh,
    auth: params.auth,
    userId: params.userId || null,
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

  const resp = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: 'POST',
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      user_id: isValidUUIDServer(params.userId) ? params.userId : null,
      endpoint: params.endpoint,
      keys: richKeys,
      p256dh: params.p256dh,
      auth: params.auth,
      updated_at: now
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.warn(`[FCM SERVER] Supabase push_subscriptions upsert notice (${resp.status}):`, errText);
  } else {
    console.log(`[FCM SERVER] Stored active push subscription in Supabase: userId=${params.userId || 'anon'}, role=${params.role || 'student'}, device="${params.deviceLabel || 'Browser'}"`);
  }
}

// Register FCM Device Token & WebPush Subscription for authenticated user & device
app.post('/api/push/fcm-token', async (req, res) => {
  const { token, fcmToken, userId, deviceId, deviceLabel, role, grade, section, house, schoolId, subscription, userAgent } = req.body || {};
  const primaryToken = subscription?.endpoint || token || fcmToken;
  if (!primaryToken) {
    return res.status(400).json({ error: 'FCM registration token or subscription endpoint is required.' });
  }

  const devId = deviceId || 'dev_' + Math.random().toString(36).substring(2, 10);
  const existingIdx = memoryFCMTokens.findIndex(
    t => t.token === primaryToken || (t.deviceId === devId && t.userId === userId)
  );

  const newItem: FCMTokenItem = {
    token: primaryToken,
    fcmToken: fcmToken || token,
    userId: userId || null,
    deviceId: devId,
    deviceLabel: deviceLabel || 'Web Browser',
    role: role || 'student',
    grade: grade || '',
    section: section || '',
    house: house || '',
    schoolId: schoolId || 'default_school',
    subscription: subscription || null,
    userAgent: userAgent || '',
    isActive: true,
    updatedAt: Date.now()
  };

  if (existingIdx >= 0) {
    memoryFCMTokens[existingIdx] = newItem;
  } else {
    memoryFCMTokens.push(newItem);
  }

  console.log(`[FCM SERVER] Registered device token: userId=${userId || 'anonymous'}, tokenExists=yes, tokenActive=yes, role=${role || 'student'}, label="${newItem.deviceLabel}"`);

  // Persist to Supabase push_subscriptions table using exact verified schema
  if (subscription?.endpoint && subscription?.keys?.p256dh && subscription?.keys?.auth) {
    try {
      await persistSubscriptionToSupabase({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userId: userId || null,
        deviceId: devId,
        deviceLabel: deviceLabel || 'Web Browser',
        role: role || 'student',
        grade: grade || '',
        section: section || '',
        house: house || '',
        schoolId: schoolId || 'default_school',
        fcmToken: fcmToken || token
      });
    } catch (sbErr: any) {
      console.warn('[FCM SERVER] Supabase token sync notice:', sbErr?.message);
    }
  }

  return res.json({ status: 'ok', deviceId: devId, tokenStored: true });
});

// Deactivate FCM Device Token
app.post('/api/push/fcm-token/delete', async (req, res) => {
  const { token, deviceId, userId } = req.body || {};
  for (let i = memoryFCMTokens.length - 1; i >= 0; i--) {
    const item = memoryFCMTokens[i];
    if ((token && (item.token === token || item.subscription?.endpoint === token)) || (deviceId && item.deviceId === deviceId)) {
      item.isActive = false;
    }
  }

  if (token && token.startsWith('http')) {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
      await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
    } catch (_) {}
  }

  return res.json({ status: 'ok' });
});

// Backward-compatible subscribe endpoint
app.post('/api/push/subscribe', async (req, res) => {
  const { subscription, userId, deviceId, userAgent, role, grade, section, house, schoolId } = req.body || {};
  if (subscription && subscription.endpoint) {
    const devId = deviceId || 'dev_' + Math.random().toString(36).substring(2, 10);
    const existingIdx = memoryFCMTokens.findIndex(t => t.token === subscription.endpoint || t.deviceId === devId);
    
    const newItem: FCMTokenItem = {
      token: subscription.endpoint,
      userId: userId || null,
      deviceId: devId,
      role: role || 'student',
      grade: grade || '',
      section: section || '',
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

    if (subscription.keys?.p256dh && subscription.keys?.auth) {
      try {
        await persistSubscriptionToSupabase({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userId: userId || null,
          deviceId: devId,
          deviceLabel: userAgent || 'Web Browser',
          role: role || 'student',
          grade: grade || '',
          section: section || '',
          house: house || '',
          schoolId: schoolId || 'default_school'
        });
      } catch (_) {}
    }
  }
  return res.json({ status: 'ok' });
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const { deviceId, userId } = req.body || {};
  for (let i = memoryFCMTokens.length - 1; i >= 0; i--) {
    const item = memoryFCMTokens[i];
    if ((deviceId && item.deviceId === deviceId) || (userId && item.userId === userId)) {
      item.isActive = false;
    }
  }
  return res.json({ status: 'ok' });
});

// Targeted Server-Side Push Dispatch via FCM & Web Push
app.post('/api/push/send', async (req, res) => {
  const {
    notificationId,
    title,
    body,
    type,
    linkTab,
    tag,
    targetUserId,
    targetRole,
    targetClass,
    targetSection,
    targetSchoolId
  } = req.body || {};

  const notifId = notificationId || `notif_${Date.now()}`;
  const notifTitle = title || '📢 StudentOS Alert';
  const notifBody = body || '';
  const notifType = type || 'announcement';
  const notifLinkTab = linkTab || 'notice_viewer';
  const notifSchoolId = targetSchoolId || 'default_school';
  const notifTag = tag || `studentos-notif-${notifId}`;
  const notifUrl = `/?tab=${encodeURIComponent(notifLinkTab)}&notifId=${encodeURIComponent(notifId)}`;

  console.log(`[FCM PUSH SEND] Dispatching Notice: id="${notifId}" | title="${notifTitle}" | targetUser="${targetUserId || 'all'}" | role="${targetRole || 'all'}" | class="${targetClass || 'all'}"`);

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
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  try {
    const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });

    if (subRes.ok) {
      const dbSubs = await subRes.json();
      if (Array.isArray(dbSubs)) {
        dbSubs.forEach((row: any) => {
          if (row.endpoint && !tokensToTry.some(t => t.endpoint === row.endpoint)) {
            const rawKeys = row.keys && typeof row.keys === 'object' ? row.keys : {};
            const p256dh = rawKeys.p256dh || row.p256dh;
            const auth = rawKeys.auth || row.auth;
            const isActive = rawKeys.isActive !== false;

            if (p256dh && auth && isActive) {
              tokensToTry.push({
                endpoint: row.endpoint,
                keys: { p256dh, auth },
                userId: rawKeys.userId || row.user_id || undefined,
                deviceId: rawKeys.deviceId || undefined,
                deviceLabel: rawKeys.deviceLabel || 'Android/Chrome Device',
                role: rawKeys.role || undefined,
                grade: rawKeys.grade || undefined,
                section: rawKeys.section || undefined,
                schoolId: rawKeys.schoolId || 'default_school',
                isActive: true
              });
            }
          }
        });
      }
    }
  } catch (dbErr: any) {
    console.warn('[FCM PUSH SEND] Database query notice:', dbErr?.message);
  }

  let sentCount = 0;
  let failCount = 0;
  const deliveryLogs: any[] = [];

  for (const item of tokensToTry) {
    // School isolation: If targetSchoolId is set, prevent cross-school delivery
    if (targetSchoolId && targetSchoolId !== 'all' && item.schoolId && item.schoolId !== targetSchoolId) {
      continue;
    }

    // Strict user-level targeting: If targetUserId is specified, only deliver to matching user's devices
    if (targetUserId && targetUserId !== 'all') {
      if (!item.userId || item.userId !== targetUserId) {
        continue;
      }
    }

    // Role targeting
    if (targetRole && targetRole !== 'all' && item.role) {
      if (item.role.toLowerCase() !== targetRole.toLowerCase()) {
        continue;
      }
    }

    // Class / Grade targeting (ignore if 'all' or 'All Grades')
    if (targetClass && targetClass !== 'all' && targetClass !== 'All Grades' && item.grade) {
      const normT = targetClass.toString().toLowerCase().replace(/class|grade|all\s*sections|_|\s+/g, '');
      const normU = item.grade.toString().toLowerCase().replace(/class|grade|\s+/g, '');
      if (normT && normU && !normU.includes(normT) && !normT.includes(normU)) {
        continue;
      }
    }

    // Section targeting (ignore if 'all' or 'All Sections')
    if (targetSection && targetSection !== 'all' && targetSection !== 'All Sections' && item.section) {
      const normTS = targetSection.toString().toLowerCase().replace(/section|\s+/g, '').trim();
      const normUS = item.section.toString().toLowerCase().replace(/section|\s+/g, '').trim();
      if (normTS && normUS && normUS !== normTS && !normUS.includes(normTS)) {
        continue;
      }
    }

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

        // Clean up expired (410/404) or key-mismatched (401/403) subscriptions from memory & Supabase
        if (statusCode === 410 || statusCode === 404 || statusCode === 401 || statusCode === 403) {
          const idx = memoryFCMTokens.findIndex(m => m.token === item.endpoint || m.subscription?.endpoint === item.endpoint);
          if (idx >= 0) memoryFCMTokens.splice(idx, 1);
          try {
            await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(item.endpoint)}`, {
              method: 'DELETE',
              headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            console.log(`[FCM PUSH CLEANUP] Removed stale/expired push subscription (HTTP ${statusCode}) for user="${item.userId || 'anon'}".`);
          } catch (_) {}
        }
      }
    }
  }

  return res.json({
    status: 'ok',
    provider: 'fcm_webpush',
    notificationId: notifId,
    sentCount,
    failCount,
    totalCandidates: tokensToTry.length,
    fcmSendResult: sentCount > 0 ? 'DELIVERED' : (tokensToTry.length === 0 ? 'NO_TOKENS_REGISTERED' : 'DELIVERY_FAILED'),
    deliveryLogs
  });
});

// Real-time Push Diagnostic Endpoint
app.get('/api/push/debug-status', async (req, res) => {
  const activeMemoryTokens = memoryFCMTokens.filter(t => t.isActive);
  let supabaseSubscriptions: any[] = [];
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
    const subRes = await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (subRes.ok) {
      const rows = await subRes.json();
      if (Array.isArray(rows)) {
        supabaseSubscriptions = rows.map(r => ({
          id: r.id,
          userId: r.keys?.userId || r.user_id || 'anonymous',
          role: r.keys?.role || 'student',
          grade: r.keys?.grade || '',
          section: r.keys?.section || '',
          deviceLabel: r.keys?.deviceLabel || 'Browser',
          tokenExists: Boolean(r.endpoint),
          tokenActive: r.keys?.isActive !== false,
          updatedAt: r.updated_at
        }));
      }
    }
  } catch (_) {}

  res.json({
    vapidConfigured: Boolean(vapidKeys.publicKey && vapidKeys.privateKey),
    vapidPublicKeyPrefix: (vapidKeys.publicKey || '').slice(0, 16) + '...',
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
// STUDENTOS GAMIFICATION API ENDPOINTS (/api/gamification/*)
// ========================================================================
const memoryGamificationStore: Record<string, any> = {};

app.get('/api/gamification/profile', async (req, res) => {
  const userId = String(req.query.userId || '');
  const schoolId = String(req.query.schoolId || 'default_school');
  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';

  let storeData: Record<string, any> = { ...memoryGamificationStore };
  try {
    const gRes = await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.__studentos_gamification_${encodeURIComponent(schoolId)}__&select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (gRes.ok) {
      const rows = await gRes.json();
      if (Array.isArray(rows) && rows[0]?.content) {
        const parsed = JSON.parse(rows[0].content);
        storeData = { ...parsed, ...storeData };
      }
    }
  } catch (_) {}

  const profile = userId ? storeData[userId] || null : null;
  const leaderboard = Object.values(storeData).sort((a: any, b: any) => (b.xp || 0) - (a.xp || 0));

  return res.json({
    status: 'ok',
    profile,
    leaderboard
  });
});

app.post('/api/gamification/award', async (req, res) => {
  const { userId, schoolId = 'default_school', profile } = req.body || {};
  if (!userId || !profile) {
    return res.status(400).json({ error: 'userId and profile are required' });
  }

  memoryGamificationStore[userId] = profile;

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zwpoutanhsujezglbson.supabase.co';
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cG91dGFuaHN1amV6Z2xic29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTA2MDEsImV4cCI6MjA5NzI2NjYwMX0.Y48u9duD3WohxzDD6czXevPaG1mFRFS0rdRuu4840pQ';
  const docId = `__studentos_gamification_${schoolId}__`;

  try {
    let existingMap: Record<string, any> = {};
    const gRes = await fetch(`${supabaseUrl}/rest/v1/global_data?id=eq.${encodeURIComponent(docId)}&select=*`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (gRes.ok) {
      const rows = await gRes.json();
      if (Array.isArray(rows) && rows[0]?.content) {
        existingMap = JSON.parse(rows[0].content);
      }
    }
    existingMap[userId] = profile;
    Object.assign(memoryGamificationStore, existingMap);

    await fetch(`${supabaseUrl}/rest/v1/global_data?on_conflict=id`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: docId,
        title: 'StudentOS Gamification Store',
        subject: schoolId,
        content: JSON.stringify(existingMap),
        created_at: new Date().toISOString()
      })
    });
  } catch (e: any) {
    console.warn('[Gamification Server] Sync notice:', e?.message);
  }

  return res.json({ status: 'ok', profile });
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
  res.json({ status: 'ok', time: new Date() });
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

              // 2. Dispatch push notification if webpush is enabled
              if (vapidKeys.publicKey && vapidKeys.privateKey) {
                try {
                  const pushPayload = JSON.stringify({
                    title: `🚀 What's New in StudentOS ${row.version}`,
                    body: row.title || 'A new official update has been published.',
                    linkTab: 'whats_new',
                    url: '/whats-new',
                    tag: `whats-new-${row.id}`
                  });

                  // Dispatch to memory tokens
                  memoryFCMTokens.forEach(sub => {
                    if (sub.subscription?.endpoint && sub.subscription?.keys) {
                      webpush.sendNotification(sub.subscription, pushPayload, { TTL: 86400 }).catch(() => {});
                    }
                  });
                } catch (_) {}
              }

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
setInterval(() => {
  checkAndPublishScheduledUpdates().catch(() => {});
}, 30000);

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

interface AIUsageLog {
  id: string;
  userId: string;
  role: string;
  feature: string;
  timestamp: number;
}

let ROLE_AI_LIMITS: Record<string, number> = {
  student: 30,
  teacher: 75,
  coordinator: 100,
  admin: 150,
  super_admin: 150
};

const memoryAIUsage: AIUsageLog[] = [];

const userBonusQuotas: Record<string, number> = {};
const userRedeemedCodes: Record<string, string[]> = {};
const pendingQuotaRequests: Array<{ id: string; userId: string; userName: string; userEmail: string; reason: string; timestamp: number }> = [];

const VALID_VOUCHERS: Record<string, { bonus: number; title: string }> = {
  'STUDENTOS-PRO': { bonus: 25, title: 'StudentOS Pro Booster (+25/day)' },
  'EXAM-PREP': { bonus: 35, title: 'Exam Preparation Sprint (+35/day)' },
  'SCHOLAR-PASS': { bonus: 50, title: 'Academic Scholar Pass (+50/day)' },
  'GENIUS-2026': { bonus: 40, title: '2026 Innovation Grant (+40/day)' },
  'TEACHER-GRANT': { bonus: 60, title: 'Faculty Authorized Quota (+60/day)' },
  'STUDENTOS-UNLIMITED': { bonus: 100, title: 'StudentOS Unlimited Sprint (+100/day)' },
};

function getRoleLimit(role?: string): number {
  const r = (role || 'student').toLowerCase();
  return ROLE_AI_LIMITS[r] || 30;
}

function getRolling24hUsage(userId: string, role?: string): {
  used: number;
  limit: number;
  baseLimit: number;
  bonus: number;
  remaining: number;
  nextAvailableInMinutes: number | null;
  role: string;
} {
  const now = Date.now();
  const windowStart = now - 24 * 60 * 60 * 1000;

  // Filter records in last 24h
  const activeRecords = memoryAIUsage.filter(u => u.userId === userId && u.timestamp >= windowStart);
  activeRecords.sort((a, b) => a.timestamp - b.timestamp);

  const baseLimit = getRoleLimit(role);
  const bonus = userBonusQuotas[userId] || 0;
  const limit = baseLimit + bonus;
  const used = activeRecords.length;
  const remaining = Math.max(0, limit - used);

  let nextAvailableInMinutes: number | null = null;
  if (used >= limit && activeRecords.length > 0) {
    const oldest = activeRecords[0].timestamp;
    const expiresAt = oldest + 24 * 60 * 60 * 1000;
    nextAvailableInMinutes = Math.max(1, Math.ceil((expiresAt - now) / 60000));
  }

  return {
    used,
    limit,
    baseLimit,
    bonus,
    remaining,
    nextAvailableInMinutes,
    role: (role || 'student').toLowerCase()
  };
}

// Endpoint to inspect rolling 24-hour limit
app.get('/api/ai/usage-status', (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'anonymous';
    const role = (req.query.role as string) || 'student';
    const info = getRolling24hUsage(userId, role);
    return res.json(info);
  } catch (err: any) {
    return res.json({
      used: 0,
      limit: 30,
      baseLimit: 30,
      bonus: 0,
      remaining: 30,
      nextAvailableInMinutes: null,
      role: 'student'
    });
  }
});

// Endpoint to redeem voucher codes for quota boost
app.post('/api/ai/redeem-voucher', (req, res) => {
  const { code, userId, userRole } = req.body || {};
  const activeUserId = userId || 'anonymous';
  const cleanCode = String(code || '').trim().toUpperCase();

  const voucher = VALID_VOUCHERS[cleanCode];
  if (!voucher) {
    return res.status(400).json({ success: false, error: 'Invalid or expired voucher code.' });
  }

  const redeemed = userRedeemedCodes[activeUserId] || [];
  if (redeemed.includes(cleanCode)) {
    return res.status(400).json({ success: false, error: 'Voucher has already been redeemed for this account.' });
  }

  // Redeem voucher
  redeemed.push(cleanCode);
  userRedeemedCodes[activeUserId] = redeemed;
  userBonusQuotas[activeUserId] = (userBonusQuotas[activeUserId] || 0) + voucher.bonus;

  const updatedUsage = getRolling24hUsage(activeUserId, userRole);
  return res.json({
    success: true,
    message: `Voucher redeemed! Added ${voucher.title}`,
    bonusAdded: voucher.bonus,
    newLimit: updatedUsage.limit,
    remaining: updatedUsage.remaining
  });
});

// Endpoint to request AI boost from school staff
app.post('/api/ai/request-boost', (req, res) => {
  const { userId, userName, userEmail, reason } = req.body || {};
  if (!reason) {
    return res.status(400).json({ success: false, error: 'Reason is required' });
  }

  const request = {
    id: 'req_' + Math.random().toString(36).substring(2, 11),
    userId: userId || 'anonymous',
    userName: userName || 'Student',
    userEmail: userEmail || '',
    reason: String(reason).trim(),
    timestamp: Date.now()
  };

  pendingQuotaRequests.push(request);
  return res.json({
    success: true,
    message: 'Your quota upgrade request has been forwarded to faculty coordinators.'
  });
});

// Endpoint for admins to configure role limits
app.post('/api/admin/ai-limits', (req, res) => {
  const { limits, adminRole } = req.body || {};
  if (adminRole !== 'admin' && adminRole !== 'super_admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin privilege required.' });
  }
  if (limits && typeof limits === 'object') {
    ROLE_AI_LIMITS = { ...ROLE_AI_LIMITS, ...limits };
  }
  return res.json({ status: 'ok', limits: ROLE_AI_LIMITS });
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

// POST /api/config/apk - Restricted: Only Super Admin and Admins can publish new APK download destinations
app.post('/api/config/apk', (req, res) => {
  const { apkUrl, apkFileName, apkSize, userRole, isSuperAdmin, updatedBy } = req.body || {};

  const isAuthorized = isSuperAdmin === true || userRole === 'super_admin' || userRole === 'admin';
  if (!isAuthorized) {
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
  globalApkConfig.updatedBy = updatedBy || 'Super Admin';

  console.log(`[APK CONFIG] Global download destination updated by ${globalApkConfig.updatedBy}: URL="${globalApkConfig.apkUrl}" File="${globalApkConfig.apkFileName}"`);

  return res.json({
    success: true,
    message: 'Global APK destination updated successfully for all users.',
    ...globalApkConfig
  });
});

// Server-side diagnostic test route for NVIDIA API connection
app.get('/api/ai/diagnostic', async (req, res) => {
  const rawKey =
    process.env.NVIDIA_API_KEY ||
    process.env.VITE_NVIDIA_API_KEY ||
    process.env.NIM_API_KEY ||
    process.env.NGC_API_KEY ||
    process.env.AI_API_KEY ||
    '';
  const keyPresent = Boolean(rawKey.trim());
  
  try {
    const text = await generateAICompletion({
      prompt: 'Say hello in 5 words.',
      endpointName: 'DiagnosticTest',
      maxTokens: 30
    });
    return res.json({
      success: true,
      keyPresent,
      keyLength: rawKey.trim().length,
      modelTested: 'meta/llama-3.3-70b-instruct',
      response: text
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      keyPresent,
      keyLength: rawKey.trim().length,
      error: err.message || 'Diagnostic request failed'
    });
  }
});

// Secure API endpoint for AI Teacher and Buddy conversations
app.post('/api/ai/chat', async (req, res) => {
  const { prompt, history, persona, level, subject, mode, ragContext, userId, userRole, modelOverride } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Enforce server-side rolling 24-hour limit
  const activeUserId = userId || 'user_guest';
  const activeRole = userRole || 'student';

  const usage = getRolling24hUsage(activeUserId, activeRole);
  if (usage.used >= usage.limit) {
    return res.status(429).json({
      error: 'AI_LIMIT_REACHED',
      message: `You have reached your daily limit of ${usage.limit} AI messages. A new message slot will open in ${usage.nextAvailableInMinutes || 60} minutes.`,
      used: usage.used,
      limit: usage.limit,
      remaining: 0,
      nextAvailableInMinutes: usage.nextAvailableInMinutes
    });
  }

  // Construct context based on chatbot Persona
  let systemInstruction = 'You are a supportive, encouraging study assistant powered by NVIDIA AI.';
  
  if (persona === 'elara') {
    systemInstruction = `You are Professor Elara, a kind, highly analytical Mathematics and Science teacher. 
    You break complex equations into intuitive visuals. Talk to the student with encouragement and scientific clarity. 
    Focus on helping them understand the "why" behind the solutions. Current student level: ${level || 'Secondary'}.`;
  } else if (persona === 'ruby') {
    systemInstruction = `You are Dr. Ruby, an ultra-engaging, slightly strict but highly motivating Literature and History teacher. 
    You expect rigorous thought, structured essays, and deep criticism. Give them structured guidance and push them to excel. 
    Current student level: ${level || 'Secondary'}.`;
  } else if (persona === 'solara') {
    systemInstruction = `You are Coach Solara, an energetic Computer Science and practical applications instructor. 
    You explain coding in gaming or everyday concepts, use code blocks often, and advise on best development workflows. 
    Current student level: ${level || 'Secondary'}.`;
  } else if (persona === 'study_buddy') {
    systemInstruction = `You are StudentOS AI Buddy, a friendly peer study partner made by Naitik Kashyap. 
    You help with scheduling, summarize files, rewrite notes, and review quizzes. You use friendly emojis, study peer slang, and motivate!`;
  } else if (persona === 'orion') {
    systemInstruction = `You are Orion, the ultimate AI educational assistant for StudentOS. 
    You have deep knowledge, maintain long conversation memory, and provide concise, highly accurate academic answers.
    You communicate in a natural, conversational, and speech-friendly tone. Do not use overly complex formatting when chatting directly.
    You possess full multi-language capabilities and can fluently respond in English, Hindi, Spanish, or any requested language.
    You prioritize the StudentOS context if provided.`;
  }

  // Inject learning style mode
  if (mode === 'socratic') {
    systemInstruction += '\n\nMETHOD: Socratic Method. Do NOT provide direct solutions. Instead, guide the student towards finding the answer by asking scaffolding questions and breaking down complexity step-by-step.';
  } else if (mode === 'explanatory') {
    systemInstruction += '\n\nMETHOD: Conceptual Explainer. Give comprehensive analogies, clear definitions, clear conceptual breakdowns of formulas or claims, and intuitive study summaries.';
  } else if (mode === 'coder') {
    systemInstruction += '\n\nMETHOD: Programming Coach. Format solutions with clean, well-commented code blocks, write concise variable maps, outline space/time complexities, and detail systematic debug recommendations.';
  } else if (mode === 'quiz_gen') {
    systemInstruction += '\n\nMETHOD: Knowledge Examiner / Quiz Mode. Propose one relevant, clear, challenging subject question or scenario and ask the student to solve it.';
  }

  if (ragContext) {
    systemInstruction += `\n\nSTUDENT OS KNOWLEDGE BASE (Use this FIRST before general knowledge):\n${ragContext}`;
  }

  try {
    console.log(`[SERVER AI /api/ai/chat] Request received for persona "${persona || 'default'}". Prompt length: ${prompt.length}`);
    const isJsonRequested = prompt.includes('raw JSON format') || prompt.includes('MUST be raw JSON format') || prompt.includes('operational actions');
    const text = await generateAICompletion({
      systemInstruction,
      prompt,
      history: sanitizeHistory(history || []),
      temperature: 0.7,
      jsonMode: isJsonRequested,
      modelOverride,
      endpointName: 'AIChat'
    });
    console.log(`[SERVER AI /api/ai/chat] Completion generated successfully. Output length: ${text?.length || 0}`);
    
    // Record rolling 24h usage log
    memoryAIUsage.push({
      id: 'use_' + Math.random().toString(36).substring(2, 11),
      userId: activeUserId,
      role: activeRole,
      feature: persona || 'ai_buddy',
      timestamp: Date.now()
    });

    const updatedUsage = getRolling24hUsage(activeUserId, activeRole);

    return res.json({ 
      success: true,
      text,
      usage: {
        used: updatedUsage.used,
        limit: updatedUsage.limit,
        remaining: updatedUsage.remaining,
        nextAvailableInMinutes: updatedUsage.nextAvailableInMinutes
      }
    });
  } catch (apiErr: any) {
    console.error(`[SERVER AI /api/ai/chat ERROR] Provider completion failed: ${apiErr.message || apiErr}`);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: apiErr.message || String(apiErr)
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

// Educational SVG Diagram Generator Endpoint
app.post('/api/ai/svg-diagram', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  try {
    const { query, subject = 'general' } = req.body || {};
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });
    console.log(`[AI Server] POST /api/ai/svg-diagram received query: "${query}" (subject: ${subject})`);
    const result = await generateSvgDiagram(query, subject);
    console.log(`[AI Server] POST /api/ai/svg-diagram completed successfully. Title: "${result?.title}"`);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[AI Server] SVG Diagram endpoint failure. Stack trace:\n', err.stack || err);
    return res.status(200).json({ success: false, error: 'Failed to generate SVG diagram', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect width="600" height="400" fill="#0f172a"/><text x="300" y="200" fill="#ffffff" font-size="20" text-anchor="middle">${req.body?.query || 'Diagram'}</text></svg>`, title: req.body?.query || 'Diagram', subject: req.body?.subject || 'general' });
  }
});

app.post('/api/ai/search', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  const tavilyKey = process.env.VITE_TAVILY_API_KEY || process.env.TAVILY_API_KEY || '';
  
  // 1. LOG: Tavily key detected
  console.log(`[AI Server] Tavily key detected: ${tavilyKey ? 'YES' : 'NO'}`);

  if (!tavilyKey) {
    console.error('[AI Server] Search error: Tavily API Key is not configured on the server.');
    return res.status(400).json({ error: 'Tavily API Key is not configured on the server. Unable to process real-time web search.' });
  }

  let searchResultsList: { title: string; description: string; uri: string; published_source?: string }[] = [];
  let summaryText = '';

  try {
    let rawResults: any[] = [];

    // 2. LOG: Tavily request sent
    console.log(`[AI Server] Tavily request sent for query: "${query}"`);
    
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: query,
        search_depth: "basic",
        max_results: 5
      })
    });

    // 3. LOG: Tavily response received
    console.log(`[AI Server] Tavily response received with status: ${response.status}`);

    if (response.ok) {
      const responseData = await response.json();
      rawResults = responseData.results || [];
    } else {
      const errText = await response.text();
      console.error(`[AI Server] Search error: Tavily API request failed with status ${response.status}: ${errText}`);
      return res.status(response.status).json({ error: `Tavily API failed: ${errText}` });
    }

    if (rawResults.length > 0) {
      searchResultsList = rawResults.map((item) => {
        const title = item.title || 'Educational Resource';
        const uri = item.url || '';
        const description = item.content || item.snippet || 'Real-time learning material and online documentation.';
        let published_source = '';
        if (uri) {
          try {
            published_source = new URL(uri).hostname.replace('www.', '');
          } catch (_) {}
        }
        if (!published_source) published_source = 'Verified Source';

        return { title, description, uri, published_source };
      });
      
      // 4. LOG: Search results rendered
      console.log(`[AI Server] Search results rendered for query: "${query}". Found ${searchResultsList.length} references.`);
    } else {
      console.warn(`[AI Server] Search error: Tavily returned empty results for query "${query}".`);
      return res.status(404).json({ error: 'No search results found on Tavily.' });
    }

    // Synthesis academic summary strictly from findings
    const summaryContext = searchResultsList.map((s, i) => `[Source ${i+1}]: ${s.title} (${s.uri}) - ${s.description}`).join('\n');
    try {
      summaryText = await generateAICompletion(
        "You are Orion Search summarizer powered by DeepSeek. Synthesize a 3-4 sentence comprehensive, factual academic summary. Refer only to facts from the provided sources. Do not make up any facts.",
        `Based strictly on the following live web search findings, write a beautifully structured educational summary for the query "${query}":\n\n${summaryContext}`
      );
    } catch (_) {
      summaryText = `Academic synthesis of "${query}": Live search returned matching reference channels. We have compiled a curriculum list below covering theoretical methodologies, formula frameworks, and verified practice exercises.`;
    }

  } catch (err: any) {
    // 5. LOG: Search errors logged
    console.error('[AI Server] Search error: Execution failure:', err);
    return res.status(500).json({ error: `Search execution failure: ${err.message}` });
  }

  return res.json({
    summary: summaryText,
    results: searchResultsList
  });
});

app.post('/api/ai/notes', async (req, res) => {
  const { content, action, instruction } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  let systemInstruction = 'You are a supportive, high-achieving academic writing companion.';
  let userPrompt = '';

  if (action === 'summarize') {
    systemInstruction = 'You are a meticulous scientific editor. Synthesize the provided text into a beautifully structured, highly readable bulleted cheat-sheet. Highlight key definitions in bold.';
    userPrompt = `Please summarize this note section: \n\n"${content}"`;
  } else if (action === 'expand') {
    systemInstruction = 'You are a supportive professor. Deeply expand of the concepts inside the text, write concrete examples, analogies, and detailed clarifications to help the student master the concept.';
    userPrompt = `Please expand and explain this text block: \n\n"${content}"`;
  } else if (action === 'improve') {
    systemInstruction = 'You are an elite academic copywriter. Proofread, fix grammar mistakes, and rewrite the provided block to make it flow beautifully while retaining all of its hard factual and technical data.';
    userPrompt = `Please proofread and rewrite this text block cleanly: \n\n"${content}"`;
  } else if (action === 'quiz') {
    systemInstruction = 'You are an evaluation expert. Design a high-yield Active Recall quiz comprising 3 challenging multiple-choice or short answer conceptual questions based strictly on the text provided. ALWAYS include an answer key at the bottom.';
    userPrompt = `Generate a quiz about this text content: \n\n"${content}"`;
  } else if (action === 'action_items') {
    systemInstruction = 'You are a productivity organizer. Scan the provided content, extract any clear actionable items, homework commitments, objectives, or tasks, and format them as a clean Markdown checkbox checklist (e.g. - [ ] Task).';
    userPrompt = `Extract action checklist notes from this text block: \n\n"${content}"`;
  } else if (action === 'generate_notes') {
    systemInstruction = 'You are an elite AI Teacher generating beautifully structured, highly detailed, exam-focused lecture notes. Produce comprehensive academic content with concepts, definitions, formulas, a summary, important questions, and revision points. Never provide a single line response.';
    userPrompt = `Topic: "${content}"\nGenerate the complete lecture notes.`;
  } else if (action === 'custom') {
    systemInstruction = instruction || 'You are an academic drafting robot.';
    userPrompt = content;
  } else {
    // Custom prompt instruction
    systemInstruction = 'You are an academic drafting robot. Execute the user instruction meticulously on the provided text, formatting the returned response inside clean Markdown blocks.';
    userPrompt = `Text to transform:\n"${content}"\n\nInstruction to execute on this text:\n"${instruction || 'Summarize'}"`;
  }

  try {
    const text = await generateAICompletion(systemInstruction, userPrompt);
    return res.json({ success: true, text });
  } catch (apiErr: any) {
    console.error('[AI Server] Notes transform error:', apiErr?.message || apiErr);
    return res.status(502).json({
      success: false,
      error: 'AI is temporarily unavailable. Please try again.',
      details: apiErr.message || String(apiErr)
    });
  }
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

// ============================================================
// Database Setup Endpoint — returns the setup SQL file content
// Admins can copy-paste this into the Supabase SQL Editor (one-time setup)
// ============================================================
app.get('/api/admin/setup-sql', (req, res) => {
  try {
    const sqlPath = path.join(process.cwd(), 'supabase', 'setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    res.type('text/plain').send(sql);
  } catch (err: any) {
    res.status(500).json({ error: 'Could not read setup SQL: ' + err.message });
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

  const wss = new WebSocketServer({ server });
  globalWss = wss;

  wss.on('connection', (ws) => {
    console.log('[WS Server] New client linked!');
    
    // Sync state immediately upon linking
    ws.send(JSON.stringify({
      type: 'sync:state',
      state: {
        chats: globalChatsState,
        announcements: globalAnnouncementsState,
        homework: globalHomeworkState
      }
    }));

    ws.on('message', (messageBuffer) => {
      try {
        const rawMessage = messageBuffer.toString();
        if (!rawMessage || rawMessage === 'undefined') return;
        const payload = JSON.parse(rawMessage);
        
        switch (payload.type) {
          case 'chat:send': {
            const chatMsg = payload.chat;
            if (chatMsg) {
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
            if (announcement) {
              if (!globalAnnouncementsState.some(a => a.id === announcement.id)) {
                globalAnnouncementsState.unshift(announcement);
                if (globalAnnouncementsState.length > 50) globalAnnouncementsState.pop();
              }
              wss.clients.forEach((client) => {
                if (client.readyState === WSWebSocket.OPEN) {
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
            if (homework) {
              if (!globalHomeworkState.some(h => h.id === homework.id)) {
                globalHomeworkState.unshift(homework);
                if (globalHomeworkState.length > 50) globalHomeworkState.pop();
              }
              wss.clients.forEach((client) => {
                if (client.readyState === WSWebSocket.OPEN) {
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
              wss.clients.forEach((client) => {
                if (client.readyState === WSWebSocket.OPEN) {
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
  startServer();
}

