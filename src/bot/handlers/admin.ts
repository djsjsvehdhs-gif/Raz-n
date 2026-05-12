import TelegramBot from "node-telegram-bot-api";
import {
  getStats, getAllUsers, getUser, banUser, unbanUser,
  getProducts, getProduct, createProduct, renameProduct, deleteProduct,
  getDurations, getDuration, createDuration, deleteDuration, updateDurationPrice,
  getAllKeys, addKeys,
  getPaymentMethods, getPaymentMethod, createPaymentMethod, updatePaymentMethod, deletePaymentMethod,
  getPendingRecharges, approveRecharge, rejectRecharge,
} from "../db.js";
import { admMenu } from "../keyboards.js";
import { setState, clearState } from "../state.js";

const ADMIN_ID = Number(process.env["ADMIN_ID"] ?? "0");

export function isAdmin(userId: number): boolean {
  return userId === ADMIN_ID;
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export async function handleAdmMenu(bot: TelegramBot, chatId: number) {
  if (!isAdmin(chatId)) {
    await bot.sendMessage(chatId, "🚫 No tienes permiso para acceder a esta sección.");
    return;
  }
  const stats = getStats();
  await bot.sendMessage(chatId,
    `👑 *Panel de Administración*\n─────────────────\n` +
    `👥 Usuarios: ${stats.users}\n` +
    `💳 Recargas pendientes: ${stats.pending}\n` +
    `📦 Productos: ${stats.products}`,
    { parse_mode: "Markdown", reply_markup: admMenu() }
  );
}

// ─── Productos ────────────────────────────────────────────────────────────────

export async function handleAdmProducts(bot: TelegramBot, chatId: number) {
  const products = getProducts();
  const keyboard: TelegramBot.InlineKeyboardButton[][] = products.map(p => {
    const keys = getAllKeys(p.id).filter(k => !k.used);
    return [{ text: `${p.name} (${keys.length} keys)`, callback_data: `adm_product_${p.id}` }];
  });
  keyboard.push([{ text: "➕ Agregar Producto", callback_data: "adm_add_product" }, { text: "◀️ Volver", callback_data: "adm_menu" }]);

  await bot.sendMessage(chatId, "📦 *Gestión de Productos*", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleAdmProductDetail(bot: TelegramBot, chatId: number, productId: number) {
  const product = getProduct(productId);
  if (!product) return;
  const durations = getDurations(productId);
  const keys = getAllKeys(productId);
  const totalStock = keys.filter(k => !k.used).length;

  await bot.sendMessage(chatId,
    `📦 *${product.name}*\nCategoría: ${product.category}\nDuraciones: ${durations.length}\nStock total: ${totalStock} keys`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✏️ Renombrar", callback_data: `adm_rename_${productId}` }, { text: "📦 Agregar Stock", callback_data: `adm_stock_menu_${productId}` }],
          [{ text: "🔑 Agregar Keys", callback_data: `adm_addkeys_menu_${productId}` }, { text: "💰 Editar Precio", callback_data: `adm_editprice_menu_${productId}` }],
          [{ text: "➕ Nueva Duración", callback_data: `adm_newduration_${productId}` }, { text: "🗑️ Eliminar Duración", callback_data: `adm_delduration_menu_${productId}` }],
          [{ text: "❌ Eliminar Producto", callback_data: `adm_delproduct_${productId}` }],
          [{ text: "◀️ Volver", callback_data: "adm_products" }],
        ],
      },
    }
  );
}

export async function startAddProduct(bot: TelegramBot, chatId: number) {
  setState(chatId, { step: "adm_add_product_name" });
  await bot.sendMessage(chatId, "📦 *Agregar Producto*\n\nEscribe el *nombre* del nuevo producto:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "adm_products" }]] },
  });
}

export async function handleAdmRenameProduct(bot: TelegramBot, chatId: number, productId: number) {
  setState(chatId, { step: "adm_rename_product", productId });
  await bot.sendMessage(chatId, "✏️ Escribe el nuevo nombre del producto:", {
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
  });
}

export async function handleAdmDeleteProduct(bot: TelegramBot, chatId: number, productId: number) {
  const product = getProduct(productId);
  if (!product) return;
  deleteProduct(productId);
  clearState(chatId);
  await bot.sendMessage(chatId, `✅ Producto *${product.name}* eliminado.`, { parse_mode: "Markdown" });
  await handleAdmProducts(bot, chatId);
}

