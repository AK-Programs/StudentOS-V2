import { supabase } from './supabase';
import { MaterialResource } from '../types';

/**
 * Maps a MaterialResource frontend object to a DB row for public.materials
 */
function mapMaterialToRow(mat: MaterialResource) {
  const createdAtMs = typeof mat.created_at === 'number' 
    ? mat.created_at 
    : (mat.created_at ? new Date(mat.created_at).getTime() : Date.now());

  return {
    id: mat.id,
    title: mat.title || '',
    subject: mat.subject || '',
    category: mat.category || null,
    type: mat.type || '',
    url: mat.url || null,
    file_url: mat.fileUrl || mat.file_url || null,
    attachment_url: mat.attachment_url || null,
    storage_path: mat.storagePath || null,
    file_name: mat.fileName || null,
    file_type: mat.fileType || null,
    file_size: mat.fileSize || null,
    description: mat.description || '',
    uploaded_by: mat.uploadedBy || '',
    uploader_uid: mat.uploaderUid || null,
    uploader_house: mat.uploaderHouse || null,
    uploader_section: mat.uploaderSection || null,
    created_at: createdAtMs,
    created_at_date: mat.createdAt || new Date().toISOString().split('T')[0],
    class_grade: mat.classGrade || null,
    class_section: mat.classSection || null,
    due_date: mat.dueDate || null,
    is_public: mat.isPublic ?? true,
    visibility: mat.visibility || 'student',
    visible_to_grades: mat.visibleToGrades || [],
    visible_to_sections: mat.visibleToSections || [],
    visible_to_houses: mat.visibleToHouses || [],
    downloads: mat.downloads ?? 0,
    likes: mat.likes ?? 0,
    liked_by: mat.likedBy || [],
    views: mat.views ?? 1,
    is_verified: mat.isVerified ?? false,
    comments: mat.comments || [],
    question_paper_year: mat.questionPaperYear || null,
    ai_summary: mat.aiSummary || null,
    ai_quiz: mat.aiQuiz || null,
    raw_data: mat // Store the whole object as backup
  };
}

/**
 * Maps a DB row from public.materials to a frontend MaterialResource object
 */
function mapRowToMaterial(row: any): MaterialResource {
  const backup = row.raw_data || {};
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    category: row.category,
    type: row.type,
    url: row.url || row.file_url || row.attachment_url || backup.url,
    fileUrl: row.file_url || backup.fileUrl,
    file_url: row.file_url || backup.file_url,
    attachment_url: row.attachment_url || backup.attachment_url,
    storagePath: row.storage_path || backup.storagePath,
    fileName: row.file_name || backup.fileName,
    fileType: row.file_type || backup.fileType,
    fileSize: row.file_size || backup.fileSize,
    description: row.description,
    uploadedBy: row.uploaded_by || row.uploadedBy || backup.uploadedBy || 'Unknown',
    uploaderUid: row.uploader_uid || backup.uploaderUid,
    uploaderHouse: row.uploader_house || backup.uploaderHouse,
    uploaderSection: row.uploader_section || backup.uploaderSection,
    createdAt: row.created_at_date || backup.createdAt || new Date().toISOString().split('T')[0],
    created_at: row.created_at || backup.created_at,
    classGrade: row.class_grade || backup.classGrade,
    classSection: row.class_section || backup.classSection,
    dueDate: row.due_date || backup.dueDate,
    isPublic: row.is_public ?? backup.isPublic,
    visibility: row.visibility || backup.visibility,
    visibleToGrades: row.visible_to_grades || backup.visibleToGrades || [],
    visibleToSections: row.visible_to_sections || backup.visibleToSections || [],
    visibleToHouses: row.visible_to_houses || backup.visibleToHouses || [],
    downloads: row.downloads ?? backup.downloads ?? 0,
    likes: row.likes ?? backup.likes ?? 0,
    likedBy: row.liked_by || backup.likedBy || [],
    views: row.views ?? backup.views ?? 1,
    isVerified: row.is_verified ?? backup.isVerified ?? false,
    comments: row.comments || backup.comments || [],
    questionPaperYear: row.question_paper_year || backup.questionPaperYear,
    aiSummary: row.ai_summary || backup.aiSummary,
    aiQuiz: row.ai_quiz || backup.aiQuiz,
  };
}

