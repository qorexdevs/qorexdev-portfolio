import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  Plus,
  ChartLine,
  Bell,
  ArrowDown,
  ArrowUp,
  ArrowClockwise,
  Trash,
  Clock,
  ShieldCheck,
} from '@phosphor-icons/react';
import type { CatalogProduct, Watch } from '../../shared/types';
import { useDemo, type DemoController } from '../lib/api';
import {
  DemoBanner,
  ErrorNotice,
  LoadingState,
  Modal,
  dateTime,
  money,
  productImage,
} from './Common';

export default function PriceWatch() {
  const demo = useDemo(8000);
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [checkAfter, setCheckAfter] = useState<Record<string, number>>({});
  const state = demo.state;
  const watches = state?.pricewatch.watches || [];
  const selected = watches.find((watch) => watch.id === selectedId) || watches[0];
  const product = state?.pricewatch.catalog.find((item) => item.id === selected?.productId);
  const unread = state?.pricewatch.alerts.filter((alert) => !alert.read).length || 0;
  const currentPrice = selected?.history.at(-1)?.price ?? product?.price ?? 0;
  const initialPrice = selected?.history[0]?.price ?? currentPrice;
  const percent = initialPrice ? ((currentPrice - initialPrice) / initialPrice) * 100 : 0;
  const nextIn = selected
    ? Math.max(0, Math.ceil((new Date(selected.nextCheckAt).getTime() - now) / 1000))
    : 0;
  const manualIn = selected
    ? Math.max(0, Math.ceil(((checkAfter[selected.id] || 0) - now) / 1000))
    : 0;
  const targetsMet = watches.filter(
    (watch) => (watch.history.at(-1)?.price ?? Infinity) <= watch.threshold,
  ).length;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="demo pricewatch">
      <DemoBanner demo={demo} slug="pricewatch" />
      {!state ? (
        <LoadingState demo={demo} />
      ) : (
        <main className="pricewatch-shell" id="main">
          <header className="pricewatch-header">
            <div className="pricewatch-brand">
              <ChartLine size={27} weight="bold" />
              pricewatch
            </div>
            <div className="pricewatch-header-right">
              <span>Контролируемый тестовый каталог</span>
              <button
                className="pricewatch-alert-btn"
                onClick={() => {
                  demo.clearError();
                  setAlertsOpen(true);
                }}
              >
                <Bell size={16} />
                События <b>{unread}</b>
              </button>
            </div>
          </header>
          <ErrorNotice error={demo.error} />
          <div className="pricewatch-heading">
            <div>
              <h1>Цены под наблюдением</h1>
              <p>Нужная покупка. В подходящий момент.</p>
            </div>
            <button
              className="demo-btn"
              onClick={() => {
                demo.clearError();
                setAdding(true);
              }}
            >
              <Plus size={16} />
              Добавить товар
            </button>
          </div>
          <div className="pricewatch-stats">
            <div className="pricewatch-stat">
              <span>Под наблюдением</span>
              <strong>{watches.length.toString().padStart(2, '0')}</strong>
              <small>товаров в списке</small>
            </div>
            <div className="pricewatch-stat">
              <span>Целевая цена достигнута</span>
              <strong>{targetsMet.toString().padStart(2, '0')}</strong>
              <small>на текущей проверке</small>
            </div>
            <div className="pricewatch-stat">
              <span>Интервал проверки</span>
              <strong>{state.pricewatch.intervalSeconds} сек.</strong>
              <small>фоновый процесс сервера</small>
            </div>
          </div>
          <div className="pricewatch-section-head">
            <h2>Мой список наблюдения</h2>
            <span>
              {state.pricewatch.lastWorkerAt
                ? `Проверка сервера: ${new Date(state.pricewatch.lastWorkerAt).toLocaleTimeString('ru-RU')}`
                : 'Ожидаем первую фоновую проверку'}
            </span>
          </div>
          {watches.length && selected && product ? (
            <div className="pricewatch-grid">
              <div className="pricewatch-list" aria-label="Наблюдаемые товары">
                {watches.map((watch) => {
                  const item = state.pricewatch.catalog.find(
                    (value) => value.id === watch.productId,
                  )!;
                  const lastPrice = watch.history.at(-1)?.price ?? item.price;
                  return (
                    <button
                      key={watch.id}
                      className={`pricewatch-watch ${watch.id === selected.id ? 'active' : ''}`}
                      aria-pressed={watch.id === selected.id}
                      onClick={() => setSelectedId(watch.id)}
                    >
                      <img src={productImage(item.image)} alt="" />
                      <div>
                        <strong>{item.name}</strong>
                        <small>{item.store}</small>
                        <div className="pricewatch-watch-price">
                          <b>{money(lastPrice)}</b>
                          <span>
                            {lastPrice <= watch.threshold ? 'Порог достигнут' : 'Наблюдаем'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
                <button
                  className="demo-btn"
                  onClick={() => {
                    demo.clearError();
                    setAdding(true);
                  }}
                >
                  <Plus size={14} />
                  Добавить к наблюдению
                </button>
              </div>
              <section className="pricewatch-detail" aria-label={`История цены ${product.name}`}>
                <div className="pricewatch-detail-head">
                  <div>
                    <h2>{product.name}</h2>
                    <p>
                      {product.store} / {product.category}
                    </p>
                  </div>
                  <button
                    className="demo-icon-btn"
                    aria-label={`Удалить наблюдение ${product.name}`}
                    disabled={demo.busy}
                    onClick={async () => {
                      if (
                        window.confirm(
                          `Удалить ${product.name} из наблюдения? История этого наблюдения будет удалена.`,
                        )
                      )
                        await demo.mutate(
                          `/api/pricewatch/watches/${selected.id}/delete`,
                          {},
                          'Товар удален из наблюдения.',
                        );
                    }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
                <div className="pricewatch-price-line">
                  <strong>{money(currentPrice)}</strong>
                  <span className={`pricewatch-delta ${percent > 0 ? 'up' : ''}`}>
                    {percent > 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                    {Math.abs(percent).toFixed(1)}% <span className="muted">за период</span>
                  </span>
                </div>
                <div className="pricewatch-chart-title">
                  <span>
                    <i />
                    Цена в тестовом каталоге
                  </span>
                  <span>Пунктир / ваш порог</span>
                </div>
                <PriceChart watch={selected} />
                <ThresholdForm
                  key={`${selected.id}-${selected.threshold}`}
                  demo={demo}
                  watch={selected}
                />
                <div className="pricewatch-detail-foot">
                  <span>
                    <Clock size={11} />{' '}
                    {nextIn > 0
                      ? `Следующая фоновая проверка через ${nextIn} сек.`
                      : 'Ожидаем результат фоновой проверки...'}
                    <br />
                    Обновление экрана каждые 8 сек.
                  </span>
                  <button
                    className="demo-btn quiet"
                    disabled={demo.busy || manualIn > 0}
                    onClick={async () => {
                      const watchId = selected.id;
                      if (
                        await demo.mutate(
                          `/api/pricewatch/watches/${watchId}/check`,
                          {},
                          'Цена проверена. Результат записан в историю.',
                        )
                      )
                        setCheckAfter((previous) => ({
                          ...previous,
                          [watchId]: Date.now() + 10000,
                        }));
                    }}
                  >
                    <ArrowClockwise size={13} />
                    {manualIn > 0 ? `Через ${manualIn} сек.` : 'Проверить сейчас'}
                  </button>
                </div>
                <details className="pricewatch-history">
                  <summary>История проверок в таблице / {selected.history.length}</summary>
                  <div className="pricewatch-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Время</th>
                          <th scope="col">Цена</th>
                          <th scope="col">Источник</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...selected.history].reverse().map((point, index) => (
                          <tr key={`${point.checkedAt}-${index}`}>
                            <td>
                              <time dateTime={point.checkedAt}>{dateTime(point.checkedAt)}</time>
                            </td>
                            <td>{money(point.price)}</td>
                            <td>
                              {point.source === 'seed'
                                ? 'Синтетическая история'
                                : point.source === 'background'
                                  ? 'Фоновая проверка'
                                  : 'Ручная проверка'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </section>
            </div>
          ) : (
            <div className="demo-empty">
              <ChartLine size={37} />
              <h3>Начните с первой покупки</h3>
              <p>
                Выберите товар из тестового каталога и укажите желаемую цену.
                <br />
                Сервер начнет автоматически сохранять результаты проверок.
              </p>
              <button
                className="demo-btn"
                onClick={() => {
                  demo.clearError();
                  setAdding(true);
                }}
              >
                <Plus size={16} />
                Выбрать товар
              </button>
            </div>
          )}
          <div className="pricewatch-explainer">
            <ShieldCheck size={20} />
            <p>
              Цены в демо меняются по модели тестового каталога. Фоновые проверки и сохранение
              истории выполняются настоящим процессом сервера каждые{' '}
              {state.pricewatch.intervalSeconds} секунд. Первоначальная история синтетическая.
              Событие появится при достижении порога; уведомления доступны внутри приложения.
              Внешние магазины не опрашиваются.
            </p>
          </div>
        </main>
      )}
      {adding && state && (
        <Modal title="Наблюдать за товаром" onClose={() => setAdding(false)} error={demo.error}>
          <AddWatchForm
            demo={demo}
            onSaved={(id) => {
              setSelectedId(id);
              setAdding(false);
            }}
          />
        </Modal>
      )}
      {alertsOpen && state && (
        <Modal title="События цен" onClose={() => setAlertsOpen(false)} error={demo.error}>
          {state.pricewatch.alerts.length ? (
            <>
              <div className="pricewatch-alerts">
                {[...state.pricewatch.alerts].reverse().map((alert) => (
                  <article
                    className={`pricewatch-alert ${alert.read ? 'read' : ''}`}
                    key={alert.id}
                  >
                    <h3>{alert.productName}</h3>
                    <p>
                      {money(alert.price)} / достигнут порог {money(alert.threshold)}
                    </p>
                    <time dateTime={alert.createdAt}>
                      {dateTime(alert.createdAt)}
                      {alert.read ? ' / прочитано' : ' / новое'}
                    </time>
                  </article>
                ))}
              </div>
              <div className="demo-form-actions">
                <button
                  className="demo-btn"
                  disabled={demo.busy || !unread}
                  onClick={() =>
                    void demo.mutate(
                      '/api/pricewatch/alerts/read',
                      {},
                      'События отмечены прочитанными.',
                    )
                  }
                >
                  Отметить все прочитанными
                </button>
              </div>
            </>
          ) : (
            <div className="demo-empty">
              <Bell size={30} />
              <h3>Пока без событий</h3>
              <p>
                Поставьте порог чуть выше текущей цены и дождитесь проверки, чтобы увидеть
                уведомление.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function PriceChart({ watch }: { watch: Watch }) {
  const id = useId().replace(/:/g, '');
  const points = watch.history;
  if (!points.length)
    return (
      <div className="demo-empty">
        <p>График появится после первой проверки.</p>
      </div>
    );
  const values = [...points.map((point) => point.price), watch.threshold];
  const low = Math.min(...values),
    high = Math.max(...values);
  const padding = Math.max((high - low) * 0.18, high * 0.02, 1);
  const min = Math.max(0, low - padding),
    max = high + padding;
  const width = 630,
    height = 245,
    left = 3,
    right = 65,
    top = 12,
    bottom = 32;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const firstAt = new Date(points[0].checkedAt).getTime(),
    lastAt = new Date(points.at(-1)!.checkedAt).getTime();
  const x = (index: number) =>
    left +
    ((new Date(points[index].checkedAt).getTime() - firstAt) / (lastAt - firstAt || 1)) * plotWidth;
  const y = (value: number) => top + ((max - value) / (max - min || 1)) * plotHeight;
  const path = points
    .map((point, index) => `${index ? 'L' : 'M'}${x(index)},${y(point.price)}`)
    .join(' ');
  const ticks = [0, 1, 2, 3].map((index) => min + ((max - min) / 3) * index);
  const dateIndexes = Array.from(
    new Set([
      0,
      Math.floor((points.length - 1) / 3),
      Math.floor(((points.length - 1) * 2) / 3),
      points.length - 1,
    ]),
  );
  return (
    <svg
      className="pricewatch-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
    >
      <title id={`${id}-title`}>Изменение цены по {points.length} проверкам</title>
      <desc id={`${id}-desc`}>
        Начальная цена {money(points[0].price)}, последняя цена {money(points.at(-1)!.price)}. Порог{' '}
        {money(watch.threshold)}. Полные данные доступны в таблице под графиком.
      </desc>
      <defs>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cced88" stopOpacity=".15" />
          <stop offset="100%" stopColor="#cced88" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((tick) => (
        <g key={tick}>
          <line className="grid" x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} />
          <text x={width - right + 12} y={y(tick) + 3}>
            {Math.round(tick).toLocaleString('ru-RU')}
          </text>
        </g>
      ))}
      <path
        d={`${path} L${x(points.length - 1)},${height - bottom} L${left},${height - bottom} Z`}
        fill={`url(#${id}-area)`}
      />
      <line
        className="threshold"
        x1={left}
        x2={width - right}
        y1={y(watch.threshold)}
        y2={y(watch.threshold)}
      />
      <path className="line" d={path} />
      <circle
        cx={x(points.length - 1)}
        cy={y(points.at(-1)!.price)}
        r="4"
        fill="#cced88"
        stroke="#222625"
        strokeWidth="2"
      />
      {dateIndexes.map((index, i) => (
        <text
          key={index}
          x={x(index)}
          y={height - 6}
          textAnchor={i === 0 ? 'start' : i === dateIndexes.length - 1 ? 'end' : 'middle'}
        >
          {new Date(points[index].checkedAt).toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </text>
      ))}
    </svg>
  );
}

function ThresholdForm({ demo, watch }: { demo: DemoController; watch: Watch }) {
  const [value, setValue] = useState(String(watch.threshold));
  async function submit(e: FormEvent) {
    e.preventDefault();
    await demo.mutate(
      `/api/pricewatch/watches/${watch.id}/threshold`,
      { threshold: Number(value) },
      'Порог сохранен. Уведомление появится при следующей подходящей проверке.',
    );
  }
  return (
    <form className="pricewatch-threshold" onSubmit={submit}>
      <label className="demo-field">
        Уведомить при цене, ₽
        <input
          type="number"
          required
          min="1"
          max="10000000"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button
        className="demo-btn secondary"
        disabled={demo.busy || Number(value) === watch.threshold}
      >
        <Bell size={13} />
        Сохранить порог
      </button>
    </form>
  );
}

function AddWatchForm({ demo, onSaved }: { demo: DemoController; onSaved: (id: string) => void }) {
  const state = demo.state!;
  const available = state.pricewatch.catalog.filter(
    (product) => !state.pricewatch.watches.some((watch) => watch.productId === product.id),
  );
  const [productId, setProductId] = useState(available[0]?.id || '');
  const product = available.find((item) => item.id === productId);
  const [threshold, setThreshold] = useState(String(Math.round((product?.price || 0) * 0.9)));
  function selectProduct(item?: CatalogProduct) {
    setProductId(item?.id || '');
    setThreshold(String(Math.round((item?.price || 0) * 0.9)));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = await demo.mutate(
      '/api/pricewatch/watches',
      { productId, threshold: Number(threshold) },
      'Наблюдение создано. Фоновая проверка уже запланирована.',
    );
    if (result)
      onSaved(result.pricewatch.watches.find((watch) => watch.productId === productId)!.id);
  }
  if (!available.length)
    return (
      <div className="demo-empty">
        <h3>Весь каталог уже под наблюдением</h3>
        <p>Можно изменить пороги существующих товаров или удалить один из них.</p>
      </div>
    );
  return (
    <form className="demo-form" onSubmit={submit}>
      <p className="muted demo-small">
        Выберите товар из контролируемого каталога. Произвольные ссылки в публичной демоверсии не
        принимаются.
      </p>
      <label className="demo-field">
        Товар из тестового каталога
        <select
          value={productId}
          required
          onChange={(e) => selectProduct(available.find((item) => item.id === e.target.value))}
        >
          {available.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {product && (
        <div className="pricewatch-catalog-option">
          <img src={productImage(product.image)} alt="" />
          <div>
            <strong>{product.name}</strong>
            <span>
              {money(product.price)} / {product.store}
            </span>
          </div>
        </div>
      )}
      <label className="demo-field">
        Уведомить при цене, ₽
        <input
          type="number"
          required
          min="1"
          max="10000000"
          step="1"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <small>Событие появится, когда цена станет равна этому порогу или ниже.</small>
      </label>
      <div className="demo-form-actions">
        <button className="demo-btn" disabled={demo.busy || !productId}>
          <Plus size={15} />
          Начать наблюдение
        </button>
      </div>
    </form>
  );
}
