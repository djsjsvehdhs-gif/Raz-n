/**
 * Base de datos con Firebase Firestore + caché en memoria.
 *
 * Todos los datos se cargan al arranque en memoria (initializeDb).
 * Las escrituras actualizan la memoria al instante y persisten en
 * Firestore de forma asíncrona → interfaz 100% síncrona para los handlers.
 *
 * Variables de entorno requeridas:
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (con \n literales)
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type User = {
  telegram_id: number;
  username?: string;
  first_name?: string;
  balance: number;
  total_spent: number;
  purchases: number;
  referred_by?: number;
  referral_count: number;
  banned: boolean;
  created_at: string;
};

export type Product = {
  id: number;
  name: string;
  category: "android" | "ios" | "pc";
  created_at: string;
};

export type ProductDuration = {
  id: number;
  product_id: number;
  label: string;
  price: number;
};

export type ProductKey = {
  id: number;
  product_id: number;
  duration_id: number | null;
  key_value: string;
  used: boolean;
  used_by?: number;
  used_at?: string;
};

export type PaymentMethod = {
  id: number;
  country: string;
  emoji: string;
  bank: string;
  holder: string;
  account: string;
  minimum: number;
  rate: number;
  currency: string;
};

export type Recharge = {
  id: number;
  transaction_id: string;
  user_id: number;
  country: string;
  amount_usd: number;
  amount_local: number;
  status: "pending" | "approved" | "rejected";
  photo_file_id?: string;
  created_at: string;
  processed_at?: string;
};

export type Purchase = {
  id: number;
  user_id: number;
  product_id: number;
  duration_id: number | null;
  key_id: number | null;
  price: number;
  purchased_at: string;
};

export type Movement = {
  id: number;
  user_id: number;
  type: string;
  description: string;
  amount: number;
  created_at: string;
};

type DbData = {
  users: User[];
  products: Product[];
  durations: ProductDuration[];
  keys: ProductKey[];
  payment_methods: PaymentMethod[];
  recharges: Recharge[];
  purchases: Purchase[];
  movements: Movement[];
  _seq: { users: number; products: number; durations: number; keys: number; methods: number; recharges: number; purchases: number; movements: number };
};

// ─── Caché en memoria ────────────────────────────────────────────────────────

const defaultData: DbData = {
  users: [], products: [], durations: [], keys: [],
  payment_methods: [], recharges: [], purchases: [], movements: [],
  _seq: { users: 0, products: 0, durations: 0, keys: 0, methods: 0, recharges: 0, purchases: 0, movements: 0 },
};

let cache: DbData = JSON.parse(JSON.stringify(defaultData));
let firestoreDb: Firestore | null = null;

// ─── Inicialización ───────────────────────────────────────────────────────────

export async function initializeDb(): Promise<void> {
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno de Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }

  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }

  firestoreDb = getFirestore();

  const doc = await firestoreDb.collection("bot").doc("data").get();
  if (doc.exists) {
    const loaded = doc.data() as Partial<DbData>;
    cache = { ...defaultData, ...loaded };
    // Asegurar _seq tiene todas las claves
    cache._seq = { ...defaultData._seq, ...loaded._seq };
  }

  console.log(`📦 DB cargada: ${cache.users.length} usuarios, ${cache.products.length} productos`);
}

function save(): void {
  if (!firestoreDb) return;
  firestoreDb.collection("bot").doc("data").set(cache).catch((err) => {
    console.error("❌ Error guardando en Firestore:", err);
  });
}

function nextId(key: keyof DbData["_seq"]): number {
  cache._seq[key]++;
  return cache._seq[key];
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export function getOrCreateUser(telegramId: number, username?: string, firstName?: string): User {
  let user = cache.users.find(u => u.telegram_id === telegramId);
  if (user) return user;
  user = {
    telegram_id: telegramId,
    username,
    first_name: firstName,
    balance: 0,
    total_spent: 0,
    purchases: 0,
    referral_count: 0,
    banned: false,
    created_at: new Date().toISOString(),
  };
  cache.users.push(user);
  save();
  return user;
}

export function getUser(telegramId: number): User | undefined {
  return cache.users.find(u => u.telegram_id === telegramId);
}

export function getAllUsers(): User[] {
  return [...cache.users].reverse();
}

export function banUser(telegramId: number) {
  const u = cache.users.find(u => u.telegram_id === telegramId);
  if (u) { u.banned = true; save(); }
}

export function unbanUser(telegramId: number) {
  const u = cache.users.find(u => u.telegram_id === telegramId);
  if (u) { u.banned = false; save(); }
}

export function addBalance(telegramId: number, amount: number) {
  const u = cache.users.find(u => u.telegram_id === telegramId);
  if (u) { u.balance += amount; save(); }
}

export function deductBalance(telegramId: number, amount: number) {
  const u = cache.users.find(u => u.telegram_id === telegramId);
  if (u) { u.balance -= amount; u.total_spent += amount; u.purchases++; save(); }
}

export function registerReferral(newUserId: number, referrerId: number) {
  const newUser = cache.users.find(u => u.telegram_id === newUserId);
  const referrer = cache.users.find(u => u.telegram_id === referrerId);
  if (newUser && !newUser.referred_by) newUser.referred_by = referrerId;
  if (referrer) {
    referrer.referral_count++;
    if (referrer.referral_count % 14 === 0) {
      referrer.balance += 0.5;
      addMovement(referrerId, "referral_bonus", "Bono por 14 referidos", 0.5);
    }
  }
  save();
}

// ─── Productos ───────────────────────────────────────────────────────────────

export function getProducts(): Product[] { return cache.products; }
export function getProductsByCategory(category: string): Product[] { return cache.products.filter(p => p.category === category); }
export function getProduct(id: number): Product | undefined { return cache.products.find(p => p.id === id); }

export function createProduct(name: string, category: string): number {
  const id = nextId("products");
  cache.products.push({ id, name, category: category as any, created_at: new Date().toISOString() });
  save();
  return id;
}

export function renameProduct(id: number, name: string) {
  const p = cache.products.find(p => p.id === id);
  if (p) { p.name = name; save(); }
}

export function deleteProduct(id: number) {
  cache.products = cache.products.filter(p => p.id !== id);
  cache.durations = cache.durations.filter(d => d.product_id !== id);
  cache.keys = cache.keys.filter(k => k.product_id !== id);
  save();
}

// ─── Duraciones ──────────────────────────────────────────────────────────────

export function getDurations(productId: number): ProductDuration[] { return cache.durations.filter(d => d.product_id === productId); }
export function getDuration(id: number): ProductDuration | undefined { return cache.durations.find(d => d.id === id); }

export function createDuration(productId: number, label: string, price: number): number {
  const id = nextId("durations");
  cache.durations.push({ id, product_id: productId, label, price });
  save();
  return id;
}

export function deleteDuration(id: number) {
  cache.durations = cache.durations.filter(d => d.id !== id);
  save();
}

export function updateDurationPrice(id: number, price: number) {
  const d = cache.durations.find(d => d.id === id);
  if (d) { d.price = price; save(); }
}

// ─── Keys ────────────────────────────────────────────────────────────────────

export function getAvailableKeys(productId: number, durationId?: number): ProductKey[] {
  return cache.keys.filter(k =>
    k.product_id === productId && !k.used &&
    (durationId === undefined || k.duration_id === durationId)
  );
}

export function getAllKeys(productId: number): ProductKey[] {
  return cache.keys.filter(k => k.product_id === productId);
}

export function addKeys(productId: number, durationId: number | null, keys: string[]) {
  for (const kv of keys) {
    const id = nextId("keys");
    cache.keys.push({ id, product_id: productId, duration_id: durationId, key_value: kv.trim(), used: false });
  }
  save();
}

export function useKey(keyId: number, userId: number) {
  const k = cache.keys.find(k => k.id === keyId);
  if (k) { k.used = true; k.used_by = userId; k.used_at = new Date().toISOString(); save(); }
}

// ─── Métodos de pago ─────────────────────────────────────────────────────────

export function getPaymentMethods(): PaymentMethod[] { return cache.payment_methods; }
export function getPaymentMethod(id: number): PaymentMethod | undefined { return cache.payment_methods.find(m => m.id === id); }

export function createPaymentMethod(data: Omit<PaymentMethod, "id">): number {
  const id = nextId("methods");
  cache.payment_methods.push({ id, ...data });
  save();
  return id;
}

export function updatePaymentMethod(id: number, field: string, value: string | number) {
  const m = cache.payment_methods.find(m => m.id === id);
  if (m) { (m as any)[field] = value; save(); }
}

export function deletePaymentMethod(id: number) {
  cache.payment_methods = cache.payment_methods.filter(m => m.id !== id);
  save();
}

// ─── Recargas ────────────────────────────────────────────────────────────────

export function createRecharge(data: { transactionId: string; userId: number; country: string; amountUsd: number; amountLocal: number }) {
  const id = nextId("recharges");
  cache.recharges.push({
    id,
    transaction_id: data.transactionId,
    user_id: data.userId,
    country: data.country,
    amount_usd: data.amountUsd,
    amount_local: data.amountLocal,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  save();
}

export function updateRechargePhoto(transactionId: string, photoFileId: string) {
  const r = cache.recharges.find(r => r.transaction_id === transactionId);
  if (r) { r.photo_file_id = photoFileId; save(); }
}

export function getPendingRecharges(): (Recharge & { username?: string; first_name?: string })[] {
  return cache.recharges.filter(r => r.status === "pending").map(r => {
    const user = cache.users.find(u => u.telegram_id === r.user_id);
    return { ...r, username: user?.username, first_name: user?.first_name };
  });
}

export function getRecharge(transactionId: string): Recharge | undefined {
  return cache.recharges.find(r => r.transaction_id === transactionId);
}

export function approveRecharge(transactionId: string): Recharge | null {
  const r = cache.recharges.find(r => r.transaction_id === transactionId);
  if (!r || r.status !== "pending") return null;
  r.status = "approved";
  r.processed_at = new Date().toISOString();
  addBalance(r.user_id, r.amount_usd);
  addMovement(r.user_id, "recharge", `Recarga: $${r.amount_usd.toFixed(2)} USD (ID: ${transactionId})`, r.amount_usd);
  save();
  return r;
}

export function rejectRecharge(transactionId: string): Recharge | null {
  const r = cache.recharges.find(r => r.transaction_id === transactionId);
  if (!r || r.status !== "pending") return null;
  r.status = "rejected";
  r.processed_at = new Date().toISOString();
  save();
  return r;
}

export function getUserRecharges(userId: number): Recharge[] {
  return cache.recharges.filter(r => r.user_id === userId).reverse();
}

// ─── Compras ─────────────────────────────────────────────────────────────────

export function getUserPurchases(userId: number) {
  return cache.purchases.filter(p => p.user_id === userId).reverse().map(p => {
    const product = cache.products.find(pr => pr.id === p.product_id);
    const duration = cache.durations.find(d => d.id === p.duration_id);
    const key = cache.keys.find(k => k.id === p.key_id);
    return {
      ...p,
      product_name: product?.name ?? "Producto eliminado",
      duration_label: duration?.label,
      key_value: key?.key_value,
    };
  });
}

export function recordPurchase(userId: number, productId: number, durationId: number | null, keyId: number | null, price: number) {
  const id = nextId("purchases");
  cache.purchases.push({ id, user_id: userId, product_id: productId, duration_id: durationId, key_id: keyId, price, purchased_at: new Date().toISOString() });
  deductBalance(userId, price);
  addMovement(userId, "purchase", `Compra realizada - $${price.toFixed(2)} USD`, -price);
  save();
}

// ─── Movimientos ─────────────────────────────────────────────────────────────

export function addMovement(userId: number, type: string, description: string, amount: number) {
  const id = nextId("movements");
  cache.movements.push({ id, user_id: userId, type, description, amount, created_at: new Date().toISOString() });
  save();
}

export function getUserMovements(userId: number): Movement[] {
  return cache.movements.filter(m => m.user_id === userId).reverse().slice(0, 20);
}

// ─── Estadísticas ────────────────────────────────────────────────────────────

export function getStats() {
  return {
    users: cache.users.length,
    pending: cache.recharges.filter(r => r.status === "pending").length,
    products: cache.products.length,
  };
}

// ─── Rangos y descuentos ─────────────────────────────────────────────────────

export function getRank(totalSpent: number): { name: string; emoji: string; nextName: string; nextAmount: number } {
  if (totalSpent >= 200) return { name: "Diamante", emoji: "💎", nextName: "Máximo", nextAmount: 0 };
  if (totalSpent >= 100) return { name: "Oro",      emoji: "🥇", nextName: "Diamante", nextAmount: 200 - totalSpent };
  if (totalSpent >= 50)  return { name: "Plata",    emoji: "🥈", nextName: "Oro",      nextAmount: 100 - totalSpent };
  return                        { name: "Bronce",   emoji: "🥉", nextName: "Plata",    nextAmount: 50  - totalSpent };
}

export function getDiscount(totalSpent: number): number {
  if (totalSpent >= 200) return 15;
  if (totalSpent >= 100) return 10;
  if (totalSpent >= 50)  return 5;
  return 0;
}
