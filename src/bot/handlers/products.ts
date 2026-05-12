import TelegramBot from "node-telegram-bot-api";
import { getProductsByCategory, getProduct, getDurations, getAvailableKeys, getUser, recordPurchase, useKey } from "../db.js";
import { categoryKeyboard } from "../keyboards.js";
import { setState, clearState } from "../state.js";

const catLabel: Record<string, string> = {
  android: "🤖 Android",
  ios: "🍎 iOS",
  pc: "🖥️ PC",
};

function randomOrderId(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

function formatDate(date: Date): string {
  return date.toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export async function handleViewProducts(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(chatId, "📦 *Elige Para Qué Categoría Deseas:*", {
    parse_mode: "Markdown",
    reply_markup: categoryKeyboard(),
  });
}

export async function handleCategory(bot: TelegramBot, chatId: number, category: string) {
  const products = getProductsByCategory(category);

  if (products.length === 0) {
    await bot.sendMessage(chatId, `❌ No hay productos en ${catLabel[category] ?? category} por ahora.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "◀️ Categorías", callback_data: "view_products" }, { text: "🏠 Menú Principal", callback_data: "main_menu" }],
        ],
      },
    });
    return;
  }

  const keyboard: TelegramBot.InlineKeyboardButton[][] = products.map(p => {
    const keys = getAvailableKeys(p.id);
    return [{ text: `📦 ${p.name} (${keys.length} keys)`, callback_data: `product_${p.id}` }];
  });

  keyboard.push([
    { text: "◀️ Categorías", callback_data: "view_products" },
    { text: "🏠 Menú Principal", callback_data: "main_menu" },
  ]);

  await bot.sendMessage(chatId, `🛒 *Elige Tu Producto Para ${catLabel[category] ?? category}*`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleProductDetail(bot: TelegramBot, chatId: number, productId: number) {
  const product = getProduct(productId);
  if (!product) return;

  const durations = getDurations(productId);
  const user = getUser(chatId);

  if (durations.length === 0) {
    await bot.sendMessage(chatId, "❌ Este producto no tiene duraciones configuradas aún.", {
      reply_markup: { inline_keyboard: [[{ text: "◀️ Volver", callback_data: `cat_${product.category}` }]] },
    });
    return;
  }

  const discount = user
    ? (user.total_spent >= 200 ? 0.15 : user.total_spent >= 100 ? 0.10 : user.total_spent >= 50 ? 0.05 : 0)
    : 0;

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
  for (const d of durations) {
    const availableKeys = getAvailableKeys(productId, d.id);
    const finalPrice = d.price * (1 - discount);
    const stockLabel = availableKeys.length > 0 ? `✅ ${availableKeys.length}` : "❌ Sin stock";
    keyboard.push([{
      text: `${d.label} - $${finalPrice.toFixed(2)} USD (${stockLabel})`,
      callback_data: `buy_${productId}_${d.id}`,
    }]);
  }

  keyboard.push([{ text: "◀️ Volver", callback_data: `cat_${product.category}` }]);

  await bot.sendMessage(chatId, `📦 *${product.name}*\nSelecciona una opción:`, {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: keyboard },
  });
}

export async function handleBuy(bot: TelegramBot, chatId: number, productId: number, durationId: number) {
  const product = getProduct(productId);
  const durations = getDurations(productId);
  const duration = durations.find(d => d.id === durationId);
  const user = getUser(chatId);

  if (!product || !duration || !user) return;

  const discount = user.total_spent >= 200 ? 0.15 : user.total_spent >= 100 ? 0.10 : user.total_spent >= 50 ? 0.05 : 0;
  const finalPrice = duration.price * (1 - discount);
  const availableKeys = getAvailableKeys(productId, durationId);

  if (availableKeys.length === 0) {
    await bot.sendMessage(chatId, "❌ *Sin stock disponible.*\nContacta al administrador.", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Volver", callback_data: `product_${productId}` }]] },
    });
    return;
  }

  if (user.balance < finalPrice) {
    await bot.sendMessage(chatId,
      `❌ *Saldo insuficiente.*\n\nNecesitas: $${finalPrice.toFixed(2)} USD\nTu saldo: $${Number(user.balance).toFixed(2)} USD`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💳 Recargar Saldo", callback_data: "recharge" }],
            [{ text: "◀️ Volver", callback_data: `product_${productId}` }],
          ],
        },
      }
    );
    return;
  }

  setState(chatId, { step: "buy_confirm", productId, durationId, price: finalPrice });

  await bot.sendMessage(chatId,
    `🛒 *Confirmar Compra*\n─────────────────\n📦 ${product.name}\n⏱️ ${duration.label}\n💰 Precio: $${finalPrice.toFixed(2)} USD\n\n¿Confirmas la compra?`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirmar", callback_data: `confirm_buy_${productId}_${durationId}` }],
          [{ text: "❌ Cancelar", callback_data: `product_${productId}` }],
        ],
      },
    }
  );
}

export async function handleConfirmBuy(bot: TelegramBot, chatId: number, productId: number, durationId: number) {
  const product = getProduct(productId);
  const durations = getDurations(productId);
  const duration = durations.find(d => d.id === durationId);
  const user = getUser(chatId);

  if (!product || !duration || !user) return;

  const discount = user.total_spent >= 200 ? 0.15 : user.total_spent >= 100 ? 0.10 : user.total_spent >= 50 ? 0.05 : 0;
  const finalPrice = duration.price * (1 - discount);
  const suggestedPrice = finalPrice * 1.30;

  const availableKeys = getAvailableKeys(productId, durationId);
  if (availableKeys.length === 0 || user.balance < finalPrice) {
    await bot.sendMessage(chatId, "❌ No se pudo completar la compra. Intenta de nuevo.", {
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menú Principal", callback_data: "main_menu" }]] },
    });
    return;
  }

  const key = availableKeys[0]!;
  useKey(key.id, chatId);
  recordPurchase(chatId, productId, durationId, key.id, finalPrice);
  clearState(chatId);

  const orderId = randomOrderId();
  const fecha = formatDate(new Date());

  await bot.sendMessage(chatId,
    `✅ *Compra Realizada Con Éxito*\n\n` +
    `📅 *Fecha:* ${fecha}\n` +
    `📦 *Producto:* ${product.name}\n` +
    `⏳ *Duración:* ${duration.label}\n` +
    `💰 *Precio sugerido:* $${suggestedPrice.toFixed(2)} USD\n` +
    `💰 *Total:* $${finalPrice.toFixed(2)} USD\n` +
    `🧾 *Orden:* #${orderId}\n\n` +
    `🔑 *Key 1:* \`${key.key_value}\``,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menú Principal", callback_data: "main_menu" }]] },
    }
  );
}
