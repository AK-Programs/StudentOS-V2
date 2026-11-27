/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Canonical Server Runtime Supabase Config
 * Shared across Express (server.ts) and Vercel Serverless (api/index.ts).
 */

import {
  WORKING_ANON_KEY,
  isKnownInvalidSupabaseKey,
  verifiedServiceRoleKeys,
  probeServiceRoleKey,
} from './supabaseKeyManager.js';

export function getSupabaseServerConfig(): { url: string; key: string } {
  const url = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://zwpoutanhsujezglbson.supabase.co'
  ).trim();

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRoleKey && !isKnownInvalidSupabaseKey(serviceRoleKey, url)) {
    if (verifiedServiceRoleKeys.has(serviceRoleKey)) {
      return { url, key: serviceRoleKey };
    }
    if (process.env.NODE_ENV !== 'test') {
      void probeServiceRoleKey(url, serviceRoleKey);
    }
  }

  const candidateAnonKeys = [
    process.env.SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.SUPABASE_KEY,
  ];

  let selectedKey = WORKING_ANON_KEY;
  for (const cand of candidateAnonKeys) {
    if (!isKnownInvalidSupabaseKey(cand, url)) {
      selectedKey = cand!.trim();
      break;
    }
  }

  return {
    url,
    key: selectedKey,
  };
}
