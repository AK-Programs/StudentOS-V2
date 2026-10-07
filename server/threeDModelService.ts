/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudentOS Verified 3D Model Library & Request Management Service
 * Manages verified ready-made 3D models and Super Admin 3D model request workflow.
 */

import fs from 'fs';
import path from 'path';
import { Educational3DScene, generateEducational3DScene } from './whiteboardVisualEngine';

export interface ThreeDModelRequest {
  id: string;
  topic: string;
  subject: string;
  description: string;
  purpose: string;
  grade: string;
  urgency: 'normal' | 'urgent';
  requesterName: string;
  requesterRole: string;
  schoolId: string;
  schoolName: string;
  status: 'Requested' | 'Under Review' | 'In Progress' | 'Ready' | 'Rejected';
  createdDate: string;
  notes?: string;
  completedModelData?: any;
}

const STORAGE_FILE = path.join(process.cwd(), 'data_3d_requests.json');

let requestsMemory: ThreeDModelRequest[] = [
  {
    id: 'req_sample_1',
    topic: 'Meristematic Tissue 3D Model',
    subject: 'Botany / Plant Anatomy',
    description: 'Detailed 3D cellular breakdown of apical meristem dome, procambium strand, and protoderm with dividing nuclei.',
    purpose: 'Grade 9 Biology Mitosis & Plant Growth Lesson',
    grade: 'Grade 9',
    urgency: 'urgent',
    requesterName: 'Sarah Jenkins',
    requesterRole: 'Teacher',
    schoolId: 'school_delhi_01',
    schoolName: 'Delhi Public School',
    status: 'Ready',
    createdDate: new Date(Date.now() - 86400000 * 2).toISOString(),
    notes: 'Verified 3D model added to verified library.'
  },
  {
    id: 'req_sample_2',
    topic: 'Nephron Ultrastructure 3D Model',
    subject: 'Human Physiology',
    description: 'Renal corpuscle, Bowman capsule, glomerulus capillaries, proximal/distal convoluted tubules.',
    purpose: 'Excretory system deep dive lecture',
    grade: 'Grade 11',
    urgency: 'normal',
    requesterName: 'Dr. Rajesh Sharma',
    requesterRole: 'Teacher',
    schoolId: 'school_mumbai_04',
    schoolName: 'St. Xavier High School',
    status: 'Under Review',
    createdDate: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

function loadRequestsFromFile() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        requestsMemory = parsed;
      }
    }
  } catch (err) {
    console.warn('[3D Model Service] Could not load persisted requests file:', err);
  }
}

function saveRequestsToFile() {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(requestsMemory, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[3D Model Service] Could not save requests file:', err);
  }
}

loadRequestsFromFile();

export function getAllThreeDRequests(): ThreeDModelRequest[] {
  return [...requestsMemory];
}

export function createThreeDRequest(data: Omit<ThreeDModelRequest, 'id' | 'status' | 'createdDate'>): ThreeDModelRequest {
  const newReq: ThreeDModelRequest = {
    ...data,
    id: 'req3d_' + Math.random().toString(36).substring(2, 10),
    status: 'Requested',
    createdDate: new Date().toISOString()
  };

  requestsMemory.unshift(newReq);
  saveRequestsToFile();

  console.log(`[3D MODEL REQUEST CREATED] ID=${newReq.id} Topic="${newReq.topic}" Urgency=${newReq.urgency} Requester="${newReq.requesterName}"`);
  return newReq;
}

export function updateThreeDRequestStatus(
  id: string,
  updates: Partial<Pick<ThreeDModelRequest, 'status' | 'notes' | 'completedModelData'>>
): ThreeDModelRequest | null {
  const item = requestsMemory.find(r => r.id === id);
  if (!item) return null;

  if (updates.status) item.status = updates.status;
  if (updates.notes !== undefined) item.notes = updates.notes;
  if (updates.completedModelData !== undefined) item.completedModelData = updates.completedModelData;

  saveRequestsToFile();
  console.log(`[3D MODEL REQUEST UPDATED] ID=${id} Status="${item.status}"`);
  return item;
}

/**
 * Returns the Catalog of Verified Ready-Made 3D Models
 */
export async function getVerified3DModelsCatalog(): Promise<{ id: string; title: string; subject: string; description: string; scene: Educational3DScene }[]> {
  const topics = [
    { query: 'DNA Double Helix', subject: 'Genetics' },
    { query: 'Meristematic Tissue', subject: 'Botany' },
    { query: 'Chloroplast Ultrastructure', subject: 'Cell Biology' },
    { query: 'Human Heart', subject: 'Anatomy' },
    { query: 'Solar System', subject: 'Astronomy' },
    { query: 'Inclined Plane Forces', subject: 'Physics' },
  ];

  const catalog = [];
  for (const t of topics) {
    const scene = await generateEducational3DScene(t.query);
    catalog.push({
      id: scene.id,
      title: scene.title,
      subject: scene.subject || t.subject,
      description: scene.summary,
      scene
    });
  }

  return catalog;
}
