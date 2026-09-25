import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Plus,
  Minus,
  ShoppingBag,
  Coffee,
  ArrowRight,
  MapPin,
  Check,
  PencilSimple,
} from '@phosphor-icons/react';
import type { Order, OrderStatus, Product } from '../../shared/types';
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

const categories = [
  { id: 'all', label: 'Все меню' },
  { id: 'coffee', label: 'Напитки' },
  { id: 'dessert', label: 'К кофе' },
  { id: 'beans', label: 'Зерно' },
];
const orderStatuses: Record<OrderStatus, string> = {
  new: 'Принят',
  preparing: 'Готовится',
  ready: 'Можно забирать',
  completed: 'Выдан',
  cancelled: 'Отменен',
};
const transitions: Record<OrderStatus, OrderStatus[]> = {
  new: ['new', 'preparing', 'cancelled'],
  preparing: ['preparing', 'ready', 'cancelled'],
  ready: ['ready', 'completed', 'cancelled'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};
type TelegramWebApp = { initData?: string; ready: () => void; expand: () => void };
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export default function Orderly() {
  const demo = useDemo();
  const [tab, setTab] = useState<'catalog' | 'orders' | 'admin'>('catalog');
  const [category, setCategory] = useState('all');
  const [checkout, setCheckout] = useState(false);
  const [editProduct, setEditProduct] = useState<string | null>(null);
  const telegramAttempted = useRef(false);
  const state = demo.state;
  const isAdmin = state?.session.role === 'admin';
  const products =
    state?.orderly.products.filter(
      (product) => product.available && (category === 'all' || product.category === category),
    ) || [];
  const cartItems =
    state?.orderly.cart
      .map((item) => ({
        ...item,
        product: state.orderly.products.find((product) => product.id === item.productId)!,
      }))
      .filter((item) => item.product) || [];
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => sum + item.quantity * item.product.price, 0);
  const selectedProduct = state?.orderly.products.find((product) => product.id === editProduct);

  useEffect(() => {
    if (!state || telegramAttempted.current || !window.location.hash.includes('tgWebAppData'))
      return;
    const start = () => {
      const webapp = window.Telegram?.WebApp;
      if (!webapp || telegramAttempted.current) return;
      telegramAttempted.current = true;
      webapp.ready();
      webapp.expand();
      if (state.session.telegramConfigured && webapp.initData)
        void demo.mutate(
          '/api/session/telegram',
          { initData: webapp.initData },
          'Данные Telegram проверены сервером. Оформление остается тестовым.',
        );
    };
    if (window.Telegram?.WebApp) {
      start();
      return;
    }
    let script = document.getElementById('telegram-mini-app-sdk') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'telegram-mini-app-sdk';
      script.src = 'https://telegram.org/js/telegram-web-app.js';
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', start);
    return () => script?.removeEventListener('load', start);
  }, [state?.session.telegramConfigured, demo.mutate, state]);

  function quantity(productId: string) {
    return state?.orderly.cart.find((item) => item.productId === productId)?.quantity || 0;
  }
  function updateCart(productId: string, value: number) {
    void demo.mutate('/api/orderly/cart', { productId, quantity: value });
  }
  function openProduct(id: string) {
    demo.clearError();
    setEditProduct(id);
  }

  return (
    <div className="demo orderly">
      <DemoBanner demo={demo} slug="orderly" />
      {!state ? (
        <LoadingState demo={demo} />
      ) : (
        <main className="orderly-shell" id="main">
          <header className="orderly-header">
            <div className="orderly-brand">
              <Coffee size={31} weight="fill" />
              orderly<span className="sr-only"> - кофейня</span>
            </div>
            <nav className="orderly-nav" aria-label="Разделы Orderly">
              <button
                className={tab === 'catalog' ? 'active' : ''}
                aria-current={tab === 'catalog' ? 'page' : undefined}
                onClick={() => setTab('catalog')}
              >
                Меню
              </button>
              <button
                className={tab === 'orders' ? 'active' : ''}
                aria-current={tab === 'orders' ? 'page' : undefined}
                onClick={() => setTab('orders')}
              >
                Заказы <span className="orderly-nav-count">{state.orderly.orders.length}</span>
              </button>
              {isAdmin && (
                <button
                  className={tab === 'admin' ? 'active' : ''}
                  aria-current={tab === 'admin' ? 'page' : undefined}
                  onClick={() => setTab('admin')}
                >
                  Управление
                </button>
              )}
            </nav>
            <span className="orderly-location">
              <MapPin size={15} />
              Самовывоз / демо-кофейня
            </span>
          </header>
          <ErrorNotice error={demo.error} />
          {tab === 'catalog' && (
            <>
              <div className="orderly-layout">
                <section aria-label="Каталог кофейни">
                  <div className="orderly-hero">
                    <div className="orderly-hero-copy">
                      <div className="eyebrow">Маленький ритуал. Большое удовольствие.</div>
                      <h1>Кофе. И хороший день.</h1>
                      <p>
                        Свежее зерно, теплая выпечка
                        <br />и время для себя.
                      </p>
                    </div>
                    <img
                      className="orderly-hero-img"
                      src={productImage('coffee-hero')}
                      alt="Приготовление фильтр-кофе в воронке"
                    />
                  </div>
                  <h2 className="sr-only">Меню кофейни</h2>
                  <div className="orderly-catalog-head">
                    <div className="orderly-categories" role="group" aria-label="Категории меню">
                      {categories.map((item) => (
                        <button
                          key={item.id}
                          className={category === item.id ? 'active' : ''}
                          aria-pressed={category === item.id}
                          onClick={() => setCategory(item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <span>{products.length} позиций</span>
                  </div>
                  {products.length ? (
                    <div className="orderly-products">
                      {products.map((product) => (
                        <article className="orderly-product" key={product.id}>
                          <div className="orderly-product-image">
                            <img
                              src={productImage(product.image)}
                              alt={product.name}
                              loading="lazy"
                            />
                            {product.category === 'beans' && <span>Для дома</span>}
                          </div>
                          <h3>{product.name}</h3>
                          <p>{product.description}</p>
                          <div className="orderly-product-bottom">
                            <strong>{money(product.price)}</strong>
                            {quantity(product.id) ? (
                              <div className="orderly-product-qty">
                                <button
                                  className="demo-icon-btn"
                                  aria-label={`Убрать одну порцию ${product.name}`}
                                  disabled={demo.busy}
                                  onClick={() => updateCart(product.id, quantity(product.id) - 1)}
                                >
                                  <Minus size={13} />
                                </button>
                                <span aria-label="В корзине">{quantity(product.id)}</span>
                                <button
                                  className="demo-icon-btn"
                                  aria-label={`Добавить ${product.name}`}
                                  disabled={demo.busy || quantity(product.id) >= 20}
                                  onClick={() => updateCart(product.id, quantity(product.id) + 1)}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            ) : (
                              <button
                                className="demo-icon-btn"
                                aria-label={`Добавить ${product.name}`}
                                disabled={demo.busy}
                                onClick={() => updateCart(product.id, 1)}
                              >
                                <Plus size={16} />
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="demo-empty">
                      <h3>В этой категории пока пусто</h3>
                      <p>Выберите другую категорию или добавьте товар в управлении.</p>
                    </div>
                  )}
                  <div className="orderly-note">
                    <span>
                      {state.session.mode === 'telegram'
                        ? 'Telegram Mini App / тестовый заказ'
                        : 'Браузерный деморежим / без входа в Telegram'}
                    </span>
                    <span>Реальная оплата отключена</span>
                  </div>
                </section>
                <aside className="orderly-cart" id="orderly-cart" aria-label="Корзина">
                  <div className="orderly-cart-head">
                    <h2>Ваш заказ</h2>
                    <span>{cartCount} шт.</span>
                  </div>
                  {cartItems.length ? (
                    <>
                      <div className="orderly-cart-items">
                        {cartItems.map((item) => (
                          <div className="orderly-cart-item" key={item.productId}>
                            <img src={productImage(item.product.image)} alt="" />
                            <div>
                              <strong>{item.product.name}</strong>
                              <small>{money(item.product.price)} за шт.</small>
                              <div className="orderly-cart-controls">
                                <button
                                  aria-label={`Уменьшить количество ${item.product.name}`}
                                  disabled={demo.busy}
                                  onClick={() => updateCart(item.productId, item.quantity - 1)}
                                >
                                  <Minus size={11} />
                                </button>
                                <span>{item.quantity}</span>
                                <button
                                  aria-label={`Увеличить количество ${item.product.name}`}
                                  disabled={demo.busy || item.quantity >= 20}
                                  onClick={() => updateCart(item.productId, item.quantity + 1)}
                                >
                                  <Plus size={11} />
                                </button>
                              </div>
                            </div>
                            <span>{money(item.quantity * item.product.price)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="orderly-cart-total">
                        <div>
                          <span>Итого</span>
                          <strong>{money(total)}</strong>
                        </div>
                        <button
                          className="demo-btn"
                          disabled={demo.busy}
                          onClick={() => {
                            demo.clearError();
                            setCheckout(true);
                          }}
                        >
                          Оформить заказ
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="orderly-cart-empty">
                      <ShoppingBag size={36} weight="light" />
                      <strong>Начнем с любимого?</strong>
                      <p>
                        Добавьте напиток или десерт.
                        <br />
                        Мы соберем ваш заказ здесь.
                      </p>
                    </div>
                  )}
                  <p className="orderly-cart-foot">
                    Это тестовое оформление.
                    <br />
                    Деньги не списываются, заказ никуда не отправляется.
                  </p>
                </aside>
              </div>
              {cartCount > 0 && (
                <a className="orderly-mobile-cart" href="#orderly-cart">
                  <span>
                    <ShoppingBag size={18} />
                    Корзина / {cartCount} шт.
                  </span>
                  <span>
                    {money(total)}
                    <ArrowRight size={16} />
                  </span>
                </a>
              )}
            </>
          )}
          {tab === 'orders' && (
            <>
              <div className="orderly-page-head">
                <div>
                  <h1>Ваши заказы</h1>
                  <p>Все тестовые заказы этой демосессии.</p>
                </div>
                <button className="demo-btn secondary" onClick={() => setTab('catalog')}>
                  Вернуться в меню
                </button>
              </div>
              {state.orderly.orders.length ? (
                <div className="orderly-orders">
                  {[...state.orderly.orders].reverse().map((order) => (
                    <OrderCard key={order.id} order={order} demo={demo} />
                  ))}
                </div>
              ) : (
                <div className="demo-empty">
                  <ShoppingBag size={33} />
                  <h3>Первый кофе еще впереди</h3>
                  <p>Соберите корзину и оформите тестовый заказ.</p>
                  <button className="demo-btn" onClick={() => setTab('catalog')}>
                    Открыть меню
                  </button>
                </div>
              )}
            </>
          )}
          {tab === 'admin' &&
            (isAdmin ? (
              <>
                <div className="orderly-page-head">
                  <div>
                    <h1>За стойкой</h1>
                    <p>Управление меню и заказами демо-кофейни.</p>
                  </div>
                  <button className="demo-btn" onClick={() => openProduct('new')}>
                    <Plus size={15} />
                    Добавить товар
                  </button>
                </div>
                <h2 className="orderly-admin-title">Меню / {state.orderly.products.length}</h2>
                <div className="orderly-admin-grid">
                  {state.orderly.products.map((product) => (
                    <article className="orderly-admin-product" key={product.id}>
                      <img src={productImage(product.image)} alt="" />
                      <div>
                        <h3>{product.name}</h3>
                        <p>
                          {money(product.price)} / {product.available ? 'В меню' : 'Скрыт из меню'}
                        </p>
                      </div>
                      <button
                        className="demo-btn secondary"
                        onClick={() => openProduct(product.id)}
                        aria-label={`Изменить ${product.name}`}
                      >
                        <PencilSimple size={13} />
                        Изменить
                      </button>
                    </article>
                  ))}
                </div>
                <h2 className="orderly-admin-title">Заказы / {state.orderly.orders.length}</h2>
                {state.orderly.orders.length ? (
                  <div className="orderly-orders">
                    {[...state.orderly.orders].reverse().map((order) => (
                      <OrderCard key={order.id} order={order} demo={demo} admin />
                    ))}
                  </div>
                ) : (
                  <div className="demo-empty">
                    <h3>Заказов пока нет</h3>
                    <p>Оформите заказ через меню, затем измените здесь его статус.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="demo-empty">
                <h3>Требуется роль администратора</h3>
                <p>
                  Менеджер может оформлять заказы. Для изменения меню и статусов переключите
                  демонстрационную роль сверху.
                </p>
                <button className="demo-btn" onClick={() => setTab('catalog')}>
                  Открыть меню
                </button>
              </div>
            ))}
        </main>
      )}
      {checkout && state && (
        <Modal title="Почти готово" onClose={() => setCheckout(false)} error={demo.error}>
          <CheckoutForm
            demo={demo}
            total={total}
            onSaved={() => {
              setCheckout(false);
              setTab('orders');
              window.scrollTo({ top: 0 });
            }}
          />
        </Modal>
      )}
      {editProduct && state && isAdmin && (editProduct === 'new' || selectedProduct) && (
        <Modal
          title={selectedProduct ? 'Редактирование товара' : 'Новый товар'}
          onClose={() => setEditProduct(null)}
          error={demo.error}
        >
          <ProductForm
            key={editProduct}
            demo={demo}
            product={selectedProduct}
            onSaved={() => setEditProduct(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function CheckoutForm({
  demo,
  total,
  onSaved,
}: {
  demo: DemoController;
  total: number;
  onSaved: () => void;
}) {
  const key = useRef(
    sessionStorage.getItem('orderly-checkout-key') ||
      Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    sessionStorage.setItem('orderly-checkout-key', key.current);
    if (
      await demo.mutate(
        '/api/orderly/checkout',
        {
          name: String(data.get('name')).trim(),
          phone: String(data.get('phone')).trim(),
          note: String(data.get('note')).trim(),
          idempotencyKey: key.current,
        },
        'Тестовый заказ принят. Его статус можно изменить в разделе управления.',
      )
    ) {
      sessionStorage.removeItem('orderly-checkout-key');
      onSaved();
    }
  }
  return (
    <form className="demo-form" onSubmit={submit}>
      <p className="muted demo-small">
        Самовывоз из вымышленной кофейни. Используйте тестовые контакты. Заказ сохранится только в
        вашей демосессии.
      </p>
      <label className="demo-field">
        Ваше имя
        <input name="name" required minLength={2} maxLength={80} placeholder="Алексей" autoFocus />
      </label>
      <label className="demo-field">
        Телефон
        <input
          name="phone"
          required
          type="tel"
          minLength={7}
          maxLength={30}
          placeholder="+7 900 000-00-00"
        />
      </label>
      <label className="demo-field">
        Комментарий к заказу
        <textarea name="note" maxLength={300} placeholder="Например, без сахара" />
      </label>
      <div className="orderly-cart-total">
        <div>
          <span>К тестовому оформлению</span>
          <strong>{money(total)}</strong>
        </div>
      </div>
      <button className="demo-btn" disabled={demo.busy || total <= 0}>
        <Check size={17} />
        {demo.busy ? 'Оформляем...' : 'Подтвердить тестовый заказ'}
      </button>
      <p className="demo-small muted">Оплата и передача в кофейню отключены.</p>
    </form>
  );
}

function OrderCard({
  order,
  demo,
  admin = false,
}: {
  order: Order;
  demo: DemoController;
  admin?: boolean;
}) {
  return (
    <article className="orderly-order">
      <div className="orderly-order-head">
        <div>
          <strong>Заказ #{order.number}</strong>
          <time dateTime={order.createdAt}>{dateTime(order.createdAt)}</time>
        </div>
        <span className={`orderly-order-status ${order.status}`}>
          {orderStatuses[order.status]}
        </span>
      </div>
      <div className="orderly-order-items">
        {order.items.map((item) => (
          <div key={item.productId}>
            <span>
              {item.name} x {item.quantity}
            </span>
            <span>{money(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="orderly-order-bottom">
        <span>
          {order.name} / {admin ? order.phone : 'Самовывоз'}
        </span>
        {admin && (
          <label>
            <span className="sr-only">Статус заказа {order.number}</span>
            <select
              className="demo-select"
              value={order.status}
              disabled={demo.busy || transitions[order.status].length === 1}
              onChange={(e) =>
                void demo.mutate(
                  `/api/orderly/orders/${order.id}/status`,
                  { status: e.target.value },
                  `Статус заказа #${order.number} изменен.`,
                )
              }
            >
              {transitions[order.status].map((status) => (
                <option key={status} value={status}>
                  {orderStatuses[status]}
                </option>
              ))}
            </select>
          </label>
        )}
        <strong>{money(order.total)}</strong>
      </div>
      {order.note && (
        <p className="demo-small muted" style={{ marginTop: 12, overflowWrap: 'anywhere' }}>
          Комментарий: {order.note}
        </p>
      )}
    </article>
  );
}

function ProductForm({
  demo,
  product,
  onSaved,
}: {
  demo: DemoController;
  product?: Product;
  onSaved: () => void;
}) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const body = {
      name: String(data.get('name')).trim(),
      description: String(data.get('description')).trim(),
      price: Number(data.get('price')),
      available: data.get('available') === 'on',
      ...(product ? {} : { category: data.get('category') }),
    };
    if (
      await demo.mutate(
        product ? `/api/orderly/products/${product.id}/update` : '/api/orderly/products',
        body,
        product ? 'Товар обновлен.' : 'Товар добавлен в меню.',
      )
    )
      onSaved();
  }
  return (
    <form className="demo-form" onSubmit={submit}>
      <label className="demo-field">
        Название товара
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={product?.name}
          autoFocus
        />
      </label>
      <label className="demo-field">
        Описание товара
        <textarea
          name="description"
          required
          minLength={2}
          maxLength={240}
          defaultValue={product?.description}
        />
      </label>
      <div className="demo-form-row">
        <label className="demo-field">
          Цена, ₽
          <input
            name="price"
            type="number"
            required
            min="1"
            max="100000"
            step="1"
            defaultValue={product?.price}
          />
        </label>
        <label className="demo-field">
          Категория
          <select name="category" disabled={!!product} defaultValue={product?.category || 'coffee'}>
            {categories
              .filter((item) => item.id !== 'all')
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label className="demo-small">
        <input name="available" type="checkbox" defaultChecked={product?.available ?? true} />{' '}
        Доступен в меню
      </label>
      <p className="muted demo-small">
        Новому товару назначается фотография из выбранной категории. Скрытые товары остаются в
        истории заказов.
      </p>
      <div className="demo-form-actions">
        <button className="demo-btn" disabled={demo.busy}>
          {product ? 'Сохранить товар' : 'Добавить товар'}
        </button>
      </div>
    </form>
  );
}
