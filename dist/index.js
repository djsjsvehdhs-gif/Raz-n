"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/bot/db.ts
var db_exports = {};
__export(db_exports, {
  addBalance: () => addBalance,
  addKeys: () => addKeys,
  addMovement: () => addMovement,
  approveRecharge: () => approveRecharge,
  banUser: () => banUser,
  createDuration: () => createDuration,
  createPaymentMethod: () => createPaymentMethod,
  createProduct: () => createProduct,
  createRecharge: () => createRecharge,
  deductBalance: () => deductBalance,
  deleteDuration: () => deleteDuration,
  deletePaymentMethod: () => deletePaymentMethod,
  deleteProduct: () => deleteProduct,
  getAllKeys: () => getAllKeys,
  getAllUsers: () => getAllUsers,
  getAvailableKeys: () => getAvailableKeys,
  getDiscount: () => getDiscount,
  getDuration: () => getDuration,
  getDurations: () => getDurations,
  getOrCreateUser: () => getOrCreateUser,
  getPaymentMethod: () => getPaymentMethod,
  getPaymentMethods: () => getPaymentMethods,
  getPendingRecharges: () => getPendingRecharges,
  getProduct: () => getProduct,
  getProducts: () => getProducts,
  getProductsByCategory: () => getProductsByCategory,
  getRank: () => getRank,
  getRecharge: () => getRecharge,
  getStats: () => getStats,
  getUser: () => getUser,
  getUserMovements: () => getUserMovements,
  getUserPurchases: () => getUserPurchases,
  getUserRecharges: () => getUserRecharges,
  initializeDb: () => initializeDb,
  recordPurchase: () => recordPurchase,
  registerReferral: () => registerReferral,
  rejectRecharge: () => rejectRecharge,
  renameProduct: () => renameProduct,
  unbanUser: () => unbanUser,
  updateDurationPrice: () => updateDurationPrice,
  updatePaymentMethod: () => updatePaymentMethod,
  updateRechargePhoto: () => updateRechargePhoto,
  useKey: () => useKey
});
async function initializeDb() {
  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const clientEmail = process.env["FIREBASE_CLIENT_EMAIL"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"]?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan variables de entorno de Firebase: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY"
    );
  }
  if ((0, import_app.getApps)().length === 0) {
    (0, import_app.initializeApp)({ credential: (0, import_app.cert)({ projectId, clientEmail, privateKey }) });
  }
  firestoreDb = (0, import_firestore.getFirestore)();
  const doc = await firestoreDb.collection("bot").doc("data").get();
  if (doc.exists) {
    const loaded = doc.data();
    cache = { ...defaultData, ...loaded };
    cache._seq = { ...defaultData._seq, ...loaded._seq };
  }
  console.log(`\u{1F4E6} DB cargada: ${cache.users.length} usuarios, ${cache.products.length} productos`);
}
function save() {
  if (!firestoreDb) return;
  firestoreDb.collection("bot").doc("data").set(cache).catch((err) => {
    console.error("\u274C Error guardando en Firestore:", err);
  });
}
function nextId(key) {
  cache._seq[key]++;
  return cache._seq[key];
}
function getOrCreateUser(telegramId, username, firstName) {
  let user = cache.users.find((u) => u.telegram_id === telegramId);
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
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  cache.users.push(user);
  save();
  return user;
}
function getUser(telegramId) {
  return cache.users.find((u) => u.telegram_id === telegramId);
}
function getAllUsers() {
  return [...cache.users].reverse();
}
function banUser(telegramId) {
  const u = cache.users.find((u2) => u2.telegram_id === telegramId);
  if (u) {
    u.banned = true;
    save();
  }
}
function unbanUser(telegramId) {
  const u = cache.users.find((u2) => u2.telegram_id === telegramId);
  if (u) {
    u.banned = false;
    save();
  }
}
function addBalance(telegramId, amount) {
  const u = cache.users.find((u2) => u2.telegram_id === telegramId);
  if (u) {
    u.balance += amount;
    save();
  }
}
function deductBalance(telegramId, amount) {
  const u = cache.users.find((u2) => u2.telegram_id === telegramId);
  if (u) {
    u.balance -= amount;
    u.total_spent += amount;
    u.purchases++;
    save();
  }
}
function registerReferral(newUserId, referrerId) {
  const newUser = cache.users.find((u) => u.telegram_id === newUserId);
  const referrer = cache.users.find((u) => u.telegram_id === referrerId);
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
function getProducts() {
  return cache.products;
}
function getProductsByCategory(category) {
  return cache.products.filter((p) => p.category === category);
}
function getProduct(id) {
  return cache.products.find((p) => p.id === id);
}
function createProduct(name, category) {
  const id = nextId("products");
  cache.products.push({ id, name, category, created_at: (/* @__PURE__ */ new Date()).toISOString() });
  save();
  return id;
}
function renameProduct(id, name) {
  const p = cache.products.find((p2) => p2.id === id);
  if (p) {
    p.name = name;
    save();
  }
}
function deleteProduct(id) {
  cache.products = cache.products.filter((p) => p.id !== id);
  cache.durations = cache.durations.filter((d) => d.product_id !== id);
  cache.keys = cache.keys.filter((k) => k.product_id !== id);
  save();
}
function getDurations(productId) {
  return cache.durations.filter((d) => d.product_id === productId);
}
function getDuration(id) {
  return cache.durations.find((d) => d.id === id);
}
function createDuration(productId, label, price) {
  const id = nextId("durations");
  cache.durations.push({ id, product_id: productId, label, price });
  save();
  return id;
}
function deleteDuration(id) {
  cache.durations = cache.durations.filter((d) => d.id !== id);
  save();
}
function updateDurationPrice(id, price) {
  const d = cache.durations.find((d2) => d2.id === id);
  if (d) {
    d.price = price;
    save();
  }
}
function getAvailableKeys(productId, durationId) {
  return cache.keys.filter(
    (k) => k.product_id === productId && !k.used && (durationId === void 0 || k.duration_id === durationId)
  );
}
function getAllKeys(productId) {
  return cache.keys.filter((k) => k.product_id === productId);
}
function addKeys(productId, durationId, keys) {
  for (const kv of keys) {
    const id = nextId("keys");
    cache.keys.push({ id, product_id: productId, duration_id: durationId, key_value: kv.trim(), used: false });
  }
  save();
}
function useKey(keyId, userId) {
  const k = cache.keys.find((k2) => k2.id === keyId);
  if (k) {
    k.used = true;
    k.used_by = userId;
    k.used_at = (/* @__PURE__ */ new Date()).toISOString();
    save();
  }
}
function getPaymentMethods() {
  return cache.payment_methods;
}
function getPaymentMethod(id) {
  return cache.payment_methods.find((m) => m.id === id);
}
function createPaymentMethod(data) {
  const id = nextId("methods");
  cache.payment_methods.push({ id, ...data });
  save();
  return id;
}
function updatePaymentMethod(id, field, value) {
  const m = cache.payment_methods.find((m2) => m2.id === id);
  if (m) {
    m[field] = value;
    save();
  }
}
function deletePaymentMethod(id) {
  cache.payment_methods = cache.payment_methods.filter((m) => m.id !== id);
  save();
}
function createRecharge(data) {
  const id = nextId("recharges");
  cache.recharges.push({
    id,
    transaction_id: data.transactionId,
    user_id: data.userId,
    country: data.country,
    amount_usd: data.amountUsd,
    amount_local: data.amountLocal,
    status: "pending",
    created_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  save();
}
function updateRechargePhoto(transactionId, photoFileId) {
  const r = cache.recharges.find((r2) => r2.transaction_id === transactionId);
  if (r) {
    r.photo_file_id = photoFileId;
    save();
  }
}
function getPendingRecharges() {
  return cache.recharges.filter((r) => r.status === "pending").map((r) => {
    const user = cache.users.find((u) => u.telegram_id === r.user_id);
    return { ...r, username: user?.username, first_name: user?.first_name };
  });
}
function getRecharge(transactionId) {
  return cache.recharges.find((r) => r.transaction_id === transactionId);
}
function approveRecharge(transactionId) {
  const r = cache.recharges.find((r2) => r2.transaction_id === transactionId);
  if (!r || r.status !== "pending") return null;
  r.status = "approved";
  r.processed_at = (/* @__PURE__ */ new Date()).toISOString();
  addBalance(r.user_id, r.amount_usd);
  addMovement(r.user_id, "recharge", `Recarga: $${r.amount_usd.toFixed(2)} USD (ID: ${transactionId})`, r.amount_usd);
  save();
  return r;
}
function rejectRecharge(transactionId) {
  const r = cache.recharges.find((r2) => r2.transaction_id === transactionId);
  if (!r || r.status !== "pending") return null;
  r.status = "rejected";
  r.processed_at = (/* @__PURE__ */ new Date()).toISOString();
  save();
  return r;
}
function getUserRecharges(userId) {
  return cache.recharges.filter((r) => r.user_id === userId).reverse();
}
function getUserPurchases(userId) {
  return cache.purchases.filter((p) => p.user_id === userId).reverse().map((p) => {
    const product = cache.products.find((pr) => pr.id === p.product_id);
    const duration = cache.durations.find((d) => d.id === p.duration_id);
    const key = cache.keys.find((k) => k.id === p.key_id);
    return {
      ...p,
      product_name: product?.name ?? "Producto eliminado",
      duration_label: duration?.label,
      key_value: key?.key_value
    };
  });
}
function recordPurchase(userId, productId, durationId, keyId, price) {
  const id = nextId("purchases");
  cache.purchases.push({ id, user_id: userId, product_id: productId, duration_id: durationId, key_id: keyId, price, purchased_at: (/* @__PURE__ */ new Date()).toISOString() });
  deductBalance(userId, price);
  addMovement(userId, "purchase", `Compra realizada - $${price.toFixed(2)} USD`, -price);
  save();
}
function addMovement(userId, type, description, amount) {
  const id = nextId("movements");
  cache.movements.push({ id, user_id: userId, type, description, amount, created_at: (/* @__PURE__ */ new Date()).toISOString() });
  save();
}
function getUserMovements(userId) {
  return cache.movements.filter((m) => m.user_id === userId).reverse().slice(0, 20);
}
function getStats() {
  return {
    users: cache.users.length,
    pending: cache.recharges.filter((r) => r.status === "pending").length,
    products: cache.products.length
  };
}
function getRank(totalSpent) {
  if (totalSpent >= 200) return { name: "Diamante", emoji: "\u{1F48E}", nextName: "M\xE1ximo", nextAmount: 0 };
  if (totalSpent >= 100) return { name: "Oro", emoji: "\u{1F947}", nextName: "Diamante", nextAmount: 200 - totalSpent };
  if (totalSpent >= 50) return { name: "Plata", emoji: "\u{1F948}", nextName: "Oro", nextAmount: 100 - totalSpent };
  return { name: "Bronce", emoji: "\u{1F949}", nextName: "Plata", nextAmount: 50 - totalSpent };
}
function getDiscount(totalSpent) {
  if (totalSpent >= 200) return 15;
  if (totalSpent >= 100) return 10;
  if (totalSpent >= 50) return 5;
  return 0;
}
var import_app, import_firestore, defaultData, cache, firestoreDb;
var init_db = __esm({
  "src/bot/db.ts"() {
    "use strict";
    import_app = require("firebase-admin/app");
    import_firestore = require("firebase-admin/firestore");
    defaultData = {
      users: [],
      products: [],
      durations: [],
      keys: [],
      payment_methods: [],
      recharges: [],
      purchases: [],
      movements: [],
      _seq: { users: 0, products: 0, durations: 0, keys: 0, methods: 0, recharges: 0, purchases: 0, movements: 0 }
    };
    cache = JSON.parse(JSON.stringify(defaultData));
    firestoreDb = null;
  }
});

// src/index.ts
init_db();

// src/bot/index.ts
var import_node_telegram_bot_api = __toESM(require("node-telegram-bot-api"));
init_db();

// src/bot/state.ts
var userStates = /* @__PURE__ */ new Map();
function getState(userId) {
  return userStates.get(userId) ?? { step: "idle" };
}
function setState(userId, state) {
  userStates.set(userId, state);
}
function clearState(userId) {
  userStates.set(userId, { step: "idle" });
}

// src/bot/handlers/menu.ts
init_db();

// src/bot/keyboards.ts
var mainMenu = (showAdm = false) => ({
  keyboard: [
    [{ text: "\u{1F6D2} Ver Productos" }, { text: "\u{1F4CB} Mis Compras" }],
    [{ text: "\u{1F464} Mi Perfil" }],
    [{ text: "\u{1F4E6} Mis Movimientos" }, { text: "\u{1F4B3} Recargar Saldo" }],
    [{ text: "\u{1F465} Invitar Amigos" }],
    ...showAdm ? [[{ text: "\u2699\uFE0F Men\xFA ADM" }]] : []
  ],
  resize_keyboard: true
});
var backToMain = () => ({
  inline_keyboard: [[{ text: "\u25C0\uFE0F Volver Al Men\xFA", callback_data: "main_menu" }]]
});
var categoryKeyboard = () => ({
  inline_keyboard: [
    [{ text: "\u{1F916} Android", callback_data: "cat_android" }, { text: "\u{1F34E} iOS", callback_data: "cat_ios" }],
    [{ text: "\u{1F5A5}\uFE0F PC", callback_data: "cat_pc" }],
    [{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]
  ]
});
var admMenu = () => ({
  inline_keyboard: [
    [{ text: "\u{1F4E6} Productos", callback_data: "adm_products" }, { text: "\u{1F4B3} M\xE9todos de Pago", callback_data: "adm_methods" }],
    [{ text: "\u{1F4B0} Recargas Pendientes", callback_data: "adm_recharges" }, { text: "\u{1F465} Usuarios", callback_data: "adm_users" }],
    [{ text: "\u{1F6AB} Banear / Desbanear", callback_data: "adm_ban" }, { text: "\u{1F4E2} Broadcast", callback_data: "adm_broadcast" }]
  ]
});
var rechargeCountryKeyboard = (methods) => {
  const rows = methods.map((m) => [{
    text: `${m.emoji} ${m.country} (${m.currency}, m\xEDn $${m.minimum})`,
    callback_data: `recharge_method_${m.id}`
  }]);
  rows.push([{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]);
  return { inline_keyboard: rows };
};

// src/bot/handlers/menu.ts
var ADMIN_ID = Number(process.env["ADMIN_ID"] ?? "0");
async function handleStart(bot, msg, referrerId) {
  const { id, username, first_name } = msg.from;
  const user = getOrCreateUser(id, username, first_name);
  if (referrerId && referrerId !== id && !user.referred_by) {
    const { registerReferral: registerReferral2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    registerReferral2(id, referrerId);
  }
  if (user.banned) {
    await bot.sendMessage(id, "\u{1F6AB} Tu cuenta ha sido baneado. Contacta al administrador.");
    return;
  }
  clearState(id);
  const rank = getRank(user.total_spent);
  const name = user.first_name || user.username || "Usuario";
  const isAdm = id === ADMIN_ID;
  await bot.sendMessage(
    id,
    `\u{1F3EA} *RASHY STORE*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F44B} \xA1Hola de vuelta, ${name}!

\u{1F4B0} *Saldo:* $${Number(user.balance).toFixed(2)} USD
${rank.emoji} *Rango:* ${rank.name}

Elige una opci\xF3n del men\xFA \u{1F447}`,
    { parse_mode: "Markdown", reply_markup: mainMenu(isAdm) }
  );
}
async function sendMainMenu(bot, chatId) {
  const user = getOrCreateUser(chatId);
  clearState(chatId);
  const rank = getRank(user.total_spent ?? 0);
  const name = user.first_name || user.username || "Usuario";
  const isAdm = chatId === ADMIN_ID;
  await bot.sendMessage(
    chatId,
    `\u{1F3EA} *RASHY STORE*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F44B} \xA1Hola de vuelta, ${name}!

\u{1F4B0} *Saldo:* $${Number(user.balance).toFixed(2)} USD
${rank.emoji} *Rango:* ${rank.name}

Elige una opci\xF3n del men\xFA \u{1F447}`,
    { parse_mode: "Markdown", reply_markup: mainMenu(isAdm) }
  );
}

// src/bot/handlers/profile.ts
init_db();
async function handleProfile(bot, chatId) {
  const user = getUser(chatId);
  if (!user) return;
  const rank = getRank(user.total_spent);
  const discount = getDiscount(user.total_spent);
  const text = `\u{1F464} *MI PERFIL*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1FAAA} @${user.username || "sin_usuario"}
\u{1F194} ID: \`${user.telegram_id}\`

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F4B0} *Saldo:* $${Number(user.balance).toFixed(2)} USD
\u{1F6CD}\uFE0F *Compras:* ${user.purchases}
\u{1F4CA} *Total gastado:* $${Number(user.total_spent).toFixed(2)} USD
\u{1F39F}\uFE0F *Descuento activo:* ${discount}%

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${rank.emoji} *Rango:* ${rank.name}
` + (rank.nextAmount > 0 ? `\u{1F4C8} *Pr\xF3ximo rango:* ${rank.nextName} ($${rank.nextAmount.toFixed(2)} m\xE1s)` : `\u{1F3C6} \xA1Has alcanzado el rango m\xE1ximo!`);
  await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: backToMain() });
}
async function handleMovements(bot, chatId) {
  const movements = getUserMovements(chatId);
  if (movements.length === 0) {
    await bot.sendMessage(chatId, "\u{1F4E6} *MIS MOVIMIENTOS*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\u274C No tienes movimientos a\xFAn.", {
      parse_mode: "Markdown",
      reply_markup: backToMain()
    });
    return;
  }
  let text = "\u{1F4E6} *MIS MOVIMIENTOS*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n";
  for (const m of movements) {
    const sign = m.amount > 0 ? "+" : "";
    const date = new Date(m.created_at).toLocaleDateString("es", { day: "numeric", month: "numeric" });
    text += `\u{1F4B3} ${m.description}
${sign}$${Math.abs(m.amount).toFixed(2)} USD \xB7 ${date}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

`;
  }
  await bot.sendMessage(chatId, text.trim(), { parse_mode: "Markdown", reply_markup: backToMain() });
}
async function handlePurchases(bot, chatId) {
  const purchases = getUserPurchases(chatId);
  if (purchases.length === 0) {
    await bot.sendMessage(chatId, "\u{1F4CB} *Mis Compras*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\u274C No Tienes Compras A\xFAn.", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "\u25C0\uFE0F Volver Al Men\xFA", callback_data: "main_menu" }]] }
    });
    return;
  }
  let text = "\u{1F4CB} *Mis Compras*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n";
  for (const p of purchases) {
    const date = new Date(p.purchased_at).toLocaleDateString("es", { day: "numeric", month: "numeric" });
    text += `\u{1F4E6} *${p.product_name}*${p.duration_label ? ` - ${p.duration_label}` : ""}
`;
    text += `\u{1F4B0} $${Number(p.price).toFixed(2)} USD \xB7 ${date}
`;
    if (p.key_value) text += `\u{1F511} \`${p.key_value}\`
`;
    text += "\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n";
  }
  await bot.sendMessage(chatId, text.trim(), { parse_mode: "Markdown", reply_markup: backToMain() });
}
async function handleReferral(bot, chatId, botUsername) {
  const user = getUser(chatId);
  if (!user) return;
  const link = `https://t.me/${botUsername}?start=ref_${chatId}`;
  const text = `\u{1F465} *Programa de Referidos*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

Comparte tu enlace y gana *$0.50 USD* por cada 14 personas nuevas que se registren.

\u{1F517} *Tu enlace:*
${link}

\u{1F4CA} *Tus estad\xEDsticas:*
\u2705 Total referidos: ${user.referral_count}
\u23F3 Para el pr\xF3ximo bono: ${14 - user.referral_count % 14} m\xE1s

_Solo cuentan personas nuevas que no estaban registradas antes._`;
  await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: backToMain() });
}

