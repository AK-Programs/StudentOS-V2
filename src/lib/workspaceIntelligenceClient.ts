/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Authenticated client helpers for Material Hub Intelligence & Assignment Center Upgrade APIs.
 */

import { supabase } from './supabase';
import { UserProfile } from '../types';

export async function buildWorkspaceAuthHeaders(user?: UserProfile | null, roleOverride?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Session optional in preview/guest fallback
  }

  if (user) {
    const uid = user.uid || user.email || '';
    if (uid) headers['x-veylentra-uid'] = uid;
    const role = roleOverride || user.role || 'student';
    headers['x-veylentra-role'] = String(role);
    if (user.name) headers['x-veylentra-name'] = String(user.name);
    if (user.email) headers['x-veylentra-email'] = String(user.email);
    if (user.grade) headers['x-veylentra-grade'] = String(user.grade);
    if (user.section) headers['x-veylentra-section'] = String(user.section);
  }
  return headers;
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
