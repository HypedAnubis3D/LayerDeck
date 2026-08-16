import { supabase } from './supabase';

/**
 * ha3d_user_data stores one row per (user_id, collection), where `payload`
 * is the entire collection serialized as a JSON array string. There is no
 * per-row CRUD — callers fetch the whole array, mutate it in memory, and
 * write the whole array back. This mirrors the web app (studio-manager)
 * exactly so both clients stay compatible.
 */

export async function getCollection<T>(collection: string): Promise<T[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('user_id', user.id)
    .eq('collection', collection)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return [];

  try {
    const parsed = JSON.parse(data.payload);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// A handful of collections (e.g. 'printerHub') store a single config object
// rather than an array of items — same table, different payload shape.
export async function getConfigObject<T>(collection: string): Promise<T | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('user_id', user.id)
    .eq('collection', collection)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) return null;

  try {
    return JSON.parse(data.payload) as T;
  } catch {
    return null;
  }
}

export async function setCollection<T>(collection: string, items: T[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { error } = await supabase.from('ha3d_user_data').upsert({
    user_id: user.id,
    collection,
    payload: JSON.stringify(items),
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
