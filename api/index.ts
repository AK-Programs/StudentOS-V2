/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Thin ESM Vercel Serverless Function Entry Point for Veylentra.
 * Delegates all core AI, Auth, Quota, and Orion routes to shared canonical handlers
 * in ../server/canonicalAiHandlers.js so Express and Vercel share one exact contract.
 */

import {
  classifyTaskComplexity,
  getNextGroqModel,
  getZaiApiKey,
  ZAI_API_BASE_URL,
  ZAI_CHAT_COMPLETIONS_URL,
  ZAI_MODEL_ID,
} from '../server/aiClient.js';
import {
  createRequestId,
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
  NodeLikeReq,
  NodeLikeRes,
  sendJson,
} from '../server/canonicalAiHandlers.js';
import { parseClassAndSection } from '../server/orionService.js';
import { buildErrorEnvelope, normalizePublicErrorMessage } from '../server/sessionAuth.js';

export {
  classifyTaskComplexity,
  getNextGroqModel,
  getZaiApiKey,
  parseClassAndSection,
  ZAI_API_BASE_URL,
  ZAI_CHAT_COMPLETIONS_URL,
  ZAI_MODEL_ID,
};

let cachedServerApp: any = null;

function applyCorsHeaders(res: NodeLikeRes, req: NodeLikeReq): void {
  const origin = typeof req.headers?.origin === 'string' && req.headers.origin.trim() ? req.headers.origin.trim() : '*';
  try {
    res.setHeader?.('Access-Control-Allow-Origin', origin);
    res.setHeader?.('Vary', 'Origin');
    res.setHeader?.('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader?.(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, x-supabase-auth, x-veylentra-session, x-veylentra-uid, x-veylentra-role, x-veylentra-email, x-veylentra-name, x-veylentra-grade, x-veylentra-section, x-veylentra-assigned-grades, x-veylentra-assigned-sections, x-veylentra-assigned-classes'
    );
  } catch {
    // ignore header errors if already sent
  }
}

function normalizePathname(rawUrl: unknown): string {
  const raw = typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl.trim() : '/';
  const withoutQuery = raw.split('?')[0] || '/';
  const clean = withoutQuery.length > 1 && withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
  return clean || '/';
}

function forceJson(res: NodeLikeRes, statusCode: number, payload: Record<string, any>): void {
  try {
    sendJson(res, statusCode, payload);
  } catch {
    try {
      res.statusCode = statusCode;
      res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
      res.end?.(JSON.stringify(payload));
    } catch {
      // last resort
    }
  }
}

export default async function handler(req: NodeLikeReq, res: NodeLikeRes) {
  const requestId = createRequestId();
  applyCorsHeaders(res, req);

  if (String(req.method || 'GET').toUpperCase() === 'OPTIONS') {
    res.statusCode = 200;
    res.end?.();
    return;
  }

  const pathname = normalizePathname(req.url || req.path || '/');
  const method = String(req.method || 'GET').toUpperCase();

  try {
    if (pathname === '/api/health' && method === 'GET') {
      return await handleHealth(req, res, { requestId });
    }
    if (pathname === '/api/auth/login' && method === 'POST') {
      return await handleAuthLogin(req, res, { requestId });
    }
    if (pathname === '/api/auth/demo-session' && method === 'POST') {
      return await handleAuthDemoSession(req, res, { requestId });
    }
    if ((pathname === '/api/ai/chat' || pathname === '/api/ai/chat/stream') && method === 'POST') {
      return await handleAiChat(req, res, { requestId });
    }
    if (pathname === '/api/ai/orion-assist' && method === 'POST') {
      return await handleOrionAssist(req, res, { requestId });
    }
    if (pathname === '/api/orion/execute' && method === 'POST') {
      try {
        return await handleOrionExecute(req, res, { requestId });
      } catch (orionErr: any) {
        const reason = normalizePublicErrorMessage(orionErr, 'Orion execution failed on server.');
        return forceJson(res, 502, {
          success: false,
          status: 'failed',
          error: { code: 'ORION_EXECUTE_ERROR', message: reason, requestId },
          message: reason,
          requestId,
          finalResponse: reason,
        });
      }
    }
    if (pathname === '/api/ai/notes' && method === 'POST') {
      return await handleAiNotes(req, res, { requestId });
    }
    if (pathname === '/api/ai/search' && method === 'POST') {
      return await handleAiSearch(req, res, { requestId });
    }
    if (pathname === '/api/ai/magic-draw' && method === 'POST') {
      return await handleAiMagicDraw(req, res, { requestId });
    }
    if (pathname === '/api/ai/handwriting-formula' && method === 'POST') {
      return await handleAiHandwritingFormula(req, res, { requestId });
    }
    if (pathname === '/api/ai/image-to-note' && method === 'POST') {
      return await handleAiImageToNote(req, res, { requestId });
    }
    if (pathname === '/api/ai/usage-status' && method === 'GET') {
      return await handleAiUsageStatus(req, res, { requestId });
    }
    if (pathname === '/api/ai/redeem-voucher' && method === 'POST') {
      return await handleAiRedeemVoucher(req, res, { requestId });
    }
    if (pathname === '/api/admin/ai-limits' && method === 'POST') {
      return await handleAdminAiLimits(req, res, { requestId });
    }
    if (pathname === '/api/debug/nvidia') {
      return sendJson(
        res,
        410,
        buildErrorEnvelope({
          code: 'ENDPOINT_RETIRED',
          message: 'Diagnostic endpoint removed. Veylentra uses Ministral, Groq, and Z.ai.',
          requestId,
        })
      );
    }

    try {
      if (!cachedServerApp) {
        const serverPath = '../dist/server.cjs';
        const serverModule: any = await import(/* @vite-ignore */ serverPath);
        cachedServerApp = serverModule.app || serverModule.default || serverModule;
      }
      if (typeof cachedServerApp === 'function') {
        return cachedServerApp(req, res);
      }
    } catch {
      // Fallback bundle not present in lightweight serverless unit tests
    }

    return sendJson(
      res,
      404,
      buildErrorEnvelope({
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${pathname} was not found.`,
        requestId,
      })
    );
  } catch (err: any) {
    const reason = normalizePublicErrorMessage(err, 'Serverless handler failed to process request.');
    return forceJson(
      res,
      502,
      buildErrorEnvelope({
        code: 'SERVERLESS_EXECUTION_ERROR',
        message: reason,
        requestId,
        statusText: 'failed',
      })
    );
  }
}
