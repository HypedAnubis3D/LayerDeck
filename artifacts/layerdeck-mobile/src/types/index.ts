export interface OrderItem {
  name: string;
  qty: number;
  price?: number;
  catalogItemId?: string;
  tmfId?: string | null;
  [key: string]: unknown;
}

export interface Order {
  id: string;
  customer: string;
  orderId: string;
  platform: string;
  date: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  items: OrderItem[];
  status: string;
  shipping: number;
  notes: string;
  discountCode?: string;
  trackingNumber: string;
  timestamp: number;
  linkedPrintIds: string[];
  miscCost: number;
}

export type QueueStage = 'queued' | 'inprogress' | 'done';
export type QueuePriority = 'urgent' | 'high' | 'normal' | 'low';

export interface QueueItem {
  id: string;
  name: string;
  category: string;
  printer: string;
  hrs: number;
  qty: number;
  priority: QueuePriority;
  orderId?: string;
  stage: QueueStage;
  tmfId?: string | null;
  notes: string;
  timestamp: number;
  fromShopify?: boolean;
  noTmf?: boolean;
}

export interface Spool {
  id: string;
  name: string;
  color: string;
  material: string;
  printer: string;
  amsSlot: string;
  total: number;
  remaining: number;
  cost: number;
  brand: string;
  tags: string[];
  driedDate: string;
  driedHours: string;
  notes: string;
}
