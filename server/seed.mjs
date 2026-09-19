import { randomUUID } from 'node:crypto';

export const productImages = [
  'flat-white',
  'filter',
  'cappuccino',
  'matcha',
  'croissant',
  'cheesecake',
  'beans',
];
export const catalog = [
  {
    id: 'headphones',
    name: 'Наушники Studio One',
    category: 'Аудио',
    store: 'Тестовый магазин',
    basePrice: 18990,
    image: 'headphones',
  },
  {
    id: 'keyboard',
    name: 'Клавиатура Form 75',
    category: 'Для работы',
    store: 'Тестовый магазин',
    basePrice: 12490,
    image: 'keyboard',
  },
  {
    id: 'monitor',
    name: 'Монитор View 27',
    category: 'Для работы',
    store: 'Тестовый магазин',
    basePrice: 32990,
    image: 'monitor',
  },
  {
    id: 'speaker',
    name: 'Колонка Sound Mini',
    category: 'Аудио',
    store: 'Тестовый магазин',
    basePrice: 7990,
    image: 'speaker',
  },
  {
    id: 'mouse',
    name: 'Мышь Arc Wireless',
    category: 'Для работы',
    store: 'Тестовый магазин',
    basePrice: 5490,
    image: 'mouse',
  },
  {
    id: 'webcam',
    name: 'Камера Focus HD',
    category: 'Для работы',
    store: 'Тестовый магазин',
    basePrice: 6990,
    image: 'webcam',
  },
];

export function priceAt(product, time) {
  const offsets = [0, 1, 2, 0, -2, -3, -1, -4, -2, 1, 0, -1];
  const shift = catalog.findIndex((item) => item.id === product.id);
  const step = Math.floor(time / 30000);
  return (
    Math.round(
      (product.basePrice *
        (1 +
          offsets[(((step + shift * 3) % offsets.length) + offsets.length) % offsets.length] /
            100)) /
        10,
    ) * 10
  );
}

export function catalogAt(time) {
  return catalog.map((product) => ({ ...product, price: priceAt(product, time) }));
}

