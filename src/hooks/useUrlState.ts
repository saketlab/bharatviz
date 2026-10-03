import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Builds from window.location so several writes in one tick all land.
export function useUrlState<T extends string = string>(key: string, fallback: NoInfer<T>): [T, (value: T) => void] {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setValue = useCallback((value: T) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set(key, value); else next.delete(key);
    navigate({ search: next.toString() }, { replace: true });
  }, [key, navigate]);

  const current = params.get(key) as T | null;
  useEffect(() => {
    if (current === null && fallback) setValue(fallback);
  }, [current, fallback, setValue]);

  return [current ?? fallback, setValue];
}
