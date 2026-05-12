import TelegramBot from "node-telegram-bot-api";
import { getUser, getOrCreateUser, getRank, getDiscount, getUserMovements, getUserPurchases } from "../db.js";
import { backToMain } from "../keyboards.js";

export async function handleProfile(bot: TelegramBot, chatId: number) {
  const user = getUser(chatId);
  if (!user) return;

  const rank = getRank(user.total_spent);
  const discount = getDiscount(user.total_spent);

  const text =
    `👤 *MI PERFIL*\n─────────────────\n` +
    `🪪 @${user.username || "sin_usuario"}\n` +
    `🆔 ID: \`${user.telegram_id}\`\n\n` +
    `─────────────────\n` +
    `💰 *Saldo:* $${Number(user.balance).toFixed(2)} USD\n` +
    `🛍️ *Compras:* ${user.purchases}\n` +
    `📊 *Total gastado:* $${Number(user.total_spent).toFixed(2)} USD\n` +
    `🎟️ *Descuento activo:* ${discount}%\n\n` +
    `─────────────────\n` +
    `${rank.emoji} *Rango:* ${rank.name}\n` +
    (rank.nextAmount > 0
      ? `📈 *Próximo rango:* ${rank.nextName} ($${rank.nextAmount.toFixed(2)} más)`
      : `🏆 ¡Has alcanzado el rango máximo!`);

  await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: backToMain() });
}

export async function handleMovements(bot: TelegramBot, chatId: number) {
  const movements = getUserMovements(chatId);

  if (movements.length === 0) {
    await bot.sendMessage(chatId, "📦 *MIS MOVIMIENTOS*\n─────────────────\n❌ No tienes movimientos aún.", {
      parse_mode: "Markdown",
      reply_markup: backToMain(),
    });
    return;
  }

  let text = "📦 *MIS MOVIMIENTOS*\n─────────────────\n\n";
  for (const m of movements) {
    const sign = m.amount > 0 ? "+" : "";
    const date = new Date(m.created_at).toLocaleDateString("es", { day: "numeric", month: "numeric" });
    text += `💳 ${m.description}\n${sign}$${Math.abs(m.amount).toFixed(2)} USD · ${date}\n\n─────────────────\n\n`;
  }

  await bot.sendMessage(chatId, text.trim(), { parse_mode: "Markdown", reply_markup: backToMain() });
}

export async function handlePurchases(bot: TelegramBot, chatId: number) {
  const purchases = getUserPurchases(chatId);

  if (purchases.length === 0) {
    await bot.sendMessage(chatId, "📋 *Mis Compras*\n─────────────────\n❌ No Tienes Compras Aún.", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Volver Al Menú", callback_data: "main_menu" }]] },
    });
    return;
  }

  let text = "📋 *Mis Compras*\n─────────────────\n\n";
  for (const p of purchases) {
    const date = new Date(p.purchased_at).toLocaleDateString("es", { day: "numeric", month: "numeric" });
    text += `📦 *${p.product_name}*${p.duration_label ? ` - ${p.duration_label}` : ""}\n`;
    text += `💰 $${Number(p.price).toFixed(2)} USD · ${date}\n`;
    if (p.key_value) text += `🔑 \`${p.key_value}\`\n`;
    text += "\n─────────────────\n\n";
  }

  await bot.sendMessage(chatId, text.trim(), { parse_mode: "Markdown", reply_markup: backToMain() });
}

export async function handleReferral(bot: TelegramBot, chatId: number, botUsername: string) {
  const user = getUser(chatId);
  if (!user) return;

  const link = `https://t.me/${botUsername}?start=ref_${chatId}`;
  const text =
    `👥 *Programa de Referidos*\n─────────────────\n\n` +
    `Comparte tu enlace y gana *$0.50 USD* por cada 14 personas nuevas que se registren.\n\n` +
    `🔗 *Tu enlace:*\n${link}\n\n` +
    `📊 *Tus estadísticas:*\n` +
    `✅ Total referidos: ${user.referral_count}\n` +
    `⏳ Para el próximo bono: ${14 - (user.referral_count % 14)} más\n\n` +
    `_Solo cuentan personas nuevas que no estaban registradas antes._`;

  await bot.sendMessage(chatId, text, { parse_mode: "Markdown", reply_markup: backToMain() });
}
