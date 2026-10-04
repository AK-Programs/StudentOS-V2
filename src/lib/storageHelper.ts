import { supabase } from './supabase';

export const uploadFileToStorage = async (file: File, pathPrefix: string = 'materials'): Promise<{ url: string, path: string }> => {
  const bucketName = 'StudentOS'; // Exact Supabase storage bucket name
  console.log(`UPLOAD STEP 2: uploadFileToStorage called for file "${file.name}" to bucket "${bucketName}" folder "${pathPrefix}"`);
  
  const fileExt = file.name.split('.').pop() || 'bin';
  const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${pathPrefix}/${Math.random()}_${cleanName}`;
  
  try {
    console.log(
      "UPLOAD START",
      bucketName,
      filePath,
      file?.name,
      file?.size,
      file?.type,
      "supabaseUrl:", (import.meta as any).env.VITE_SUPABASE_URL
    );
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error(`UPLOAD STEP 3: Supabase upload failure. Error: ${uploadError.message} (status: ${uploadError.status})`);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    console.log(`UPLOAD STEP 3: Supabase upload success. Path in bucket: "${filePath}"`, data);

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    console.log(`UPLOAD STEP 4: public URL generated: "${publicUrl}"`);
    return { url: publicUrl, path: filePath };
  } catch (err: any) {
    console.error(`UPLOAD STEP 3: Supabase upload failure exception.`, err);
    throw err;
  }
};
