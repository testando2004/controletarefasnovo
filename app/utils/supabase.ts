import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Prefer service role key for server-side uploads.
    const supabaseKey =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Variáveis de ambiente do Supabase não configuradas. Configure SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY).'
      );
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  
  return supabaseClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return getSupabaseClient()[prop as keyof SupabaseClient];
  }
});

export async function uploadFile(
  file: File,
  path: string
): Promise<{ url: string; path: string }> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documentos';
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;
  
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });
  
  if (error) throw error;

  // Nunca gerar URL publica — todos os documentos sao servidos via signed URL
  return {
    url: '',
    path: filePath,
  };
}

export async function generateSignedUrl(
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documentos';
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      console.error('[Storage] Erro ao gerar signed URL:', error);
      return null;
    }
    return data.signedUrl;
  } catch (e) {
    console.error('[Storage] Erro ao gerar signed URL:', e);
    return null;
  }
}

export async function deleteFile(path: string): Promise<void> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'documentos';
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) throw error;
}

