import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowLeft, ArrowClockwise, X } from '@phosphor-icons/react';
import type { DemoController } from '../lib/api';
import '../demos.css';

export const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
export const dateTime = (value: string) =>
  new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
export const productImage = (slug: string) => `/images/products/${slug}.jpg`;

export function DemoBanner({ demo, slug }: { demo: DemoController; slug: string }) {
  return (
    <>
      <div className="demo-banner">
        <div className="demo-banner-leading">
          <a href="/">
            <ArrowLeft size={13} /> qorexdev
          </a>
          <span className="demo-banner-mark">Демонстрационный проект. Данные вымышлены.</span>
        </div>
        <div className="demo-banner-actions">
          <a href={`/work/${slug}`}>О проекте</a>
          {demo.state && (
            <label>
              Роль{' '}
              <select
                aria-label="Демонстрационная роль"
                disabled={demo.busy}
                value={demo.state.session.role}
                onChange={(e) =>
                  void demo.mutate(
                    '/api/session/role',
                    { role: e.target.value },
                    'Демонстрационная роль изменена.',
                  )
                }
              >
                <option value="admin">Администратор</option>
                <option value="manager">Менеджер</option>
              </select>
            </label>
          )}
          <button
            disabled={demo.busy || !demo.state}
            onClick={() => {
              if (
                window.confirm(
                  'Сбросить ваши изменения во всех трех демопроектах? Начальные данные будут восстановлены.',
                )
              )
                void demo.mutate(
                  '/api/reset',
                  {},
                  'Демоданные восстановлены во всех трех проектах.',
                );
            }}
          >
            <ArrowClockwise size={12} /> Сбросить демо
          </button>
        </div>
      </div>
      {demo.notice && (
        <div className="demo-notice" role="status">
          {demo.notice}
        </div>
      )}
    </>
  );
}

export function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <div className="demo-error" role="alert">
      {error}
    </div>
  ) : null;
}
export function LoadingState({ demo }: { demo: DemoController }) {
  return (
    <main className="demo-state" id="main">
      <h1>{demo.error ? 'Не удалось загрузить демо' : 'Загружаем рабочее пространство'}</h1>
      <p className="muted">{demo.error || 'Подготавливаем вашу отдельную сессию.'}</p>
      {demo.error && (
        <button className="demo-btn" onClick={() => void demo.reload()}>
          Повторить загрузку
        </button>
      )}
    </main>
  );
}

export function Modal({
  title,
  onClose,
  children,
  error = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  error?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = prior;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="demo-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="demo-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button className="demo-icon-btn" aria-label="Закрыть окно" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="demo-dialog-body">
        <ErrorNotice error={error} />
        {children}
      </div>
    </dialog>
  );
}