export function makeState(now, intervalSeconds, expiresAt, telegramConfigured) {
  const iso = (time) => new Date(time).toISOString();
  const clients = [
    {
      id: 'client-atelier',
      name: 'Анна Миронова',
      company: 'Ателье "Форма"',
      email: 'anna@example.test',
      phone: '+7 000 100-20-30',
    },
    {
      id: 'client-coffee',
      name: 'Денис Соколов',
      company: 'Кофейня "Точка"',
      email: 'denis@example.test',
      phone: '+7 000 100-20-31',
    },
    {
      id: 'client-bureau',
      name: 'Ирина Волкова',
      company: 'Бюро "Контур"',
      email: 'irina@example.test',
      phone: '+7 000 100-20-32',
    },
    {
      id: 'client-print',
      name: 'Михаил Левин',
      company: 'Печатная мастерская',
      email: 'mikhail@example.test',
      phone: '+7 000 100-20-33',
    },
    {
      id: 'client-flower',
      name: 'Ольга Белова',
      company: 'Цветочная "Лист"',
      email: 'olga@example.test',
      phone: '+7 000 100-20-34',
    },
  ];
  const managers = [
    { id: 'manager-alex', name: 'Алексей', initials: 'АЛ' },
    { id: 'manager-maria', name: 'Мария', initials: 'МР' },
    { id: 'manager-ivan', name: 'Иван', initials: 'ИВ' },
  ];
  const tickets = [
    [
      'Настроить онлайн-кассу',
      'Подключить тестовый терминал и проверить печать чека.',
      'client-coffee',
      'new',
      'high',
      8500,
    ],
    [
      'Обновить рабочие станции',
      'Проверить обновления на трех рабочих местах.',
      'client-bureau',
      'new',
      'normal',
      12000,
    ],
    [
      'Диагностика плоттера',
      'На тестовых отпечатках появились полосы.',
      'client-print',
      'progress',
      'high',
      6500,
    ],
    [
      'Настроить резервное копирование',
      'Ежедневная копия на локальное хранилище.',
      'client-atelier',
      'progress',
      'normal',
      18000,
    ],
    [
      'Перенести базу клиентов',
      'Ожидаем тестовую выгрузку в CSV.',
      'client-flower',
      'waiting',
      'normal',
      14500,
    ],
    [
      'Заменить маршрутизатор',
      'Оборудование заказано. Выезд после доставки.',
      'client-coffee',
      'waiting',
      'low',
      4200,
    ],
    [
      'Подключить второй принтер',
      'Драйвер установлен, тестовая печать выполнена.',
      'client-bureau',
      'done',
      'low',
      3000,
    ],
  ].map((row, i) => ({
    id: 'ticket-' + (1041 + i),
    number: 1041 + i,
    title: row[0],
    description: row[1],
    clientId: row[2],
    status: row[3],
    priority: row[4],
    managerId: managers[i % managers.length].id,
    amount: row[5],
    createdAt: iso(now - (i + 1) * 3600000),
    comments:
      i === 2
        ? [
            {
              id: randomUUID(),
              author: 'Мария',
              text: 'Согласовали диагностику на тестовом оборудовании.',
              createdAt: iso(now - 1200000),
            },
          ]
        : [],
  }));
  const products = [
    {
      id: 'coffee-flat',
      name: 'Флэт уайт',
      description: 'Двойной эспрессо, шелковистое молоко. 200 мл',
      category: 'coffee',
      price: 290,
      image: 'flat-white',
      available: true,
    },
    {
      id: 'coffee-filter',
      name: 'Фильтр-кофе',
      description: 'Колумбия, ноты карамели и красного яблока. 300 мл',
      category: 'coffee',
      price: 220,
      image: 'filter',
      available: true,
    },
    {
      id: 'coffee-cappuccino',
      name: 'Капучино',
      description: 'Классический баланс кофе и молока. 300 мл',
      category: 'coffee',
      price: 280,
      image: 'cappuccino',
      available: true,
    },
    {
      id: 'coffee-matcha',
      name: 'Матча латте',
      description: 'Японский зеленый чай и овсяное молоко. 300 мл',
      category: 'coffee',
      price: 340,
      image: 'matcha',
      available: true,
    },
    {
      id: 'dessert-croissant',
      name: 'Круассан',
      description: 'Слоеное тесто, сливочное масло, хрустящая корочка.',
      category: 'dessert',
      price: 190,
      image: 'croissant',
      available: true,
    },
    {
      id: 'dessert-cheesecake',
      name: 'Баскский чизкейк',
      description: 'Нежная середина и карамельная корочка. 140 г',
      category: 'dessert',
      price: 360,
      image: 'cheesecake',
      available: true,
    },
    {
      id: 'beans-colombia',
      name: 'Колумбия Уила',
      description: 'Зерно для дома. Средняя обжарка, 250 г.',
      category: 'beans',
      price: 890,
      image: 'beans',
      available: true,
    },
  ];
  const watches = catalog.slice(0, 3).map((product, i) => ({
    id: 'watch-' + product.id,
    productId: product.id,
    threshold: Math.round((product.basePrice * (0.95 - i / 100)) / 10) * 10,
    createdAt: iso(now - 3600000),
    lastCheckedAt: iso(now),
    nextCheckAt: iso(now + intervalSeconds * 1000),
    history: Array.from({ length: 12 }, (_, index) => {
      const time = now - (11 - index) * 30000;
      return { checkedAt: iso(time), price: priceAt(product, time), source: 'seed' };
    }),
  }));
  return {
    schemaVersion: 1,
    session: {
      role: 'admin',
      createdAt: iso(now),
      expiresAt: iso(expiresAt),
      mode: 'demo',
      telegramConfigured,
      priceSource: 'controlled',
    },
    flowdesk: { clients, managers, tickets },
    orderly: {
      products,
      cart: [],
      orders: [
        {
          id: 'order-1204',
          number: 1204,
          items: [
            { productId: 'coffee-flat', name: 'Флэт уайт', price: 290, quantity: 1 },
            { productId: 'dessert-croissant', name: 'Круассан', price: 190, quantity: 1 },
          ],
          total: 480,
          name: 'Демо-гость',
          phone: '+7 000 000-00-00',
          note: 'Синтетический пример заказа',
          status: 'completed',
          createdAt: iso(now - 86400000),
        },
      ],
    },
    pricewatch: {
      catalog: catalogAt(now),
      watches,
      alerts: [],
      intervalSeconds,
      lastWorkerAt: null,
    },
    _private: { checkouts: {}, manualChecks: {}, telegramUserId: null },
  };
}