// ==================== LOCAL STORAGE BACKUP FOR MATERIALS ====================

const LOCAL_MATERIALS_KEY = 's_os_materials';







/**
 * ---------------- MATERIALS OPERATIONS ----------------
 */

export async function getSupabaseMaterials(): Promise<MaterialResource[]> {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        console.warn('[SUPABASE-RESOURCES] Table "materials" does not exist — using localStorage backup.');
        return [];
      }
      throw error;
    }

    if (data && data.length > 0) {
      const remoteList = data.map(mapRowToMaterial);
      // Merge with local-only items (uploaded but not yet synced)
      const local = [];
      const remoteIds = new Set(remoteList.map(m => m.id));
      const localOnly = local.filter(m => !remoteIds.has(m.id));
      const merged = [...localOnly, ...remoteList].sort((a, b) => {
        const tA = typeof a.created_at === 'number' ? a.created_at : 0;
        const tB = typeof b.created_at === 'number' ? b.created_at : 0;
        return tB - tA;
      });
      console.log(`[SUPABASE-RESOURCES] Loaded ${remoteList.length} from Supabase + ${localOnly.length} local-only materials.`);
      return merged;
    }
    // Supabase returned 0 rows (table may exist but be empty or blocked by RLS)
    const local = [];
    if (local.length > 0) {
      console.log(`[SUPABASE-RESOURCES] Supabase returned 0 rows — serving ${local.length} materials from localStorage.`);
    }
    return local;
  } catch (err) {
    console.error('[SUPABASE-RESOURCES] Failed to fetch materials — falling back to localStorage:', err);
    return [];
  }
}

export async function saveSupabaseMaterial(mat: MaterialResource): Promise<void> {
  // Always save locally first so materials survive even without Supabase tables
  

  const row = mapMaterialToRow(mat);
  try {
    const { error } = await supabase
      .from('materials')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      if (error.code === '42P01') {
        console.warn('[SUPABASE-RESOURCES] Table "materials" does not exist — saved to localStorage only.');
        return;
      }
      // RLS or other error — still OK, localStorage has it
      console.warn('[SUPABASE-RESOURCES] Supabase save failed (may be RLS) — saved to localStorage only:', error.message);
      return;
    }
    console.log('[SUPABASE-RESOURCES] Saved material to Supabase successfully!');
  } catch (err) {
    console.warn('[SUPABASE-RESOURCES] Network error saving material — saved to localStorage only:', err);
  }
}

export async function deleteSupabaseMaterial(id: string): Promise<void> {
  
  try {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '42P01') return;
      console.warn('[SUPABASE-RESOURCES] Delete from Supabase failed:', error.message);
      return;
    }
  } catch (err) {
    console.warn('[SUPABASE-RESOURCES] Failed to delete from Supabase:', err);
  }
}

/**
 * ---------------- ASSIGNMENTS & RESOURCES OPERATIONS ----------------
 */

function mapResourceToRow(res: any) {
  const createdAtMs = typeof res.created_at === 'number' 
    ? res.created_at 
    : (res.createdAt ? new Date(res.createdAt).getTime() : Date.now());

  return {
    id: res.id,
    title: res.title || '',
    content: res.content || res.description || '',
    description: res.description || res.content || '',
    type: res.type || 'resource',
    resource_type: res.resourceType || res.type || 'resource',
    target_grade: res.targetGrade || res.class || 'All Grades',
    class: res.class || res.targetGrade || 'All Grades',
    target_section: res.targetSection || res.section || 'All Sections',
    section: res.section || res.targetSection || 'All Sections',
    url: res.url || res.fileUrl || res.fileData || null,
    file_url: res.fileUrl || res.url || null,
    file_data: res.fileData || res.url || null,
    storage_path: res.storagePath || null,
    gallery_urls: res.galleryUrls || [],
    file_name: res.fileName || null,
    created_at: createdAtMs,
    author: res.author || 'Teacher',
    raw_data: res
  };
}

