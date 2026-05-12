import TelegramBot from "node-telegram-bot-api";
import { getPaymentMethods, getPaymentMethod, createRecharge, updateRechargePhoto, getRecharge } from "../db.js";
import { rechargeCountryKeyboard } from "../keyboards.js";
import { getState, setState, clearState } from "../state.js";

const RECEIPTS_GROUP_ID = process.env["RECEIPTS_GROUP_ID"] ?? "";

function generateTransactionId(): string {
  return "TP" + Date.now();
}

export async function handleRecharge(bot: TelegramBot, chatId: number) {
  const methods = getPaymentMethods();

  if (methods.length === 0) {
    await bot.sendMessage(chatId, "❌ No hay métodos de pago configurados. Contacta al administrador.", {
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menú Principal", callback_data: "main_menu" }]] },
    });
    return;
  }

  await bot.sendMessage(chatId, "💳 *Recargar Saldo*\n\n¿Desde Qué País Deseas Recargar?", {
    parse_mode: "Markdown",
    reply_markup: rechargeCountryKeyboard(methods),
  });
}

export async function handleRechargeMethod(bot: TelegramBot, chatId: number, methodId: number) {
  const method = getPaymentMethod(methodId);
  if (!method) return;

  setState(chatId, { step: "recharge_amount", country: method.country, methodId });

  await bot.sendMessage(chatId,
    `💳 *RECARGAR SALDO*\n─────────────────\n🌍 ${method.emoji} ${method.country}\n💵 Mínimo: $${method.minimum.toFixed(2)} USD\n\n─────────────────\n¿Cuánto deseas recargar (en USD)?\n_Ejemplo: 10_`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "◀️ Volver Al Menú", callback_data: "main_menu" }]] },
    }
  );
}

export async function handleRechargeAmount(bot: TelegramBot, chatId: number, text: string) {
  const state = getState(chatId);
  if (state.step !== "recharge_amount") return;

  const amount = parseFloat(text);
  const method = getPaymentMethod(state.methodId);

  if (!method || isNaN(amount) || amount < method.minimum) {
    await bot.sendMessage(chatId, `❌ Monto inválido. El mínimo es $${method?.minimum ?? 0} USD.`);
    return;
  }

  const transactionId = generateTransactionId();
  const amountLocal = amount * method.rate;

  createRecharge({ transactionId, userId: chatId, country: method.country, amountUsd: amount, amountLocal });
  setState(chatId, { step: "recharge_photo", transactionId, country: method.country, amountUsd: amount });

  await bot.sendMessage(chatId,
    `💳 *INSTRUCCIONES DE PAGO*\n─────────────────\n` +
    `🌍 ${method.emoji} ${method.country}\n` +
    `🆔 Recarga: \`${transactionId}\`\n` +
    `💰 Monto USD: $${amount.toFixed(2)} USD\n` +
    `💵 Total a pagar: ${amountLocal.toFixed(2)} ${method.currency}\n\n` +
    `─────────────────\n` +
    `🏦 Banco: ${method.bank}\n` +
    `👤 Titular: ${method.holder}\n` +
    `📋 Cuenta: \`${method.account}\`\n` +
    `💸 Enviar: ${amountLocal.toFixed(2)} ${method.currency}\n\n` +
    `─────────────────\n` +
    `📸 Envía la foto del comprobante aquí mismo.`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "📸 Ya Mandé el Comprobante", callback_data: `recharge_sent_${transactionId}` }],
          [{ text: "🏠 Menú Principal", callback_data: "main_menu" }],
        ],
      },
    }
  );
}

export async function handleRechargePhoto(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const state = getState(chatId);
  if (state.step !== "recharge_photo") return;

  const photo = msg.photo;
  if (!photo || photo.length === 0) return;

  const fileId = photo[photo.length - 1]!.file_id;
  const { transactionId, amountUsd } = state;
  const recharge = getRecharge(transactionId);
  if (!recharge) return;

  updateRechargePhoto(transactionId, fileId);

  const user = msg.from!;
  const userName = user.username ? `@${user.username}` : user.first_name ?? "Usuario";

  // ── Reenviar al grupo con botones de aprobar/rechazar ──────────────────────
  if (RECEIPTS_GROUP_ID) {
    try {
      await bot.sendPhoto(RECEIPTS_GROUP_ID, fileId, {
        caption:
          `📸 *Comprobante de Recarga*\n─────────────────\n` +
          `👤 Usuario: ${userName}\n` +
          `🆔 Telegram ID: \`${chatId}\`\n` +
          `🆔 Transacción: \`${transactionId}\`\n` +
          `🌍 País: ${recharge.country}\n` +
          `💰 Monto: $${amountUsd.toFixed(2)} USD`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Aprobar", callback_data: `adm_approve_${transactionId}` },
            { text: "❌ Rechazar", callback_data: `adm_reject_${transactionId}` },
          ]],
        },
      });
    } catch (err) {
      console.error("Error enviando al grupo:", err);
    }
  }

  clearState(chatId);

  await bot.sendMessage(chatId,
    `✅ *Comprobante recibido.*\n\n` +
    `Tu recarga de *$${amountUsd.toFixed(2)} USD* está siendo verificada.\n` +
    `ID: \`${transactionId}\`\n\n` +
    `Te notificaremos cuando sea aprobada.`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: [[{ text: "🏠 Menú Principal", callback_data: "main_menu" }]] },
    }
  );
}

export async function handleRechargeSent(bot: TelegramBot, chatId: number) {
  const state = getState(chatId);
  if (state.step === "recharge_photo") {
    await bot.sendMessage(chatId, "📸 Por favor envía la foto del comprobante directamente en el chat.");
  } else {
    await bot.sendMessage(chatId, "✅ Tu solicitud ya fue registrada. Espera la aprobación del administrador.");
  }
}
