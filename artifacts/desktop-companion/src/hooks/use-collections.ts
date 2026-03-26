import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from './use-auth';

// Helper to safely parse JSON
function safeParse<T>(jsonStr: string, fallback: T): T {
  try {
    return jsonStr ? JSON.parse(jsonStr) : fallback;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    return fallback;
  }
}

// Hook to get all key metrics for the dashboard
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

      // Initialize default metrics
      const metrics = {
        catalogCount: 0,
        openOrdersCount: 0,
        activePrintJobs: 0,
        spoolCount: 0,
        upcomingConventions: 0
      };

      if (!data) return metrics;

      data.forEach(row => {
        if (row.collection === 'catalog') {
          const catalog = safeParse<any[]>(row.payload, []);
          metrics.catalogCount = catalog.length;
        } 
        else if (row.collection === 'orders') {
          const orders = safeParse<any[]>(row.payload, []);
          metrics.openOrdersCount = orders.filter(o => o.status !== 'complete' && o.status !== 'cancelled').length;
        }
        else if (row.collection === 'printQueue') {
          const queue = safeParse<any[]>(row.payload, []);
          metrics.activePrintJobs = queue.filter(q => q.status === 'printing' || q.status === 'queued').length;
        }
        else if (row.collection === 'spools') {
          const spools = safeParse<any[]>(row.payload, []);
          metrics.spoolCount = spools.length;
        }
        else if (row.collection === 'conventions') {
          const conventions = safeParse<any[]>(row.payload, []);
          const today = new Date().toISOString().split('T')[0];
          metrics.upcomingConventions = conventions.filter(c => c.date >= today).length;
        }
      });

      return metrics;
    }
  });
}

// Hook to add a new item to the catalog collection
export function useAddToCatalog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newItem: { name: string, file3mf: string, sku?: string, description?: string }) => {
      if (!user) throw new Error("Not authenticated");

      // 1. Fetch current catalog
      const { data: existingData, error: fetchError } = await supabase
        .from('ha3d_user_data')
        .select('payload')
        .eq('user_id', user.id)
        .eq('collection', 'catalog')
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      let catalogArray: any[] = [];
      if (existingData?.payload) {
        catalogArray = safeParse(existingData.payload, []);
      }

      // 2. Append new item
      const itemToInsert = {
        id: crypto.randomUUID(),
        ...newItem,
        dateAdded: new Date().toISOString()
      };
      
      catalogArray.push(itemToInsert);

      // 3. Upsert back to database
      const { error: upsertError } = await supabase
        .from('ha3d_user_data')
        .upsert({
          user_id: user.id,
          collection: 'catalog',
          payload: JSON.stringify(catalogArray),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,collection' });

      if (upsertError) throw upsertError;
      
      return itemToInsert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    }
  });
}