export async function handleAdmNewDuration(bot: TelegramBot, chatId: number, productId: number) {
  setState(chatId, { step: "adm_add_duration_label", productId });
  await bot.sendMessage(chatId, "➕ *Nueva Duración*\n\nEscribe el nombre/duración (ej: 1 mes, 7 días, Lifetime):", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
  });
}

export async function handleAdmDelDurationMenu(bot: TelegramBot, chatId: number, productId: number) {
  const durations = getDurations(productId);
  if (durations.length === 0) { await bot.sendMessage(chatId, "❌ No hay duraciones para eliminar."); return; }
  const keyboard = durations.map(d => [{ text: `🗑️ ${d.label} - $${d.price}`, callback_data: `adm_delduration_${d.id}_${productId}` }]);
  keyboard.push([{ text: "◀️ Volver", callback_data: `adm_product_${productId}` }]);
  await bot.sendMessage(chatId, "🗑️ *Eliminar Duración*\nElige cuál eliminar:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleAdmDelDuration(bot: TelegramBot, chatId: number, durationId: number, productId: number) {
  deleteDuration(durationId);
  await bot.sendMessage(chatId, "✅ Duración eliminada.");
  await handleAdmProductDetail(bot, chatId, productId);
}

export async function handleAdmEditPriceMenu(bot: TelegramBot, chatId: number, productId: number) {
  const durations = getDurations(productId);
  if (durations.length === 0) { await bot.sendMessage(chatId, "❌ No hay duraciones para editar."); return; }
  const keyboard = durations.map(d => [{ text: `💰 ${d.label} - $${d.price}`, callback_data: `adm_editprice_${productId}_${d.id}` }]);
  keyboard.push([{ text: "◀️ Volver", callback_data: `adm_product_${productId}` }]);
  await bot.sendMessage(chatId, "💰 *Editar Precio*\nElige la duración:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleAdmEditPrice(bot: TelegramBot, chatId: number, productId: number, durationId: number) {
  setState(chatId, { step: "adm_edit_price", productId, durationId });
  await bot.sendMessage(chatId, "💰 Escribe el nuevo precio en USD (ej: 5.99):", {
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
  });
}

export async function handleAdmAddKeysMenu(bot: TelegramBot, chatId: number, productId: number) {
  const durations = getDurations(productId);
  if (durations.length === 0) { await bot.sendMessage(chatId, "❌ Agrega al menos una duración antes de agregar keys."); return; }
  const keyboard = durations.map(d => [{ text: `🔑 ${d.label}`, callback_data: `adm_addkeys_${productId}_${d.id}` }]);
  keyboard.push([{ text: "◀️ Volver", callback_data: `adm_product_${productId}` }]);
  await bot.sendMessage(chatId, "🔑 *Agregar Keys*\nElige la duración:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleAdmAddKeys(bot: TelegramBot, chatId: number, productId: number, durationId: number) {
  setState(chatId, { step: "adm_add_keys", productId, durationId });
  await bot.sendMessage(chatId, "🔑 *Agregar Keys*\n\nEscribe las keys, una por línea:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
  });
}

export async function handleAdmAddStockMenu(bot: TelegramBot, chatId: number, productId: number) {
  await handleAdmAddKeysMenu(bot, chatId, productId);
}

// ─── Métodos de pago ──────────────────────────────────────────────────────────

export async function handleAdmMethods(bot: TelegramBot, chatId: number) {
  const methods = getPaymentMethods();
  const keyboard: TelegramBot.InlineKeyboardButton[][] = methods.map(m => ([{
    text: `${m.emoji} ${m.country} (${m.currency}, mín $${m.minimum})`,
    callback_data: `adm_method_${m.id}`,
  }]));
  keyboard.push([{ text: "➕ Agregar Método", callback_data: "adm_add_method" }, { text: "◀️ Volver", callback_data: "adm_menu" }]);
  await bot.sendMessage(chatId, "💳 *Métodos de Pago*", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleAdmMethodDetail(bot: TelegramBot, chatId: number, methodId: number) {
  const m = getPaymentMethod(methodId);
  if (!m) return;
  await bot.sendMessage(chatId,
    `💳 *${m.emoji} ${m.country}*\n🏦 Banco: ${m.bank}\n👤 Titular: ${m.holder}\n📋 Cuenta: \`${m.account}\`\n💵 Mínimo: $${m.minimum} USD\n📊 Tasa: ${m.rate} ${m.currency}/USD`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏦 Banco", callback_data: `adm_mfield_${methodId}_bank` }, { text: "👤 Titular", callback_data: `adm_mfield_${methodId}_holder` }],
          [{ text: "📋 Cuenta", callback_data: `adm_mfield_${methodId}_account` }, { text: "💵 Mínimo", callback_data: `adm_mfield_${methodId}_minimum` }],
          [{ text: "📊 Tasa", callback_data: `adm_mfield_${methodId}_rate` }, { text: "🌍 País/Emoji", callback_data: `adm_mfield_${methodId}_country` }],
          [{ text: "❌ Eliminar Método", callback_data: `adm_delmethod_${methodId}` }],
          [{ text: "◀️ Volver", callback_data: "adm_methods" }],
        ],
      },
    }
  );
}

export async function handleAdmMethodFieldEdit(bot: TelegramBot, chatId: number, methodId: number, field: string) {
  setState(chatId, { step: "adm_edit_method_field", methodId, field });
  const labels: Record<string, string> = {
    bank: "nombre del banco", holder: "nombre del titular", account: "número de cuenta",
    minimum: "monto mínimo en USD (ej: 2)", rate: "tasa de cambio (ej: 20)",
    country: "nombre del país", emoji: "emoji del país (ej: 🇲🇽)",
    currency: "código de moneda (ej: MXN, ARS, USDT)",
  };
  await bot.sendMessage(chatId, `✏️ Escribe el nuevo valor para: *${labels[field] ?? field}*`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_method_${methodId}` }]] },
  });
}

export async function handleAdmDeleteMethod(bot: TelegramBot, chatId: number, methodId: number) {
  deletePaymentMethod(methodId);
  await bot.sendMessage(chatId, "✅ Método de pago eliminado.");
  await handleAdmMethods(bot, chatId);
}

export async function startAddMethod(bot: TelegramBot, chatId: number) {
  setState(chatId, { step: "adm_add_method_country" });
  await bot.sendMessage(chatId, "➕ *Agregar Método de Pago*\n\nEscribe el nombre del país (ej: México):", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "adm_methods" }]] },
  });
}

// ─── Recargas ─────────────────────────────────────────────────────────────────

export async function handleAdmRecharges(bot: TelegramBot, chatId: number) {
  const recharges = getPendingRecharges();

  if (recharges.length === 0) {
    await bot.sendMessage(chatId, "✅ No hay recargas pendientes.", {
      reply_markup: { inline_keyboard: [[{ text: "◀️ Volver", callback_data: "adm_menu" }]] },
    });
    return;
  }

  for (const r of recharges) {
    const userName = r.username ? `@${r.username}` : r.first_name ?? "Usuario";
    const text =
      `💳 *Recarga Pendiente*\n🆔 ${r.transaction_id}\n👤 ${userName}\n🌍 ${r.country}\n💰 $${Number(r.amount_usd).toFixed(2)} USD`;

    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [[
        { text: "✅ Aprobar", callback_data: `adm_approve_${r.transaction_id}` },
        { text: "❌ Rechazar", callback_data: `adm_reject_${r.transaction_id}` },
      ]],
    };

    if (r.photo_file_id) {
      await bot.sendPhoto(chatId, r.photo_file_id, { caption: text, parse_mode: "Markdown", reply_markup: keyboard });
    } else {
      await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: keyboard });
    }
  }
}

export async function handleAdmApprove(bot: TelegramBot, adminId: number, transactionId: string) {
  const recharge = approveRecharge(transactionId);
  if (!recharge) {
    await bot.sendMessage(adminId, "❌ Recarga no encontrada o ya procesada.");
    return;
  }
  await bot.sendMessage(adminId,
    `✅ Recarga \`${transactionId}\` aprobada. +$${Number(recharge.amount_usd).toFixed(2)} USD al usuario \`${recharge.user_id}\`.`,
    { parse_mode: "Markdown" }
  );
  try {
    await bot.sendMessage(recharge.user_id,
      `✅ *¡Recarga Aprobada!*\n\nTu recarga de *$${Number(recharge.amount_usd).toFixed(2)} USD* ha sido acreditada.\nID: \`${transactionId}\``,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: [[{ text: "🏠 Menú Principal", callback_data: "main_menu" }]] } }
    );
  } catch (_) {}
}

