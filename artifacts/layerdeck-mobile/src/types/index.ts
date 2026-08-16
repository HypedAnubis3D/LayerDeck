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
  printId?: string;
  linkedPrintId?: string;
  finishedAt?: number;
  outcome?: 'done' | 'failed';
}

export interface PrintFilament {
  spoolId: string;
  grams: number; // planned/expected
  actualGrams?: number; // only set once the print is marked failed
}

export type PrintStatus = 'printing' | 'done' | 'failed';

export interface Print {
  id: string;
  name: string;
  category: string;
  printer: string;
  hrs: number;
  qty: number;
  filaments: PrintFilament[];
  notes: string;
  tmfName: string | null;
  tmfId: string | null;
  timestamp: number;
  status?: PrintStatus;
  failPct?: number;
  failNote?: string;
  finishedAt?: number;
  fromQueueItemId?: string;
  linkedOrderId?: string;
  autoFromPi?: boolean;
}

export interface PrintGroup {
  id: string;
  name: string;
  printIds: string[];
}

export interface UsageHistEntry {
  id: string;
  spoolId: string;
  spoolName: string;
  material: string;
  amount: number; // positive = deducted, negative = refunded
  job: string; // print name; refunds are prefixed '[REFUND] '
  notes: string;
  timestamp: number;
}

export interface WasteLogEntry {
  id: string;
  date: string;
  printerName: string;
  jobName: string;
  reason: string;
  materialWasted: number; // grams — observed as 0 across all live data
  timestamp: number;
}

export interface MaintLogEntry {
  id: string;
  printer: string;
  type: string; // e.g. 'Lubrication' | 'Nozzle Change' | 'Bed Cleaning' | 'Full Service'
  date: string;
  interval: number; // days between service
  notes: string;
  timestamp: number;
}

export interface CatalogVariant {
  title: string;
  price: number;
  tmfId: string | null;
}

export interface CatalogItem {
  id: string;
  name: string;
  photo: string;
  shopifyImage?: string;
  price: number;
  cost: number;
  stockQty?: number;
  lowStockAt: number; // default 3
  category: string;
  tags: string[];
  description: string;
  notes?: string;
  variants: CatalogVariant[];
  tmfId: string | null;
  tmfIds?: string[];
  shopifyId?: string;
  fromShopify?: boolean;
  createdAt: number;
}

export interface TmfLibItem {
  id: string;
  name: string;
  filename: string;
  printer: string;
  hrs: number;
  hasGcode: boolean;
  nozzleDiam: string;
  layerHeight: number;
  purgeGrams: number;
  supportGrams: number;
  filamentType: string;
  filamentColor: string;
  filamentTypes: string[];
  filamentColors: string[];
  plateFilamentGrams: { plateId: string | null; filGrams: Record<string, number> }[];
  filamentGramsPerColor: number[];
  objects: unknown[];
  uploadedAt: number;
  folderId?: string;
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