function mapRowToResource(row: any): any {
  const backup = row.raw_data || {};
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    description: row.description,
    type: row.type,
    resourceType: row.resource_type || row.type,
    targetGrade: row.target_grade || row.class,
    class: row.class || row.target_grade,
    targetSection: row.target_section || row.section,
    section: row.section || row.target_section,
    url: row.url || row.file_url || row.file_data || backup.url,
    fileUrl: row.file_url || backup.fileUrl,
    fileData: row.file_data || backup.fileData,
    storagePath: row.storage_path || backup.storagePath,
    galleryUrls: row.gallery_urls || backup.galleryUrls || [],
    fileName: row.file_name || backup.fileName,
    createdAt: row.created_at || backup.createdAt,
    created_at: row.created_at || backup.created_at,
    author: row.author || backup.author
  };
}

export async function getSupabaseResources(tableName: 'assignments' | 'school_resources'): Promise<any[]> {
  console.log(`[SUPABASE-RESOURCES] Fetching ${tableName}...`);
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        console.warn(`[SUPABASE-RESOURCES] Table "${tableName}" does not exist yet.`);
        return [];
      }
      throw error;
    }

    if (data) {
      console.log(`[SUPABASE-RESOURCES] Loaded ${data.length} records from ${tableName}.`);
      return data.map(mapRowToResource);
    }
    return [];
  } catch (err) {
    console.error(`[SUPABASE-RESOURCES] Failed to fetch ${tableName}:`, err);
    return [];
  }
}

export async function saveSupabaseResource(tableName: 'assignments' | 'school_resources', res: any): Promise<void> {
  console.log(`[SUPABASE-RESOURCES] Saving to ${tableName}:`, res.id, res.title);
  const row = mapResourceToRow(res);
  try {
    const { error } = await supabase
      .from(tableName)
      .upsert(row, { onConflict: 'id' });

    if (error) {
      if (error.code === '42P01') {
        console.warn(`[SUPABASE-RESOURCES] Table "${tableName}" does not exist yet.`);
        return;
      }
      throw error;
    }
    console.log(`[SUPABASE-RESOURCES] Saved resource to ${tableName} successfully!`);
  } catch (err) {
    console.error(`[SUPABASE-RESOURCES] Failed to save resource to ${tableName}:`, err);
  }
}

export async function deleteSupabaseResource(tableName: 'assignments' | 'school_resources', id: string): Promise<void> {
  console.log(`[SUPABASE-RESOURCES] Deleting from ${tableName}:`, id);
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '42P01') return;
      throw error;
    }
    console.log(`[SUPABASE-RESOURCES] Deleted from ${tableName} successfully!`);
  } catch (err) {
    console.error(`[SUPABASE-RESOURCES] Failed to delete from ${tableName}:`, err);
  }
}

export async function getSupabaseTableData(tableName: string): Promise<any[]> {
  console.log(`[SUPABASE-RESOURCES] Fetching ${tableName}...`);
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*');

    if (error) {
      if (error.code === '42P01') {
        console.warn(`[SUPABASE-RESOURCES] Table "${tableName}" does not exist yet.`);
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error(`[SUPABASE-RESOURCES] Failed to fetch ${tableName}:`, err);
    return [];
  }
}

export async function upsertSupabaseTableData(tableName: string, data: any): Promise<void> {
  console.log(`[SUPABASE-RESOURCES] Saving to ${tableName}:`, data.id);
  try {
    const { error } = await supabase
      .from(tableName)
      .upsert(data, { onConflict: 'id' });

    if (error) {
      throw error;
    }
  } catch (err) {
    console.error(`[SUPABASE-RESOURCES] Failed to save to ${tableName}:`, err);
  }
}
