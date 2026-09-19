export type DemoRole = 'admin' | 'manager';
export type TicketStatus = 'new' | 'progress' | 'waiting' | 'done';
export type Priority = 'low' | 'normal' | 'high';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
}
export interface Manager {
  id: string;
  name: string;
  initials: string;
}
export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}
export interface Ticket {
  id: string;
  number: number;
  title: string;
  description: string;
  clientId: string;
  status: TicketStatus;
  priority: Priority;
  managerId: string;
  amount: number;
  createdAt: string;
  comments: Comment[];
}
export interface Product {
  id: string;
  name: string;
  description: string;
  category: 'coffee' | 'dessert' | 'beans';
  price: number;
  image: string;
  available: boolean;
}
export interface CartItem {
  productId: string;
  quantity: number;
}
export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}
export interface Order {
  id: string;
  number: number;
  items: OrderItem[];
  total: number;
  name: string;
  phone: string;
  note: string;
  status: OrderStatus;
  createdAt: string;
}
export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  store: string;
  price: number;
  basePrice: number;
  image: string;
}
export interface PricePoint {
  checkedAt: string;
  price: number;
  source: 'seed' | 'background' | 'manual';
}
export interface Watch {
  id: string;
  productId: string;
  threshold: number;
  createdAt: string;
  lastCheckedAt: string;
  nextCheckAt: string;
  history: PricePoint[];
}
export interface PriceAlert {
  id: string;
  watchId: string;
  productName: string;
  price: number;
  threshold: number;
  createdAt: string;
  read: boolean;
}
export interface AppState {
  session: {
    role: DemoRole;
    createdAt: string;
    expiresAt: string;
    mode: 'demo' | 'telegram';
    telegramConfigured: boolean;
    priceSource: 'controlled';
  };
  flowdesk: { clients: Client[]; managers: Manager[]; tickets: Ticket[] };
  orderly: { products: Product[]; cart: CartItem[]; orders: Order[] };
  pricewatch: {
    catalog: CatalogProduct[];
    watches: Watch[];
    alerts: PriceAlert[];
    intervalSeconds: number;
    lastWorkerAt: string | null;
  };
}
export interface ApiError {
  error: string;
  code: string;
  retryAfter?: number;
}
