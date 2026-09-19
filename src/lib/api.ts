import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../../shared/types';

async function request(path: string, body?: unknown): Promise<AppState> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Demo-Request': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const wait = result?.retryAfter ? ` Повторите через ${result.retryAfter} сек.` : '';
    throw new Error((result?.error || 'Не удалось выполнить запрос. Попробуйте еще раз.') + wait);
  }
  if (!result?.session) throw new Error('Сервер вернул неполные данные. Обновите страницу.');
  return result as AppState;
}

let bootstrap: Promise<AppState> | null = null;
function initialRequest() {
  if (!bootstrap)
    bootstrap = request('/api/state').finally(() => {
      bootstrap = null;
    });
  return bootstrap;
}

export function useDemo(refreshMs = 0) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const alive = useRef(false);
  const writing = useRef(false);
  const sequence = useRef(0);

  const reload = useCallback(async () => {
    if (writing.current) return;
    const current = ++sequence.current;
    try {
      const result = await initialRequest();
      if (alive.current && sequence.current === current) {
        setState(result);
        setError('');
      }
    } catch (cause) {
      if (alive.current && sequence.current === current)
        setError(cause instanceof Error ? cause.message : 'Нет соединения с сервером.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    const timer = refreshMs
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') void reload();
        }, refreshMs)
      : undefined;
    return () => {
      alive.current = false;
      ++sequence.current;
      if (timer) window.clearInterval(timer);
    };
  }, [reload, refreshMs]);

  const mutate = useCallback(async (path: string, body: unknown = {}, success = '') => {
    if (writing.current) return null;
    writing.current = true;
    ++sequence.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(path, body);
      if (alive.current) {
        setState(result);
        if (success) setNotice(success);
      }
      return result;
    } catch (cause) {
      if (alive.current)
        setError(
          cause instanceof Error ? cause.message : 'Нет соединения с сервером. Попробуйте еще раз.',
        );
      return null;
    } finally {
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  }, []);
  return { state, error, notice, busy, loading, reload, mutate, clearError: () => setError('') };
}
export type DemoController = ReturnType<typeof useDemo>;