export async function handleAdmReject(bot: TelegramBot, adminId: number, transactionId: string) {
  const recharge = rejectRecharge(transactionId);
  if (!recharge) {
    await bot.sendMessage(adminId, "❌ Recarga no encontrada o ya procesada.");
    return;
  }
  await bot.sendMessage(adminId, `❌ Recarga \`${transactionId}\` rechazada.`, { parse_mode: "Markdown" });
  try {
    await bot.sendMessage(recharge.user_id,
      `❌ *Recarga Rechazada*\n\nTu recarga de *$${Number(recharge.amount_usd).toFixed(2)} USD* fue rechazada.\nID: \`${transactionId}\`\n\nContacta al administrador si crees que es un error.`,
      { parse_mode: "Markdown" }
    );
  } catch (_) {}
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export async function handleAdmUsers(bot: TelegramBot, chatId: number) {
  const users = getAllUsers();
  if (users.length === 0) { await bot.sendMessage(chatId, "❌ No hay usuarios registrados."); return; }

  let text = "👥 *Lista de Usuarios*\n─────────────────\n\n";
  for (const u of users.slice(0, 20)) {
    const name = u.username ? `@${u.username}` : u.first_name ?? "Sin nombre";
    text += `👤 ${name} | ID: \`${u.telegram_id}\` | Saldo: $${Number(u.balance).toFixed(2)} | ${u.banned ? "🚫 Baneado" : "✅"}\n`;
  }

  await bot.sendMessage(chatId, text, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "◀️ Volver", callback_data: "adm_menu" }]] },
  });
}