// src/bot/handlers/products.ts
init_db();
var catLabel = {
  android: "\u{1F916} Android",
  ios: "\u{1F34E} iOS",
  pc: "\u{1F5A5}\uFE0F PC"
};
function randomOrderId() {
  return Math.floor(1e7 + Math.random() * 9e7).toString();
}
function formatDate(date) {
  return date.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}
async function handleViewProducts(bot, chatId) {
  await bot.sendMessage(chatId, "\u{1F4E6} *Elige Para Qu\xE9 Categor\xEDa Deseas:*", {
    parse_mode: "Markdown",
    reply_markup: categoryKeyboard()
  });
}
async function handleCategory(bot, chatId, category) {
  const products = getProductsByCategory(category);
  if (products.length === 0) {
    await bot.sendMessage(chatId, `\u274C No hay productos en ${catLabel[category] ?? category} por ahora.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u25C0\uFE0F Categor\xEDas", callback_data: "view_products" }, { text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]
        ]
      }
    });
    return;
  }
  const keyboard = products.map((p) => {
    const keys = getAvailableKeys(p.id);
    return [{ text: `\u{1F4E6} ${p.name} (${keys.length} keys)`, callback_data: `product_${p.id}` }];
  });
  keyboard.push([
    { text: "\u25C0\uFE0F Categor\xEDas", callback_data: "view_products" },
    { text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }
  ]);
  await bot.sendMessage(chatId, `\u{1F6D2} *Elige Tu Producto Para ${catLabel[category] ?? category}*`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}
async function handleProductDetail(bot, chatId, productId) {
  const product = getProduct(productId);
  if (!product) return;
  const durations = getDurations(productId);
  const user = getUser(chatId);
  if (durations.length === 0) {
    await bot.sendMessage(chatId, "\u274C Este producto no tiene duraciones configuradas a\xFAn.", {
      reply_markup: { inline_keyboard: [[{ text: "\u25C0\uFE0F Volver", callback_data: `cat_${product.category}` }]] }
    });
    return;
  }
  const discount = user ? user.total_spent >= 200 ? 0.15 : user.total_spent >= 100 ? 0.1 : user.total_spent >= 50 ? 0.05 : 0 : 0;
  const keyboard = [];
  for (const d of durations) {
    const availableKeys = getAvailableKeys(productId, d.id);
    const finalPrice = d.price * (1 - discount);
    const stockLabel = availableKeys.length > 0 ? `\u2705 ${availableKeys.length}` : "\u274C Sin stock";
    keyboard.push([{
      text: `${d.label} - $${finalPrice.toFixed(2)} USD (${stockLabel})`,
      callback_data: `buy_${productId}_${d.id}`
    }]);
  }
  keyboard.push([{ text: "\u25C0\uFE0F Volver", callback_data: `cat_${product.category}` }]);
  await bot.sendMessage(chatId, `\u{1F4E6} *${product.name}*
Selecciona una opci\xF3n:`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}
async function handleBuy(bot, chatId, productId, durationId) {
  const product = getProduct(productId);
  const durations = getDurations(productId);
  const duration = durations.find((d) => d.id === durationId);
  const user = getUser(chatId);
  if (!product || !duration || !user) return;
  const discount = user.total_spent >= 200 ? 0.15 : user.total_spent >= 100 ? 0.1 : user.total_spent >= 50 ? 0.05 : 0;
  const finalPrice = duration.price * (1 - discount);
  const availableKeys = getAvailableKeys(productId, durationId);
  if (availableKeys.length === 0) {
    await bot.sendMessage(chatId, "\u274C *Sin stock disponible.*\nContacta al administrador.", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "\u25C0\uFE0F Volver", callback_data: `product_${productId}` }]] }
    });
    return;
  }
  if (user.balance < finalPrice) {
    await bot.sendMessage(
      chatId,
      `\u274C *Saldo insuficiente.*

Necesitas: $${finalPrice.toFixed(2)} USD
Tu saldo: $${Number(user.balance).toFixed(2)} USD`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{1F4B3} Recargar Saldo", callback_data: "recharge" }],
            [{ text: "\u25C0\uFE0F Volver", callback_data: `product_${productId}` }]
          ]
        }
      }
    );
    return;
  }
  setState(chatId, { step: "buy_confirm", productId, durationId, price: finalPrice });
  await bot.sendMessage(
    chatId,
    `\u{1F6D2} *Confirmar Compra*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F4E6} ${product.name}
\u23F1\uFE0F ${duration.label}
\u{1F4B0} Precio: $${finalPrice.toFixed(2)} USD

\xBFConfirmas la compra?`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u2705 Confirmar", callback_data: `confirm_buy_${productId}_${durationId}` }],
          [{ text: "\u274C Cancelar", callback_data: `product_${productId}` }]
        ]
      }
    }
  );
}
async function handleConfirmBuy(bot, chatId, productId, durationId) {
  const product = getProduct(productId);
  const durations = getDurations(productId);
  const duration = durations.find((d) => d.id === durationId);
  const user = getUser(chatId);
  if (!product || !duration || !user) return;
  const discount = user.total_spent >= 200 ? 0.15 : user.total_spent >= 100 ? 0.1 : user.total_spent >= 50 ? 0.05 : 0;
  const finalPrice = duration.price * (1 - discount);
  const suggestedPrice = finalPrice * 1.3;
  const availableKeys = getAvailableKeys(productId, durationId);
  if (availableKeys.length === 0 || user.balance < finalPrice) {
    await bot.sendMessage(chatId, "\u274C No se pudo completar la compra. Intenta de nuevo.", {
      reply_markup: { inline_keyboard: [[{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]] }
    });
    return;
  }
  const key = availableKeys[0];
  useKey(key.id, chatId);
  recordPurchase(chatId, productId, durationId, key.id, finalPrice);
  clearState(chatId);
  const orderId = randomOrderId();
  const fecha = formatDate(/* @__PURE__ */ new Date());
  await bot.sendMessage(
    chatId,
    `\u2705 *Compra Realizada Con \xC9xito*

\u{1F4C5} *Fecha:* ${fecha}
\u{1F4E6} *Producto:* ${product.name}
\u23F3 *Duraci\xF3n:* ${duration.label}
\u{1F4B0} *Precio sugerido:* $${suggestedPrice.toFixed(2)} USD
\u{1F4B0} *Total:* $${finalPrice.toFixed(2)} USD
\u{1F9FE} *Orden:* #${orderId}

\u{1F511} *Key 1:* \`${key.key_value}\``,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]] }
    }
  );
}

