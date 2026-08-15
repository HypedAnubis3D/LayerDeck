import { useCallback, useEffect, useState } from 'react';
import { getCollection, setCollection } from './userData';

export function useCollection<T>(collection: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await getCollection<T>(collection);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, [collection]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (next: T[]) => {
      setItems(next);
      await setCollection(collection, next);
    },
    [collection]
  );

  return { items, setItems, loading, refreshing, error, refresh: () => load(true), save };
}
