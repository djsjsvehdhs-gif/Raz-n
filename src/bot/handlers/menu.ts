import TelegramBot from "node-telegram-bot-api";
import { getOrCreateUser, getRank } from "../db.js";
import { mainMenu } from "../keyboards.js";
import { clearState } from "../state.js";

const ADMIN_ID = Number(process.env["ADMIN_ID"] ?? "0");

export async function handleStart(bot: TelegramBot, msg: TelegramBot.Message, referrerId?: number) {
  const { id, username, first_name } = msg.from!;
  const user = getOrCreateUser(id, username, first_name);

  if (referrerId && referrerId !== id && !user.referred_by) {
    const { registerReferral } = await import("../db.js");
    registerReferral(id, referrerId);
  }

  if (user.banned) {
    await bot.sendMessage(id, "🚫 Tu cuenta ha sido suspendida. Contacta al administrador.");
    return;
  }

  clearState(id);
  const rank = getRank(user.total_spent);
  const name = user.first_name || user.username || "Usuario";
  const isAdm = id === ADMIN_ID;

  await bot.sendMessage(
    id,
    `🏪 *NEEX STORE*\n─────────────────\n👋 ¡Hola de vuelta, ${name}!\n\n💰 *Saldo:* $${Number(user.balance).toFixed(2)} USD\n${rank.emoji} *Rango:* ${rank.name}\n\nElige una opción del menú 👇`,
    { parse_mode: "Markdown", reply_markup: mainMenu(isAdm) }
  );
}

export async function sendMainMenu(bot: TelegramBot, chatId: number) {
  const user = getOrCreateUser(chatId);
  clearState(chatId);
  const rank = getRank(user.total_spent ?? 0);
  const name = user.first_name || user.username || "Usuario";
  const isAdm = chatId === ADMIN_ID;

  await bot.sendMessage(
    chatId,
    `🏪 *NEEX STORE*\n─────────────────\n👋 ¡Hola de vuelta, ${name}!\n\n💰 *Saldo:* $${Number(user.balance).toFixed(2)} USD\n${rank.emoji} *Rango:* ${rank.name}\n\nElige una opción del menú 👇`,
    { parse_mode: "Markdown", reply_markup: mainMenu(isAdm) }
  );
}