// src/bot/handlers/recharge.ts
init_db();
var RECEIPTS_GROUP_ID = process.env["RECEIPTS_GROUP_ID"] ?? "";
function generateTransactionId() {
  return "TP" + Date.now();
}
async function handleRecharge(bot, chatId) {
  const methods = getPaymentMethods();
  if (methods.length === 0) {
    await bot.sendMessage(chatId, "\u274C No hay m\xE9todos de pago configurados. Contacta al administrador.", {
      reply_markup: { inline_keyboard: [[{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]] }
    });
    return;
  }
  await bot.sendMessage(chatId, "\u{1F4B3} *Recargar Saldo*\n\n\xBFDesde Qu\xE9 Pa\xEDs Deseas Recargar?", {
    parse_mode: "Markdown",
    reply_markup: rechargeCountryKeyboard(methods)
  });
}
async function handleRechargeMethod(bot, chatId, methodId) {
  const method = getPaymentMethod(methodId);
  if (!method) return;
  setState(chatId, { step: "recharge_amount", country: method.country, methodId });
  await bot.sendMessage(
    chatId,
    `\u{1F4B3} *RECARGAR SALDO*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F30D} ${method.emoji} ${method.country}
\u{1F4B5} M\xEDnimo: $${method.minimum.toFixed(2)} USD

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\xBFCu\xE1nto deseas recargar (en USD)?
_Ejemplo: 10_`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "\u25C0\uFE0F Volver Al Men\xFA", callback_data: "main_menu" }]] }
    }
  );
}
async function handleRechargeAmount(bot, chatId, text) {
  const state = getState(chatId);
  if (state.step !== "recharge_amount") return;
  const amount = parseFloat(text);
  const method = getPaymentMethod(state.methodId);
  if (!method || isNaN(amount) || amount < method.minimum) {
    await bot.sendMessage(chatId, `\u274C Monto inv\xE1lido. El m\xEDnimo es $${method?.minimum ?? 0} USD.`);
    return;
  }
  const transactionId = generateTransactionId();
  const amountLocal = amount * method.rate;
  createRecharge({ transactionId, userId: chatId, country: method.country, amountUsd: amount, amountLocal });
  setState(chatId, { step: "recharge_photo", transactionId, country: method.country, amountUsd: amount });
  await bot.sendMessage(
    chatId,
    `\u{1F4B3} *INSTRUCCIONES DE PAGO*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F30D} ${method.emoji} ${method.country}
\u{1F194} Recarga: \`${transactionId}\`
\u{1F4B0} Monto USD: $${amount.toFixed(2)} USD
\u{1F4B5} Total a pagar: ${amountLocal.toFixed(2)} ${method.currency}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F3E6} Banco: ${method.bank}
\u{1F464} Titular: ${method.holder}
\u{1F4CB} Cuenta: \`${method.account}\`
\u{1F4B8} Enviar: ${amountLocal.toFixed(2)} ${method.currency}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F4F8} Env\xEDa la foto del comprobante aqu\xED mismo.`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u{1F4F8} Ya Mand\xE9 el Comprobante", callback_data: `recharge_sent_${transactionId}` }],
          [{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]
        ]
      }
    }
  );
}
async function handleRechargePhoto(bot, msg) {
  const chatId = msg.chat.id;
  const state = getState(chatId);
  if (state.step !== "recharge_photo") return;
  const photo = msg.photo;
  if (!photo || photo.length === 0) return;
  const fileId = photo[photo.length - 1].file_id;
  const { transactionId, amountUsd } = state;
  const recharge = getRecharge(transactionId);
  if (!recharge) return;
  updateRechargePhoto(transactionId, fileId);
  const user = msg.from;
  const userName = user.username ? `@${user.username}` : user.first_name ?? "Usuario";
  if (RECEIPTS_GROUP_ID) {
    try {
      await bot.sendPhoto(RECEIPTS_GROUP_ID, fileId, {
        caption: `\u{1F4F8} *Comprobante de Recarga*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F464} Usuario: ${userName}
\u{1F194} Telegram ID: \`${chatId}\`
\u{1F194} Transacci\xF3n: \`${transactionId}\`
\u{1F30D} Pa\xEDs: ${recharge.country}
\u{1F4B0} Monto: $${amountUsd.toFixed(2)} USD`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "\u2705 Aprobar", callback_data: `adm_approve_${transactionId}` },
            { text: "\u274C Rechazar", callback_data: `adm_reject_${transactionId}` }
          ]]
        }
      });
    } catch (err) {
      console.error("Error enviando al grupo:", err);
    }
  }
  clearState(chatId);
  await bot.sendMessage(
    chatId,
    `\u2705 *Comprobante recibido.*

Tu recarga de *$${amountUsd.toFixed(2)} USD* est\xE1 siendo verificada.
ID: \`${transactionId}\`

Te notificaremos cuando sea aprobada.`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]] }
    }
  );
}
async function handleRechargeSent(bot, chatId) {
  const state = getState(chatId);
  if (state.step === "recharge_photo") {
    await bot.sendMessage(chatId, "\u{1F4F8} Por favor env\xEDa la foto del comprobante directamente en el chat.");
  } else {
    await bot.sendMessage(chatId, "\u2705 Tu solicitud ya fue registrada. Espera la aprobaci\xF3n del administrador.", {
      reply_markup: { inline_keyboard: [[{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]] }
    });
  }
}

// src/bot/handlers/admin.ts
init_db();
var ADMIN_ID2 = Number(process.env["ADMIN_ID"] ?? "0");
function isAdmin(userId) {
  return userId === ADMIN_ID2;
}
async function handleAdmMenu(bot, chatId) {
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, "\u{1F6AB} No tienes permiso para acceder a esta secci\xF3n.");
    return;
  }
  const stats = getStats();
  await bot.sendMessage(
    chatId,
    `\u{1F451} *Panel de Administraci\xF3n*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F465} Usuarios: ${stats.users}
\u{1F4B3} Recargas pendientes: ${stats.pending}
\u{1F4E6} Productos: ${stats.products}`,
    { parse_mode: "Markdown", reply_markup: admMenu() }
  );
}
async function handleAdmProducts(bot, chatId) {
  const products = getProducts();
  const keyboard = products.map((p) => {
    const keys = getAllKeys(p.id).filter((k) => !k.used);
    return [{ text: `${p.name} (${keys.length} keys)`, callback_data: `adm_product_${p.id}` }];
  });
  keyboard.push([{ text: "\u2795 Agregar Producto", callback_data: "adm_add_product" }, { text: "\u25C0\uFE0F Volver", callback_data: "adm_menu" }]);
  await bot.sendMessage(chatId, "\u{1F4E6} *Gesti\xF3n de Productos*", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}
async function handleAdmProductDetail(bot, chatId, productId) {
  const product = getProduct(productId);
  if (!product) return;
  const durations = getDurations(productId);
  const keys = getAllKeys(productId);
  const totalStock = keys.filter((k) => !k.used).length;
  await bot.sendMessage(
    chatId,
    `\u{1F4E6} *${product.name}*
Categor\xEDa: ${product.category}
Duraciones: ${durations.length}
Stock total: ${totalStock} keys`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u270F\uFE0F Renombrar", callback_data: `adm_rename_${productId}` }, { text: "\u{1F4E6} Agregar Stock", callback_data: `adm_stock_menu_${productId}` }],
          [{ text: "\u{1F511} Agregar Keys", callback_data: `adm_addkeys_menu_${productId}` }, { text: "\u{1F4B0} Editar Precio", callback_data: `adm_editprice_menu_${productId}` }],
          [{ text: "\u2795 Nueva Duraci\xF3n", callback_data: `adm_newduration_${productId}` }, { text: "\u{1F5D1}\uFE0F Eliminar Duraci\xF3n", callback_data: `adm_delduration_menu_${productId}` }],
          [{ text: "\u274C Eliminar Producto", callback_data: `adm_delproduct_${productId}` }],
          [{ text: "\u25C0\uFE0F Volver", callback_data: "adm_products" }]
        ]
      }
    }
  );
}
async function startAddProduct(bot, chatId) {
  setState(chatId, { step: "adm_add_product_name" });
  await bot.sendMessage(chatId, "\u{1F4E6} *Agregar Producto*\n\nEscribe el *nombre* del nuevo producto:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: "adm_products" }]] }
  });
}
async function handleAdmRenameProduct(bot, chatId, productId) {
  setState(chatId, { step: "adm_rename_product", productId });
  await bot.sendMessage(chatId, "\u270F\uFE0F Escribe el nuevo nombre del producto:", {
    reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${productId}` }]] }
  });
}
async function handleAdmDeleteProduct(bot, chatId, productId) {
  const product = getProduct(productId);
  if (!product) return;
  deleteProduct(productId);
  clearState(chatId);
  await bot.sendMessage(chatId, `\u2705 Producto *${product.name}* eliminado.`, { parse_mode: "Markdown" });
  await handleAdmProducts(bot, chatId);
}
async function handleAdmNewDuration(bot, chatId, productId) {
  setState(chatId, { step: "adm_add_duration_label", productId });
  await bot.sendMessage(chatId, "\u2795 *Nueva Duraci\xF3n*\n\nEscribe el nombre/duraci\xF3n (ej: 1 mes, 7 d\xEDas, Lifetime):", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${productId}` }]] }
  });
}
async function handleAdmDelDurationMenu(bot, chatId, productId) {
  const durations = getDurations(productId);
  if (durations.length === 0) {
    await bot.sendMessage(chatId, "\u274C No hay duraciones para eliminar.");
    return;
  }
  const keyboard = durations.map((d) => [{ text: `\u{1F5D1}\uFE0F ${d.label} - $${d.price}`, callback_data: `adm_delduration_${d.id}_${productId}` }]);
  keyboard.push([{ text: "\u25C0\uFE0F Volver", callback_data: `adm_product_${productId}` }]);
  await bot.sendMessage(chatId, "\u{1F5D1}\uFE0F *Eliminar Duraci\xF3n*\nElige cu\xE1l eliminar:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}
async function handleAdmDelDuration(bot, chatId, durationId, productId) {
  deleteDuration(durationId);
  await bot.sendMessage(chatId, "\u2705 Duraci\xF3n eliminada.");
  await handleAdmProductDetail(bot, chatId, productId);
}
async function handleAdmEditPriceMenu(bot, chatId, productId) {
  const durations = getDurations(productId);
  if (durations.length === 0) {
    await bot.sendMessage(chatId, "\u274C No hay duraciones para editar.");
    return;
  }
  const keyboard = durations.map((d) => [{ text: `\u{1F4B0} ${d.label} - $${d.price}`, callback_data: `adm_editprice_${productId}_${d.id}` }]);
  keyboard.push([{ text: "\u25C0\uFE0F Volver", callback_data: `adm_product_${productId}` }]);
  await bot.sendMessage(chatId, "\u{1F4B0} *Editar Precio*\nElige la duraci\xF3n:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}
async function handleAdmEditPrice(bot, chatId, productId, durationId) {
  setState(chatId, { step: "adm_edit_price", productId, durationId });
  await bot.sendMessage(chatId, "\u{1F4B0} Escribe el nuevo precio en USD (ej: 5.99):", {
    reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${productId}` }]] }
  });
}
async function handleAdmAddKeysMenu(bot, chatId, productId) {
  const durations = getDurations(productId);
  if (durations.length === 0) {
    await bot.sendMessage(chatId, "\u274C Agrega al menos una duraci\xF3n antes de agregar keys.");
    return;
  }
  const keyboard = durations.map((d) => [{ text: `\u{1F511} ${d.label}`, callback_data: `adm_addkeys_${productId}_${d.id}` }]);
  keyboard.push([{ text: "\u25C0\uFE0F Volver", callback_data: `adm_product_${productId}` }]);
  await bot.sendMessage(chatId, "\u{1F511} *Agregar Keys*\nElige la duraci\xF3n:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}
async function handleAdmAddKeys(bot, chatId, productId, durationId) {
  setState(chatId, { step: "adm_add_keys", productId, durationId });
  await bot.sendMessage(chatId, "\u{1F511} *Agregar Keys*\n\nEscribe las keys, una por l\xEDnea:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${productId}` }]] }
  });
}
async function handleAdmAddStockMenu(bot, chatId, productId) {
  await handleAdmAddKeysMenu(bot, chatId, productId);
}
async function handleAdmMethods(bot, chatId) {
  const methods = getPaymentMethods();
  const keyboard = methods.map((m) => [{
    text: `${m.emoji} ${m.country} (${m.currency}, m\xEDn $${m.minimum})`,
    callback_data: `adm_method_${m.id}`
  }]);
  keyboard.push([{ text: "\u2795 Agregar M\xE9todo", callback_data: "adm_add_method" }, { text: "\u25C0\uFE0F Volver", callback_data: "adm_menu" }]);
  await bot.sendMessage(chatId, "\u{1F4B3} *M\xE9todos de Pago*", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard }
  });
}
async function handleAdmMethodDetail(bot, chatId, methodId) {
  const m = getPaymentMethod(methodId);
  if (!m) return;
  await bot.sendMessage(
    chatId,
    `\u{1F4B3} *${m.emoji} ${m.country}*
\u{1F3E6} Banco: ${m.bank}
\u{1F464} Titular: ${m.holder}
\u{1F4CB} Cuenta: \`${m.account}\`
\u{1F4B5} M\xEDnimo: $${m.minimum} USD
\u{1F4CA} Tasa: ${m.rate} ${m.currency}/USD`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u{1F3E6} Banco", callback_data: `adm_mfield_${methodId}_bank` }, { text: "\u{1F464} Titular", callback_data: `adm_mfield_${methodId}_holder` }],
          [{ text: "\u{1F4CB} Cuenta", callback_data: `adm_mfield_${methodId}_account` }, { text: "\u{1F4B5} M\xEDnimo", callback_data: `adm_mfield_${methodId}_minimum` }],
          [{ text: "\u{1F4CA} Tasa", callback_data: `adm_mfield_${methodId}_rate` }, { text: "\u{1F30D} Pa\xEDs/Emoji", callback_data: `adm_mfield_${methodId}_country` }],
          [{ text: "\u274C Eliminar M\xE9todo", callback_data: `adm_delmethod_${methodId}` }],
          [{ text: "\u25C0\uFE0F Volver", callback_data: "adm_methods" }]
        ]
      }
    }
  );
}
async function handleAdmMethodFieldEdit(bot, chatId, methodId, field) {
  setState(chatId, { step: "adm_edit_method_field", methodId, field });
  const labels = {
    bank: "nombre del banco",
    holder: "nombre del titular",
    account: "n\xFAmero de cuenta",
    minimum: "monto m\xEDnimo en USD (ej: 2)",
    rate: "tasa de cambio (ej: 20)",
    country: "nombre del pa\xEDs",
    emoji: "emoji del pa\xEDs (ej: \u{1F1F2}\u{1F1FD})",
    currency: "c\xF3digo de moneda (ej: MXN, ARS, USDT)"
  };
  await bot.sendMessage(chatId, `\u270F\uFE0F Escribe el nuevo valor para: *${labels[field] ?? field}*`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_method_${methodId}` }]] }
  });
}
async function handleAdmDeleteMethod(bot, chatId, methodId) {
  deletePaymentMethod(methodId);
  await bot.sendMessage(chatId, "\u2705 M\xE9todo de pago eliminado.");
  await handleAdmMethods(bot, chatId);
}
async function startAddMethod(bot, chatId) {
  setState(chatId, { step: "adm_add_method_country" });
  await bot.sendMessage(chatId, "\u2795 *Agregar M\xE9todo de Pago*\n\nEscribe el nombre del pa\xEDs (ej: M\xE9xico):", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: "adm_methods" }]] }
  });
}
async function handleAdmRecharges(bot, chatId) {
  const recharges = getPendingRecharges();
  if (recharges.length === 0) {
    await bot.sendMessage(chatId, "\u2705 No hay recargas pendientes.", {
      reply_markup: { inline_keyboard: [[{ text: "\u25C0\uFE0F Volver", callback_data: "adm_menu" }]] }
    });
    return;
  }
  for (const r of recharges) {
    const userName = r.username ? `@${r.username}` : r.first_name ?? "Usuario";
    const text = `\u{1F4B3} *Recarga Pendiente*
\u{1F194} ${r.transaction_id}
\u{1F464} ${userName}
\u{1F30D} ${r.country}
\u{1F4B0} $${Number(r.amount_usd).toFixed(2)} USD`;
    const keyboard = {
      inline_keyboard: [[
        { text: "\u2705 Aprobar", callback_data: `adm_approve_${r.transaction_id}` },
        { text: "\u274C Rechazar", callback_data: `adm_reject_${r.transaction_id}` }
      ]]
    };
    if (r.photo_file_id) {
      await bot.sendPhoto(chatId, r.photo_file_id, { caption: text, parse_mode: "Markdown", reply_markup: keyboard });
    } else {
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: keyboard });
    }
  }
}
async function handleAdmApprove(bot, adminId, transactionId) {
  const recharge = approveRecharge(transactionId);
  if (!recharge) {
    await bot.sendMessage(adminId, "\u274C Recarga no encontrada o ya procesada.");
    return;
  }
  await bot.sendMessage(
    adminId,
    `\u2705 Recarga \`${transactionId}\` aprobada. +$${Number(recharge.amount_usd).toFixed(2)} USD al usuario \`${recharge.user_id}\`.`,
    { parse_mode: "Markdown" }
  );
  try {
    await bot.sendMessage(
      recharge.user_id,
      `\u2705 *\xA1Recarga Aprobada!*

Tu recarga de *$${Number(recharge.amount_usd).toFixed(2)} USD* ha sido acreditada.
ID: \`${transactionId}\``,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "\u{1F3E0} Men\xFA Principal", callback_data: "main_menu" }]] } }
    );
  } catch (_) {
  }
}
async function handleAdmReject(bot, adminId, transactionId) {
  const recharge = rejectRecharge(transactionId);
  if (!recharge) {
    await bot.sendMessage(adminId, "\u274C Recarga no encontrada o ya procesada.");
    return;
  }
  await bot.sendMessage(adminId, `\u274C Recarga \`${transactionId}\` rechazada.`, { parse_mode: "Markdown" });
  try {
    await bot.sendMessage(
      recharge.user_id,
      `\u274C *Recarga Rechazada*

Tu recarga de *$${Number(recharge.amount_usd).toFixed(2)} USD* fue rechazada.
ID: \`${transactionId}\`

Contacta al administrador si crees que es un error.`,
      { parse_mode: "Markdown" }
    );
  } catch (_) {
  }
}
async function handleAdmUsers(bot, chatId) {
  const users = getAllUsers();
  if (users.length === 0) {
    await bot.sendMessage(chatId, "\u274C No hay usuarios registrados.");
    return;
  }
  let text = "\u{1F465} *Lista de Usuarios*\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n";
  for (const u of users.slice(0, 20)) {
    const name = u.username ? `@${u.username}` : u.first_name ?? "Sin nombre";
    text += `\u{1F464} ${name} | ID: \`${u.telegram_id}\` | Saldo: $${Number(u.balance).toFixed(2)} | ${u.banned ? "\u{1F6AB} Baneado" : "\u2705"}
`;
  }
  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "\u25C0\uFE0F Volver", callback_data: "adm_menu" }]] }
  });
}
async function handleAdmBan(bot, chatId) {
  setState(chatId, { step: "adm_ban" });
  await bot.sendMessage(
    chatId,
    `\u{1F6AB} *Banear / Desbanear Usuario*
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

Escribe el *ID de Telegram* del usuario.

_Puedes verlos en \u{1F465} Usuarios._`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: "adm_menu" }]] }
    }
  );
}
async function handleAdmBroadcast(bot, chatId) {
  setState(chatId, { step: "adm_broadcast" });
  await bot.sendMessage(
    chatId,
    `\u{1F4E2} *Broadcast*

Env\xEDa el mensaje a *todos* los usuarios.
Puede ser texto, foto o video.
Escribe /cancelar para cancelar.`,
    { parse_mode: "Markdown" }
  );
}
async function executeBroadcast(bot, adminId, text, media) {
  const users = getAllUsers();
  let sent = 0, failed = 0;
  const caption = media?.caption ? `\u{1F4E2} *Mensaje del Administrador*

${media.caption}` : media ? `\u{1F4E2} *Mensaje del Administrador*` : void 0;
  for (const u of users) {
    if (u.telegram_id === adminId) continue;
    try {
      if (media?.type === "photo") {
        await bot.sendPhoto(u.telegram_id, media.fileId, { caption, parse_mode: "Markdown" });
      } else if (media?.type === "video") {
        await bot.sendVideo(u.telegram_id, media.fileId, { caption, parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(u.telegram_id, `\u{1F4E2} *Mensaje del Administrador*

${text}`, { parse_mode: "Markdown" });
      }
      sent++;
    } catch (_) {
      failed++;
    }
  }
  clearState(adminId);
  await bot.sendMessage(adminId, `\u2705 Broadcast enviado.
\u2705 Enviados: ${sent}
\u274C Fallidos: ${failed}`);
}
async function executeBanToggle(bot, adminId, targetIdStr) {
  const targetId = parseInt(targetIdStr);
  if (isNaN(targetId)) {
    await bot.sendMessage(adminId, "\u274C ID inv\xE1lido. Debe ser un n\xFAmero.");
    return;
  }
  const user = getUser(targetId);
  if (!user) {
    await bot.sendMessage(adminId, "\u274C Usuario no encontrado.");
    return;
  }
  clearState(adminId);
  if (user.banned) {
    unbanUser(targetId);
    await bot.sendMessage(adminId, `\u2705 Usuario \`${targetId}\` desbaneado.`, { parse_mode: "Markdown" });
    try {
      await bot.sendMessage(targetId, "\u2705 Tu cuenta ha sido reactivada.");
    } catch (_) {
    }
  } else {
    banUser(targetId);
    await bot.sendMessage(adminId, `\u{1F6AB} Usuario \`${targetId}\` baneado.`, { parse_mode: "Markdown" });
    try {
      await bot.sendMessage(targetId, "\u{1F6AB} Tu cuenta ha sido suspendida.");
    } catch (_) {
    }
  }
}

// src/bot/index.ts
function startBot() {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    console.error("\u274C TELEGRAM_BOT_TOKEN no configurado.");
    process.exit(1);
  }
  const bot = new import_node_telegram_bot_api.default(token, { polling: true });
  bot.getMe().then((me) => {
    const botUsername = me.username ?? "bot";
    console.log(`\u2705 Bot iniciado: @${botUsername}`);
    async function showDurationAdded(chatId, productId, label, price, keyCount) {
      await bot.sendMessage(
        chatId,
        `\u2705 Duraci\xF3n *${label}* - $${price.toFixed(2)} USD - ${keyCount} keys agregadas.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u2795 Agregar otra duraci\xF3n", callback_data: `adm_wizard_newdur_${productId}` }],
              [{ text: "\u2705 Listo", callback_data: `adm_product_${productId}` }]
            ]
          }
        }
      );
    }
    bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
      if (msg.chat.type !== "private") return;
      const referrerId = match?.[1] ? parseInt(match[1]) : void 0;
      getOrCreateUser(msg.from.id, msg.from.username, msg.from.first_name);
      await handleStart(bot, msg, referrerId);
    });
    bot.onText(/\/cancelar/, async (msg) => {
      clearState(msg.chat.id);
      await sendMainMenu(bot, msg.chat.id);
    });
    bot.on("message", async (msg) => {
      if (msg.chat.type !== "private") return;
      const chatId = msg.chat.id;
      const userId = msg.from?.id ?? chatId;
      getOrCreateUser(userId, msg.from?.username, msg.from?.first_name);
      const user = getUser(userId);
      if (user?.banned) {
        await bot.sendMessage(chatId, "\u{1F6AB} Tu cuenta ha sido suspendida.");
        return;
      }
      if (msg.photo) {
        const state2 = getState(userId);
        if (state2.step === "recharge_photo") {
          await handleRechargePhoto(bot, msg);
        } else if (state2.step === "adm_broadcast" && isAdmin(userId)) {
          const fileId = msg.photo[msg.photo.length - 1].file_id;
          await executeBroadcast(bot, userId, "", { type: "photo", fileId, caption: msg.caption });
        }
        return;
      }
      if (msg.video) {
        const state2 = getState(userId);
        if (state2.step === "adm_broadcast" && isAdmin(userId)) {
          await executeBroadcast(bot, userId, "", { type: "video", fileId: msg.video.file_id, caption: msg.caption });
        }
        return;
      }
      if (!msg.text) return;
      const text = msg.text;
      const state = getState(userId);
      switch (state.step) {
        case "recharge_amount":
          await handleRechargeAmount(bot, chatId, text);
          return;
        case "adm_broadcast":
          if (!isAdmin(userId)) break;
          if (text === "/cancelar") {
            clearState(chatId);
            await sendMainMenu(bot, chatId);
            return;
          }
          await executeBroadcast(bot, userId, text);
          return;
        case "adm_ban":
          if (!isAdmin(userId)) break;
          await executeBanToggle(bot, userId, text);
          return;
        // ── Wizard creación de producto ─────────────────────────────────────
        case "adm_add_product_name":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_product_category", productName: text });
          await bot.sendMessage(chatId, `\u{1F4E6} Producto: *${text}*

Selecciona la categor\xEDa:`, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "\u{1F916} Android", callback_data: "adm_wcat_android" },
                  { text: "\u{1F34E} iOS", callback_data: "adm_wcat_ios" },
                  { text: "\u{1F5A5}\uFE0F PC", callback_data: "adm_wcat_pc" }
                ],
                [{ text: "\u274C Cancelar", callback_data: "adm_products" }]
              ]
            }
          });
          return;
        case "adm_wizard_dur_label":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_wizard_dur_price", productId: state.productId, productName: state.productName, label: text });
          await bot.sendMessage(chatId, `\u2705 *${text}*. Ahora el *precio en USD* (ej: 1.90):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${state.productId}` }]] }
          });
          return;
        case "adm_wizard_dur_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            await bot.sendMessage(chatId, "\u274C Precio inv\xE1lido. Ej: 1.90");
            return;
          }
          const durationId = createDuration(state.productId, state.label, price);
          setState(chatId, { step: "adm_wizard_dur_stock", productId: state.productId, productName: state.productName, label: state.label, price, durationId });
          await bot.sendMessage(chatId, `\u2705 $${price.toFixed(2)} USD. \xBFCu\xE1ntas keys agregas ahora? (ej: 10)

_Escribe 0 para agregar despu\xE9s._`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "\u23ED\uFE0F Sin stock por ahora", callback_data: `adm_wskip_${state.productId}` }]] }
          });
          return;
        }
        case "adm_wizard_dur_stock": {
          if (!isAdmin(userId)) break;
          const count = parseInt(text);
          if (isNaN(count) || count < 0) {
            await bot.sendMessage(chatId, "\u274C N\xFAmero inv\xE1lido.");
            return;
          }
          if (count === 0) {
            clearState(chatId);
            await showDurationAdded(chatId, state.productId, state.label, state.price, 0);
          } else {
            setState(chatId, { step: "adm_wizard_dur_keys", productId: state.productId, productName: state.productName, label: state.label, price: state.price, durationId: state.durationId, stockCount: count });
            await bot.sendMessage(chatId, `\u2705 ${count} keys. Env\xEDalas ahora, *una por l\xEDnea*:`, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${state.productId}` }]] }
            });
          }
          return;
        }
        case "adm_wizard_dur_keys": {
          if (!isAdmin(userId)) break;
          const keys = text.split("\n").map((k) => k.trim()).filter(Boolean);
          if (keys.length === 0) {
            await bot.sendMessage(chatId, "\u274C No se detectaron keys. Escr\xEDbelas una por l\xEDnea.");
            return;
          }
          addKeys(state.productId, state.durationId, keys);
          clearState(chatId);
          await showDurationAdded(chatId, state.productId, state.label, state.price, keys.length);
          return;
        }
        // ── Edición de producto ─────────────────────────────────────────────
        case "adm_rename_product":
          if (!isAdmin(userId)) break;
          renameProduct(state.productId, text);
          clearState(chatId);
          await bot.sendMessage(chatId, `\u2705 Producto renombrado a *${text}*.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;
        case "adm_add_duration_label":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_duration_price", productId: state.productId, label: text });
          await bot.sendMessage(chatId, `\u23F1\uFE0F *${text}*. Escribe el precio en USD (ej: 5.99):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${state.productId}` }]] }
          });
          return;
        case "adm_add_duration_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            await bot.sendMessage(chatId, "\u274C Precio inv\xE1lido.");
            return;
          }
          createDuration(state.productId, state.label, price);
          clearState(chatId);
          await bot.sendMessage(chatId, `\u2705 Duraci\xF3n *${state.label}* - $${price.toFixed(2)} USD creada.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;
        }
        case "adm_edit_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) {
            await bot.sendMessage(chatId, "\u274C Precio inv\xE1lido.");
            return;
          }
          updateDurationPrice(state.durationId, price);
          clearState(chatId);
          await bot.sendMessage(chatId, `\u2705 Precio actualizado a $${price.toFixed(2)} USD.`);
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;
        }
        case "adm_add_keys": {
          if (!isAdmin(userId)) break;
          const keys = text.split("\n").map((k) => k.trim()).filter(Boolean);
          if (keys.length === 0) {
            await bot.sendMessage(chatId, "\u274C No se detectaron keys.");
            return;
          }
          addKeys(state.productId, state.durationId, keys);
          clearState(chatId);
          await bot.sendMessage(chatId, `\u2705 Se agregaron *${keys.length}* keys.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;
        }
        // ── Métodos de pago ─────────────────────────────────────────────────
        case "adm_add_method_country":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_emoji", country: text });
          await bot.sendMessage(chatId, `\u{1F30D} Pa\xEDs: *${text}*

Escribe el emoji del pa\xEDs (ej: \u{1F1F2}\u{1F1FD}):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: "adm_methods" }]] }
          });
          return;
        case "adm_add_method_emoji":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_bank", country: state.country, emoji: text });
          await bot.sendMessage(chatId, "Nombre del banco:");
          return;
        case "adm_add_method_bank":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_holder", country: state.country, emoji: state.emoji, bank: text });
          await bot.sendMessage(chatId, "Nombre del titular:");
          return;
        case "adm_add_method_holder":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_account", country: state.country, emoji: state.emoji, bank: state.bank, holder: text });
          await bot.sendMessage(chatId, "N\xFAmero de cuenta / CLABE:");
          return;
        case "adm_add_method_account":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_minimum", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: text });
          await bot.sendMessage(chatId, "Monto m\xEDnimo en USD (ej: 2):");
          return;
        case "adm_add_method_minimum": {
          if (!isAdmin(userId)) break;
          const min = parseFloat(text);
          if (isNaN(min)) {
            await bot.sendMessage(chatId, "\u274C N\xFAmero inv\xE1lido.");
            return;
          }
          setState(chatId, { step: "adm_add_method_rate", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: min });
          await bot.sendMessage(chatId, "Tasa de cambio (ej: 20 para 20 moneda local/USD):");
          return;
        }
        case "adm_add_method_rate": {
          if (!isAdmin(userId)) break;
          const rate = parseFloat(text);
          if (isNaN(rate)) {
            await bot.sendMessage(chatId, "\u274C N\xFAmero inv\xE1lido.");
            return;
          }
          setState(chatId, { step: "adm_add_method_currency", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: state.minimum, rate });
          await bot.sendMessage(chatId, "C\xF3digo de moneda (ej: MXN, ARS, USDT):");
          return;
        }
        case "adm_add_method_currency": {
          if (!isAdmin(userId)) break;
          createPaymentMethod({ country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: state.minimum, rate: state.rate, currency: text });
          clearState(chatId);
          await bot.sendMessage(chatId, `\u2705 M\xE9todo *${state.emoji} ${state.country}* creado.`, { parse_mode: "Markdown" });
          await handleAdmMethods(bot, chatId);
          return;
        }
        case "adm_edit_method_field": {
          if (!isAdmin(userId)) break;
          const numFields = ["minimum", "rate"];
          const val = numFields.includes(state.field) ? parseFloat(text) : text;
          if (numFields.includes(state.field) && isNaN(val)) {
            await bot.sendMessage(chatId, "\u274C Debe ser un n\xFAmero.");
            return;
          }
          updatePaymentMethod(state.methodId, state.field, val);
          clearState(chatId);
          await bot.sendMessage(chatId, "\u2705 Campo actualizado.");
          await handleAdmMethodDetail(bot, chatId, state.methodId);
          return;
        }
      }
      switch (text) {
        case "\u{1F6D2} Ver Productos":
          await handleViewProducts(bot, chatId);
          break;
        case "\u{1F4CB} Mis Compras":
          await handlePurchases(bot, chatId);
          break;
        case "\u{1F464} Mi Perfil":
          await handleProfile(bot, chatId);
          break;
        case "\u{1F4E6} Mis Movimientos":
          await handleMovements(bot, chatId);
          break;
        case "\u{1F4B3} Recargar Saldo":
          await handleRecharge(bot, chatId);
          break;
        case "\u{1F465} Invitar Amigos":
          await handleReferral(bot, chatId, botUsername);
          break;
        case "\u2699\uFE0F Men\xFA ADM":
          if (isAdmin(userId)) await handleAdmMenu(bot, chatId);
          break;
        default:
          if (!text.startsWith("/")) await sendMainMenu(bot, chatId);
      }
    });
    bot.on("callback_query", async (query) => {
      const userId = query.from.id;
      const chatId = query.message?.chat.id;
      const data = query.data ?? "";
      const msgChatType = query.message?.chat.type;
      const isGroup = msgChatType === "group" || msgChatType === "supergroup";
      await bot.answerCallbackQuery(query.id).catch(() => {
      });
      if (!chatId) return;
      if (isGroup) {
        if (!isAdmin(userId)) return;
        if (data.startsWith("adm_approve_")) {
          await handleAdmApprove(bot, userId, data.slice("adm_approve_".length));
          return;
        }
        if (data.startsWith("adm_reject_")) {
          await handleAdmReject(bot, userId, data.slice("adm_reject_".length));
          return;
        }
        return;
      }
      const user = getUser(userId);
      if (user?.banned) {
        await bot.sendMessage(chatId, "\u{1F6AB} Tu cuenta ha sido suspendida.");
        return;
      }
      if (data === "main_menu") {
        await sendMainMenu(bot, chatId);
        return;
      }
      if (data === "view_products") {
        await handleViewProducts(bot, chatId);
        return;
      }
      if (data === "recharge") {
        await handleRecharge(bot, chatId);
        return;
      }
      if (data.startsWith("cat_")) {
        await handleCategory(bot, chatId, data.slice(4));
        return;
      }
      if (data.startsWith("product_")) {
        await handleProductDetail(bot, chatId, Number(data.slice(8)));
        return;
      }
      if (data.startsWith("buy_")) {
        const rest = data.slice(4);
        const sep = rest.indexOf("_");
        await handleBuy(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }
      if (data.startsWith("confirm_buy_")) {
        const rest = data.slice("confirm_buy_".length);
        const sep = rest.indexOf("_");
        await handleConfirmBuy(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }
      if (data.startsWith("recharge_method_")) {
        await handleRechargeMethod(bot, chatId, Number(data.slice("recharge_method_".length)));
        return;
      }
      if (data.startsWith("recharge_sent_")) {
        await handleRechargeSent(bot, chatId);
        return;
      }
      if (!isAdmin(userId)) {
        if (data.startsWith("adm_")) await bot.sendMessage(chatId, "\u{1F6AB} No tienes permiso.");
        return;
      }
      if (data === "adm_menu") {
        await handleAdmMenu(bot, chatId);
        return;
      }
      if (data === "adm_products") {
        await handleAdmProducts(bot, chatId);
        return;
      }
      if (data === "adm_add_product") {
        await startAddProduct(bot, chatId);
        return;
      }
      if (data === "adm_methods") {
        await handleAdmMethods(bot, chatId);
        return;
      }
      if (data === "adm_add_method") {
        await startAddMethod(bot, chatId);
        return;
      }
      if (data === "adm_recharges") {
        await handleAdmRecharges(bot, chatId);
        return;
      }
      if (data === "adm_users") {
        await handleAdmUsers(bot, chatId);
        return;
      }
      if (data === "adm_ban") {
        await handleAdmBan(bot, chatId);
        return;
      }
      if (data === "adm_broadcast") {
        await handleAdmBroadcast(bot, chatId);
        return;
      }
      if (data.startsWith("adm_wcat_")) {
        const category = data.slice("adm_wcat_".length);
        const state = getState(userId);
        if (state.step !== "adm_add_product_category") return;
        const productId = createProduct(state.productName, category);
        setState(chatId, { step: "adm_wizard_dur_label", productId, productName: state.productName });
        await bot.sendMessage(
          chatId,
          `\u2705 Producto *${state.productName}* creado en ${category}.

Ahora escribe el nombre de la primera *duraci\xF3n* (ej: 1 Mes, 7 D\xEDas, Lifetime):`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${productId}` }]] }
          }
        );
        return;
      }
      if (data.startsWith("adm_wskip_")) {
        const productId = Number(data.slice("adm_wskip_".length));
        const state = getState(userId);
        clearState(chatId);
        if (state.step === "adm_wizard_dur_stock") {
          await showDurationAdded(chatId, productId, state.label, state.price, 0);
        } else {
          await handleAdmProductDetail(bot, chatId, productId);
        }
        return;
      }
      if (data.startsWith("adm_wizard_newdur_")) {
        const productId = Number(data.slice("adm_wizard_newdur_".length));
        const product = getProduct(productId);
        if (!product) return;
        setState(chatId, { step: "adm_wizard_dur_label", productId, productName: product.name });
        await bot.sendMessage(chatId, "\u2795 Escribe el nombre de la nueva duraci\xF3n (ej: 3 Meses):", {
          reply_markup: { inline_keyboard: [[{ text: "\u274C Cancelar", callback_data: `adm_product_${productId}` }]] }
        });
        return;
      }
      if (data.startsWith("adm_product_")) {
        await handleAdmProductDetail(bot, chatId, Number(data.slice("adm_product_".length)));
        return;
      }
      if (data.startsWith("adm_rename_")) {
        await handleAdmRenameProduct(bot, chatId, Number(data.slice("adm_rename_".length)));
        return;
      }
      if (data.startsWith("adm_delproduct_")) {
        await handleAdmDeleteProduct(bot, chatId, Number(data.slice("adm_delproduct_".length)));
        return;
      }
      if (data.startsWith("adm_newduration_")) {
        await handleAdmNewDuration(bot, chatId, Number(data.slice("adm_newduration_".length)));
        return;
      }
      if (data.startsWith("adm_stock_menu_")) {
        await handleAdmAddStockMenu(bot, chatId, Number(data.slice("adm_stock_menu_".length)));
        return;
      }
      if (data.startsWith("adm_delduration_menu_")) {
        await handleAdmDelDurationMenu(bot, chatId, Number(data.slice("adm_delduration_menu_".length)));
        return;
      }
      if (data.startsWith("adm_delduration_")) {
        const rest = data.slice("adm_delduration_".length);
        const sep = rest.indexOf("_");
        await handleAdmDelDuration(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }
      if (data.startsWith("adm_editprice_menu_")) {
        await handleAdmEditPriceMenu(bot, chatId, Number(data.slice("adm_editprice_menu_".length)));
        return;
      }
      if (data.startsWith("adm_editprice_")) {
        const rest = data.slice("adm_editprice_".length);
        const sep = rest.indexOf("_");
        await handleAdmEditPrice(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }
      if (data.startsWith("adm_addkeys_menu_")) {
        await handleAdmAddKeysMenu(bot, chatId, Number(data.slice("adm_addkeys_menu_".length)));
        return;
      }
      if (data.startsWith("adm_addkeys_")) {
        const rest = data.slice("adm_addkeys_".length);
        const sep = rest.indexOf("_");
        await handleAdmAddKeys(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }
      if (data.startsWith("adm_delmethod_")) {
        await handleAdmDeleteMethod(bot, chatId, Number(data.slice("adm_delmethod_".length)));
        return;
      }
      if (data.startsWith("adm_mfield_")) {
        const rest = data.slice("adm_mfield_".length);
        const sep = rest.indexOf("_");
        const methodId = Number(rest.slice(0, sep));
        const fieldName = rest.slice(sep + 1);
        await handleAdmMethodFieldEdit(bot, chatId, methodId, fieldName);
        return;
      }
      if (data.startsWith("adm_method_")) {
        await handleAdmMethodDetail(bot, chatId, Number(data.slice("adm_method_".length)));
        return;
      }
      if (data.startsWith("adm_approve_")) {
        await handleAdmApprove(bot, chatId, data.slice("adm_approve_".length));
        return;
      }
      if (data.startsWith("adm_reject_")) {
        await handleAdmReject(bot, chatId, data.slice("adm_reject_".length));
        return;
      }
    });
    bot.on("polling_error", (err) => {
      console.error("Polling error:", err.message);
    });
  });
}

// src/index.ts
async function main() {
  console.log("\u{1F680} Iniciando Neex Store Bot...");
  await initializeDb();
  console.log("\u2705 Base de datos Firebase conectada");
  startBot();
}
main().catch((err) => {
  console.error("\u274C Error fatal al iniciar:", err);
  process.exit(1);
});
