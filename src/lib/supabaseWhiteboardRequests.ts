/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Whiteboard Visual Request Service (3D Models & SVGs)
 * Handles persistence to Supabase and StudentOS backend API with school isolation and RLS.
 */

import { supabase } from './supabase';

export interface WhiteboardVisualRequest {
  id: string;
  requestType: '3d' | 'svg';
  topic: string;
  subject: string;
  description: string;
  grade?: string;
  whyNeeded?: string;
  urgency: 'normal' | 'urgent';
  status: 'Requested' | 'Under Review' | 'In Progress' | 'Ready' | 'Rejected';
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  schoolId: string;
  schoolName: string;
  createdAt: string;
  notes?: string;
}

export interface CreateVisualRequestInput {
  requestType: '3d' | 'svg';
  topic: string;
  subject: string;
  description: string;
  grade?: string;
  whyNeeded?: string;
  urgency: 'normal' | 'urgent';
  requesterId?: string;
  requesterName?: string;
  requesterRole?: string;
  schoolId?: string;
  schoolName?: string;
}

/**
 * Submits a new 3D model or SVG diagram request to StudentOS Supabase & Backend
 */
export async function submitVisualRequest(input: CreateVisualRequestInput): Promise<{ success: boolean; request?: WhiteboardVisualRequest; error?: string }> {
  try {
    const payload = {
      requestType: input.requestType,
      topic: input.topic.trim(),
      subject: input.subject.trim(),
      description: input.description.trim(),
      grade: (input.grade || '').trim(),
      whyNeeded: (input.whyNeeded || '').trim(),
      urgency: input.urgency,
      requesterId: input.requesterId || 'usr_anonymous',
      requesterName: input.requesterName || 'StudentOS User',
      requesterRole: input.requesterRole || 'Student',
      schoolId: input.schoolId || 'school_default',
      schoolName: input.schoolName || 'StudentOS School'
    };

    // 1. Attempt Supabase direct insert with RLS
    try {
      const { data: sbData, error: sbErr } = await supabase
        .from('whiteboard_asset_requests')
        .insert([{
          request_type: payload.requestType,
          topic: payload.topic,
          subject: payload.subject,
          description: payload.description,
          grade: payload.grade,
          why_needed: payload.whyNeeded,
          urgency: payload.urgency,
          status: 'Requested',
          requester_id: payload.requesterId,
          requester_name: payload.requesterName,
          requester_role: payload.requesterRole,
          school_id: payload.schoolId,
          school_name: payload.schoolName
        }])
        .select()
        .single();

      if (!sbErr && sbData) {
        console.log('[Supabase] Whiteboard visual request persisted directly:', sbData.id);
      }
    } catch (e) {
      // Supabase table may not exist in user's project yet; fall through to server API
      console.warn('[Supabase] Direct insert not available or table missing, relying on backend API:', e);
    }

    // 2. Submit to authenticated backend API
    const res = await fetch('/api/whiteboard/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data?.success && data?.request) {
      const req: WhiteboardVisualRequest = {
        id: data.request.id,
        requestType: data.request.requestType || input.requestType,
        topic: data.request.topic || input.topic,
        subject: data.request.subject || input.subject,
        description: data.request.description || input.description,
        grade: data.request.grade || input.grade,
        whyNeeded: data.request.purpose || input.whyNeeded,
        urgency: data.request.urgency || input.urgency,
        status: data.request.status || 'Requested',
        requesterId: data.request.requesterId || payload.requesterId,
        requesterName: data.request.requesterName || payload.requesterName,
        requesterRole: data.request.requesterRole || payload.requesterRole,
        schoolId: data.request.schoolId || payload.schoolId,
        schoolName: data.request.schoolName || payload.schoolName,
        createdAt: data.request.createdDate || new Date().toISOString(),
        notes: data.request.notes
      };
      return { success: true, request: req };
    }

    return { success: false, error: data?.error || 'Failed to submit request' };
  } catch (err: any) {
    console.error('submitVisualRequest error:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}

/**
 * Fetches visual requests with school isolation and role check
 */
export async function fetchVisualRequests(options?: {
  schoolId?: string;
  requesterId?: string;
  role?: string;
}): Promise<WhiteboardVisualRequest[]> {
  try {
    const params = new URLSearchParams();
    if (options?.schoolId) params.set('schoolId', options.schoolId);
    if (options?.requesterId) params.set('requesterId', options.requesterId);
    if (options?.role) params.set('role', options.role);

    const res = await fetch(`/api/whiteboard/requests?${params.toString()}`);
    const data = await res.json();
    if (data?.success && Array.isArray(data.requests)) {
      return data.requests.map((r: any) => ({
        id: r.id,
        requestType: r.requestType || '3d',
        topic: r.topic,
        subject: r.subject,
        description: r.description,
        grade: r.grade,
        whyNeeded: r.purpose || r.whyNeeded,
        urgency: r.urgency,
        status: r.status,
        requesterId: r.requesterId || '',
        requesterName: r.requesterName,
        requesterRole: r.requesterRole,
        schoolId: r.schoolId,
        schoolName: r.schoolName,
        createdAt: r.createdDate || r.createdAt || new Date().toISOString(),
        notes: r.notes
      }));
    }
  } catch (err) {
    console.error('fetchVisualRequests error:', err);
  }
  return [];
}

/**
 * Updates a visual request status (Super Admin / Admin workflow)
 */
export async function updateVisualRequestStatus(
  id: string,
  status: WhiteboardVisualRequest['status'],
  notes?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/whiteboard/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });
    return res.ok;
  } catch (err) {
    console.error('updateVisualRequestStatus error:', err);
    return false;
  }
}