export async function handleAdmBan(bot: TelegramBot, chatId: number) {
  setState(chatId, { step: "adm_ban" });
  await bot.sendMessage(chatId,
    `🚫 *Banear / Desbanear Usuario*\n─────────────────\n\nEscribe el *ID de Telegram* del usuario.\n\n_Puedes verlos en 👥 Usuarios._`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "adm_menu" }]] },
    }
  );
}

export async function handleAdmBroadcast(bot: TelegramBot, chatId: number) {
  setState(chatId, { step: "adm_broadcast" });
  await bot.sendMessage(chatId,
    `📢 *Broadcast*\n\nEnvía el mensaje a *todos* los usuarios.\nPuede ser texto, foto o video.\nEscribe /cancelar para cancelar.`,
    { parse_mode: "Markdown" }
  );
}

export async function executeBroadcast(
  bot: TelegramBot,
  adminId: number,
  text: string,
  media?: { type: "photo" | "video"; fileId: string; caption?: string }
) {
  const users = getAllUsers();
  let sent = 0, failed = 0;
  const caption = media?.caption
    ? `📢 *Mensaje del Administrador*\n\n${media.caption}`
    : media ? `📢 *Mensaje del Administrador*` : undefined;

  for (const u of users) {
    if (u.telegram_id === adminId) continue;
    try {
      if (media?.type === "photo") {
        await bot.sendPhoto(u.telegram_id, media.fileId, { caption, parse_mode: "Markdown" });
      } else if (media?.type === "video") {
        await bot.sendVideo(u.telegram_id, media.fileId, { caption, parse_mode: "Markdown" });
      } else {
        await bot.sendMessage(u.telegram_id, `📢 *Mensaje del Administrador*\n\n${text}`, { parse_mode: "Markdown" });
      }
      sent++;
    } catch (_) { failed++; }
  }
  clearState(adminId);
  await bot.sendMessage(adminId, `✅ Broadcast enviado.\n✅ Enviados: ${sent}\n❌ Fallidos: ${failed}`);
}

export async function executeBanToggle(bot: TelegramBot, adminId: number, targetIdStr: string) {
  const targetId = parseInt(targetIdStr);
  if (isNaN(targetId)) { await bot.sendMessage(adminId, "❌ ID inválido. Debe ser un número."); return; }
  const user = getUser(targetId);
  if (!user) { await bot.sendMessage(adminId, "❌ Usuario no encontrado."); return; }
  clearState(adminId);
  if (user.banned) {
    unbanUser(targetId);
    await bot.sendMessage(adminId, `✅ Usuario \`${targetId}\` desbaneado.`, { parse_mode: "Markdown" });
    try { await bot.sendMessage(targetId, "✅ Tu cuenta ha sido reactivada."); } catch (_) {}
  } else {
    banUser(targetId);
    await bot.sendMessage(adminId, `🚫 Usuario \`${targetId}\` baneado.`, { parse_mode: "Markdown" });
    try { await bot.sendMessage(targetId, "🚫 Tu cuenta ha sido suspendida."); } catch (_) {}
  }
}
