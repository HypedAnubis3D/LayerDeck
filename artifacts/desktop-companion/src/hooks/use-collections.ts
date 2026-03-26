import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './use-auth';
import { Parsed3MF } from '@/lib/3mf-parser';

function safeParse<T>(jsonStr: string, fallback: T): T {
  try {
    return jsonStr ? JSON.parse(jsonStr) : fallback;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    return fallback;
  }
}

export function useDashboardMetrics() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-metrics', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ha3d_user_data')
        .select('collection, payload')
        .eq('user_id', user!.id);

      if (error) throw error;

      const metrics = {
        catalogCount: 0,
        openOrdersCount: 0,
        activePrintJobs: 0,
        spoolCount: 0,
        upcomingConventions: 0,
        libraryCount: 0,
      };

      if (!data) return metrics;

      data.forEach(row => {
        if (row.collection === 'catalog') {
          const catalog = safeParse<any[]>(row.payload, []);
          metrics.catalogCount = catalog.length;
        } else if (row.collection === 'tmfLib') {
          const library = safeParse<any[]>(row.payload, []);
          metrics.libraryCount = library.length;
        } else if (row.collection === 'orders') {
          const orders = safeParse<any[]>(row.payload, []);
          metrics.openOrdersCount = orders.filter(o => o.status !== 'complete' && o.status !== 'cancelled').length;
        } else if (row.collection === 'printQueue') {
          const queue = safeParse<any[]>(row.payload, []);
          metrics.activePrintJobs = queue.filter(q => q.status === 'printing' || q.status === 'queued').length;
        } else if (row.collection === 'spools') {
          const spools = safeParse<any[]>(row.payload, []);
          metrics.spoolCount = spools.length;
        } else if (row.collection === 'conventions') {
          const conventions = safeParse<any[]>(row.payload, []);
          const today = new Date().toISOString().split('T')[0];
          metrics.upcomingConventions = conventions.filter(c => c.date >= today).length;
        }
      });

      return metrics;
    }
  });
}

const TMF_COLLECTION = 'tmfLib';

async function fetchLibrary(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('ha3d_user_data')
    .select('payload')
    .eq('user_id', userId)
    .eq('collection', TMF_COLLECTION)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return safeParse(data?.payload ?? '[]', []);
}

async function saveLibrary(userId: string, items: any[]): Promise<void> {
  const { error } = await supabase
    .from('ha3d_user_data')
    .upsert({
      user_id: userId,
      collection: TMF_COLLECTION,
      payload: JSON.stringify(items),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,collection' });

  if (error) throw error;
}

export function useLibrary() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['library3mf', user?.id],
    enabled: !!user?.id,
    queryFn: () => fetchLibrary(user!.id),
  });
}

export function useAddToLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: Parsed3MF) => {
      if (!user) throw new Error("Not authenticated");

      const existing = await fetchLibrary(user.id);
      const alreadyIn = existing.some((e: any) => e.filename === file.filename);
      if (alreadyIn) return;

      const hrs = file.printTimeEstimate
        ? (() => {
            const m = file.printTimeEstimate.match(/(\d+)h\s*(\d+)m/);
            return m ? parseFloat((parseInt(m[1]) + parseInt(m[2]) / 60).toFixed(2)) : null;
          })()
        : null;

      const newItem = {
        id: crypto.randomUUID(),
        filename: file.filename,
        name: file.modelName || file.filename.replace(/\.3mf$/i, ''),
        objects: file.objectsCount,
        hrs,
        hasGcode: !!hrs,
        uploadedAt: Date.now(),
      };

      await saveLibrary(user.id, [...existing, newItem]);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library3mf'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    }
  });
}

export function useAddAllToLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: Parsed3MF[]) => {
      if (!user) throw new Error("Not authenticated");

      const existing = await fetchLibrary(user.id);
      const existingNames = new Set(existing.map((e: any) => e.filename));

      const newItems = files
        .filter(f => f.status === 'ready' && !existingNames.has(f.filename))
        .map(f => {
          const hrs = f.printTimeEstimate
            ? (() => {
                const m = f.printTimeEstimate!.match(/(\d+)h\s*(\d+)m/);
                return m ? parseFloat((parseInt(m[1]) + parseInt(m[2]) / 60).toFixed(2)) : null;
              })()
            : null;
          return {
            id: crypto.randomUUID(),
            filename: f.filename,
            name: f.modelName || f.filename.replace(/\.3mf$/i, ''),
            objects: f.objectsCount,
            hrs,
            hasGcode: !!hrs,
            uploadedAt: Date.now(),
          };
        });

      if (newItems.length === 0) return { added: 0 };

      await saveLibrary(user.id, [...existing, ...newItems]);
      return { added: newItems.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library3mf'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    }
  });
}

export function usePullLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      return fetchLibrary(user.id);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['library3mf', user?.id], data);
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    }
  });
}

export function usePushLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: any[]) => {
      if (!user) throw new Error("Not authenticated");
      await saveLibrary(user.id, items);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library3mf'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    }
  });
}
