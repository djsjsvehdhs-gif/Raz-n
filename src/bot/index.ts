import TelegramBot from "node-telegram-bot-api";
import {
  getOrCreateUser, getUser, getProduct,
  createProduct, createDuration, addKeys,
  renameProduct, updateDurationPrice,
  createPaymentMethod, updatePaymentMethod,
} from "./db.js";
import { getState, setState, clearState } from "./state.js";

import { handleStart, sendMainMenu } from "./handlers/menu.js";
import { handleProfile, handleMovements, handlePurchases, handleReferral } from "./handlers/profile.js";
import { handleViewProducts, handleCategory, handleProductDetail, handleBuy, handleConfirmBuy } from "./handlers/products.js";
import { handleRecharge, handleRechargeMethod, handleRechargeAmount, handleRechargePhoto, handleRechargeSent } from "./handlers/recharge.js";
import {
  isAdmin,
  handleAdmMenu, handleAdmProducts, handleAdmProductDetail,
  handleAdmMethodDetail, handleAdmMethods,
  startAddProduct, handleAdmRenameProduct, handleAdmDeleteProduct,
  handleAdmNewDuration, handleAdmDelDurationMenu, handleAdmDelDuration,
  handleAdmEditPriceMenu, handleAdmEditPrice,
  handleAdmAddKeysMenu, handleAdmAddKeys, handleAdmAddStockMenu,
  handleAdmMethodFieldEdit, handleAdmDeleteMethod, startAddMethod,
  handleAdmRecharges, handleAdmApprove, handleAdmReject,
  handleAdmUsers, handleAdmBan, handleAdmBroadcast,
  executeBroadcast, executeBanToggle,
} from "./handlers/admin.js";

export function startBot() {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN no configurado.");
    process.exit(1);
  }

  const bot = new TelegramBot(token, { polling: true });

  bot.getMe().then(me => {
    const botUsername = me.username ?? "bot";
    console.log(`✅ Bot iniciado: @${botUsername}`);

    // ─── Helper ───────────────────────────────────────────────────────────────
    async function showDurationAdded(chatId: number, productId: number, label: string, price: number, keyCount: number) {
      await bot.sendMessage(chatId,
        `✅ Duración *${label}* - $${price.toFixed(2)} USD - ${keyCount} keys agregadas.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Agregar otra duración", callback_data: `adm_wizard_newdur_${productId}` }],
              [{ text: "✅ Listo", callback_data: `adm_product_${productId}` }],
            ],
          },
        }
      );
    }

    // ─── /start ───────────────────────────────────────────────────────────────
    bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
      if (msg.chat.type !== "private") return;
      const referrerId = match?.[1] ? parseInt(match[1]) : undefined;
      getOrCreateUser(msg.from!.id, msg.from!.username, msg.from!.first_name);
      await handleStart(bot, msg, referrerId);
    });

    // ─── /cancelar ───────────────────────────────────────────────────────────
    bot.onText(/\/cancelar/, async (msg) => {
      clearState(msg.chat.id);
      await sendMainMenu(bot, msg.chat.id);
    });

    // ─── Mensajes ─────────────────────────────────────────────────────────────
    bot.on("message", async (msg) => {
      if (msg.chat.type !== "private") return;

      const chatId = msg.chat.id;
      const userId = msg.from?.id ?? chatId;

      getOrCreateUser(userId, msg.from?.username, msg.from?.first_name);

      const user = getUser(userId);
      if (user?.banned) {
        await bot.sendMessage(chatId, "🚫 Tu cuenta ha sido suspendida.");
        return;
      }

      // ── Fotos ────────────────────────────────────────────────────────────
      if (msg.photo) {
        const state = getState(userId);
        if (state.step === "recharge_photo") {
          await handleRechargePhoto(bot, msg);
        } else if (state.step === "adm_broadcast" && isAdmin(userId)) {
          const fileId = msg.photo[msg.photo.length - 1]!.file_id;
          await executeBroadcast(bot, userId, "", { type: "photo", fileId, caption: msg.caption });
        }
        return;
      }

      // ── Videos ───────────────────────────────────────────────────────────
      if (msg.video) {
        const state = getState(userId);
        if (state.step === "adm_broadcast" && isAdmin(userId)) {
          await executeBroadcast(bot, userId, "", { type: "video", fileId: msg.video.file_id, caption: msg.caption });
        }
        return;
      }

      if (!msg.text) return;
      const text = msg.text;
      const state = getState(userId);

      // ─── Máquina de estados ────────────────────────────────────────────────
      switch (state.step) {

        case "recharge_amount":
          await handleRechargeAmount(bot, chatId, text);
          return;

        case "adm_broadcast":
          if (!isAdmin(userId)) break;
          if (text === "/cancelar") { clearState(chatId); await sendMainMenu(bot, chatId); return; }
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
          await bot.sendMessage(chatId, `📦 Producto: *${text}*\n\nSelecciona la categoría:`, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🤖 Android", callback_data: "adm_wcat_android" },
                  { text: "🍎 iOS",     callback_data: "adm_wcat_ios" },
                  { text: "🖥️ PC",      callback_data: "adm_wcat_pc"  },
                ],
                [{ text: "❌ Cancelar", callback_data: "adm_products" }],
              ],
            },
          });
          return;

        case "adm_wizard_dur_label":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_wizard_dur_price", productId: state.productId, productName: state.productName, label: text });
          await bot.sendMessage(chatId, `✅ *${text}*. Ahora el *precio en USD* (ej: 1.90):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${state.productId}` }]] },
          });
          return;

        case "adm_wizard_dur_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) { await bot.sendMessage(chatId, "❌ Precio inválido. Ej: 1.90"); return; }
          const durationId = createDuration(state.productId, state.label, price);
          setState(chatId, { step: "adm_wizard_dur_stock", productId: state.productId, productName: state.productName, label: state.label, price, durationId });
          await bot.sendMessage(chatId, `✅ $${price.toFixed(2)} USD. ¿Cuántas keys agregas ahora? (ej: 10)\n\n_Escribe 0 para agregar después._`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "⏭️ Sin stock por ahora", callback_data: `adm_wskip_${state.productId}` }]] },
          });
          return;
        }

        case "adm_wizard_dur_stock": {
          if (!isAdmin(userId)) break;
          const count = parseInt(text);
          if (isNaN(count) || count < 0) { await bot.sendMessage(chatId, "❌ Número inválido."); return; }
          if (count === 0) {
            clearState(chatId);
            await showDurationAdded(chatId, state.productId, state.label, state.price, 0);
          } else {
            setState(chatId, { step: "adm_wizard_dur_keys", productId: state.productId, productName: state.productName, label: state.label, price: state.price, durationId: state.durationId, stockCount: count });
            await bot.sendMessage(chatId, `✅ ${count} keys. Envíalas ahora, *una por línea*:`, {
              parse_mode: "Markdown",
              reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${state.productId}` }]] },
            });
          }
          return;
        }

        case "adm_wizard_dur_keys": {
          if (!isAdmin(userId)) break;
          const keys = text.split("\n").map(k => k.trim()).filter(Boolean);
          if (keys.length === 0) { await bot.sendMessage(chatId, "❌ No se detectaron keys. Escríbelas una por línea."); return; }
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
          await bot.sendMessage(chatId, `✅ Producto renombrado a *${text}*.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;

        case "adm_add_duration_label":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_duration_price", productId: state.productId, label: text });
          await bot.sendMessage(chatId, `⏱️ *${text}*. Escribe el precio en USD (ej: 5.99):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${state.productId}` }]] },
          });
          return;

        case "adm_add_duration_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) { await bot.sendMessage(chatId, "❌ Precio inválido."); return; }
          createDuration(state.productId, state.label, price);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Duración *${state.label}* - $${price.toFixed(2)} USD creada.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;
        }

        case "adm_edit_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) { await bot.sendMessage(chatId, "❌ Precio inválido."); return; }
          updateDurationPrice(state.durationId, price);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Precio actualizado a $${price.toFixed(2)} USD.`);
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;
        }

        case "adm_add_keys": {
          if (!isAdmin(userId)) break;
          const keys = text.split("\n").map(k => k.trim()).filter(Boolean);
          if (keys.length === 0) { await bot.sendMessage(chatId, "❌ No se detectaron keys."); return; }
          addKeys(state.productId, state.durationId, keys);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Se agregaron *${keys.length}* keys.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          return;
        }

        // ── Métodos de pago ─────────────────────────────────────────────────
        case "adm_add_method_country":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_emoji", country: text });
          await bot.sendMessage(chatId, `🌍 País: *${text}*\n\nEscribe el emoji del país (ej: 🇲🇽):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "adm_methods" }]] },
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
          await bot.sendMessage(chatId, "Número de cuenta / CLABE:");
          return;

        case "adm_add_method_account":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_minimum", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: text });
          await bot.sendMessage(chatId, "Monto mínimo en USD (ej: 2):");
          return;

        case "adm_add_method_minimum": {
          if (!isAdmin(userId)) break;
          const min = parseFloat(text);
          if (isNaN(min)) { await bot.sendMessage(chatId, "❌ Número inválido."); return; }
          setState(chatId, { step: "adm_add_method_rate", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: min });
          await bot.sendMessage(chatId, "Tasa de cambio (ej: 20 para 20 moneda local/USD):");
          return;
        }

        case "adm_add_method_rate": {
          if (!isAdmin(userId)) break;
          const rate = parseFloat(text);
          if (isNaN(rate)) { await bot.sendMessage(chatId, "❌ Número inválido."); return; }
          setState(chatId, { step: "adm_add_method_currency", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: state.minimum, rate });
          await bot.sendMessage(chatId, "Código de moneda (ej: MXN, ARS, USDT):");
          return;
        }

        case "adm_add_method_currency": {
          if (!isAdmin(userId)) break;
          createPaymentMethod({ country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: state.minimum, rate: state.rate, currency: text });
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Método *${state.emoji} ${state.country}* creado.`, { parse_mode: "Markdown" });
          await handleAdmMethods(bot, chatId);
          return;
        }

        case "adm_edit_method_field": {
          if (!isAdmin(userId)) break;
          const numFields = ["minimum", "rate"];
          const val: string | number = numFields.includes(state.field) ? parseFloat(text) : text;
          if (numFields.includes(state.field) && isNaN(val as number)) { await bot.sendMessage(chatId, "❌ Debe ser un número."); return; }
          updatePaymentMethod(state.methodId, state.field, val);
          clearState(chatId);
          await bot.sendMessage(chatId, "✅ Campo actualizado.");
          await handleAdmMethodDetail(bot, chatId, state.methodId);
          return;
        }
      }

      // ─── Botones teclado principal ─────────────────────────────────────────
      switch (text) {
        case "🛒 Ver Productos":   await handleViewProducts(bot, chatId); break;
        case "📋 Mis Compras":     await handlePurchases(bot, chatId); break;
        case "👤 Mi Perfil":       await handleProfile(bot, chatId); break;
        case "📦 Mis Movimientos": await handleMovements(bot, chatId); break;
        case "💳 Recargar Saldo":  await handleRecharge(bot, chatId); break;
        case "👥 Invitar Amigos":  await handleReferral(bot, chatId, botUsername); break;
        case "⚙️ Menú ADM":
          if (isAdmin(userId)) await handleAdmMenu(bot, chatId);
          break;
        default:
          if (!text.startsWith("/")) await sendMainMenu(bot, chatId);
      }
    });

    // ─── Callback queries ─────────────────────────────────────────────────────
    bot.on("callback_query", async (query) => {
      const userId      = query.from.id;
      const chatId      = query.message?.chat.id;
      const data        = query.data ?? "";
      const msgChatType = query.message?.chat.type;
      const isGroup     = msgChatType === "group" || msgChatType === "supergroup";

      await bot.answerCallbackQuery(query.id).catch(() => {});
      if (!chatId) return;

      // ── Desde grupo: solo aprobar/rechazar (solo admin) ───────────────────
      if (isGroup) {
        if (!isAdmin(userId)) return;
        if (data.startsWith("adm_approve_")) { await handleAdmApprove(bot, userId, data.slice("adm_approve_".length)); return; }
        if (data.startsWith("adm_reject_"))  { await handleAdmReject(bot, userId, data.slice("adm_reject_".length)); return; }
        return;
      }

      // ── Verificar baneo ───────────────────────────────────────────────────
      const user = getUser(userId);
      if (user?.banned) { await bot.sendMessage(chatId, "🚫 Tu cuenta ha sido suspendida."); return; }

      // ── Navegación general ────────────────────────────────────────────────
      if (data === "main_menu")     { await sendMainMenu(bot, chatId); return; }
      if (data === "view_products") { await handleViewProducts(bot, chatId); return; }
      if (data === "recharge")      { await handleRecharge(bot, chatId); return; }

      // ── Categorías ────────────────────────────────────────────────────────
      if (data.startsWith("cat_")) { await handleCategory(bot, chatId, data.slice(4)); return; }

      // ── Productos ─────────────────────────────────────────────────────────
      if (data.startsWith("product_")) { await handleProductDetail(bot, chatId, Number(data.slice(8))); return; }

      // ── Comprar: buy_{productId}_{durationId} ─────────────────────────────
      if (data.startsWith("buy_")) {
        const rest = data.slice(4);
        const sep  = rest.indexOf("_");
        await handleBuy(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }

      // ── Confirmar compra: confirm_buy_{productId}_{durationId} ────────────
      if (data.startsWith("confirm_buy_")) {
        const rest = data.slice("confirm_buy_".length);
        const sep  = rest.indexOf("_");
        await handleConfirmBuy(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }

      // ── Recarga ───────────────────────────────────────────────────────────
      if (data.startsWith("recharge_method_")) { await handleRechargeMethod(bot, chatId, Number(data.slice("recharge_method_".length))); return; }
      if (data.startsWith("recharge_sent_"))   { await handleRechargeSent(bot, chatId); return; }

      // ── Guard admin ───────────────────────────────────────────────────────
      if (!isAdmin(userId)) {
        if (data.startsWith("adm_")) await bot.sendMessage(chatId, "🚫 No tienes permiso.");
        return;
      }

      // ── Menú admin ────────────────────────────────────────────────────────
      if (data === "adm_menu")        { await handleAdmMenu(bot, chatId); return; }
      if (data === "adm_products")    { await handleAdmProducts(bot, chatId); return; }
      if (data === "adm_add_product") { await startAddProduct(bot, chatId); return; }
      if (data === "adm_methods")     { await handleAdmMethods(bot, chatId); return; }
      if (data === "adm_add_method")  { await startAddMethod(bot, chatId); return; }
      if (data === "adm_recharges")   { await handleAdmRecharges(bot, chatId); return; }
      if (data === "adm_users")       { await handleAdmUsers(bot, chatId); return; }
      if (data === "adm_ban")         { await handleAdmBan(bot, chatId); return; }
      if (data === "adm_broadcast")   { await handleAdmBroadcast(bot, chatId); return; }

      // ── Wizard: selección de categoría (adm_wcat_{cat}) ──────────────────
      if (data.startsWith("adm_wcat_")) {
        const category = data.slice("adm_wcat_".length);
        const state = getState(userId);
        if (state.step !== "adm_add_product_category") return;
        const productId = createProduct(state.productName, category);
        setState(chatId, { step: "adm_wizard_dur_label", productId, productName: state.productName });
        await bot.sendMessage(chatId,
          `✅ Producto *${state.productName}* creado en ${category}.\n\nAhora escribe el nombre de la primera *duración* (ej: 1 Mes, 7 Días, Lifetime):`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
          }
        );
        return;
      }

      // ── Wizard: saltar stock (adm_wskip_{productId}) ──────────────────────
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

      // ── Wizard: agregar otra duración ─────────────────────────────────────
      if (data.startsWith("adm_wizard_newdur_")) {
        const productId = Number(data.slice("adm_wizard_newdur_".length));
        const product = getProduct(productId);
        if (!product) return;
        setState(chatId, { step: "adm_wizard_dur_label", productId, productName: product.name });
        await bot.sendMessage(chatId, "➕ Escribe el nombre de la nueva duración (ej: 3 Meses):", {
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
        });
        return;
      }

      // ── Gestión de productos ──────────────────────────────────────────────
      if (data.startsWith("adm_product_"))    { await handleAdmProductDetail(bot, chatId, Number(data.slice("adm_product_".length))); return; }
      if (data.startsWith("adm_rename_"))     { await handleAdmRenameProduct(bot, chatId, Number(data.slice("adm_rename_".length))); return; }
      if (data.startsWith("adm_delproduct_")) { await handleAdmDeleteProduct(bot, chatId, Number(data.slice("adm_delproduct_".length))); return; }
      if (data.startsWith("adm_newduration_")){ await handleAdmNewDuration(bot, chatId, Number(data.slice("adm_newduration_".length))); return; }
      if (data.startsWith("adm_stock_menu_")) { await handleAdmAddStockMenu(bot, chatId, Number(data.slice("adm_stock_menu_".length))); return; }

      // ── Eliminar duración ─────────────────────────────────────────────────
      if (data.startsWith("adm_delduration_menu_")) { await handleAdmDelDurationMenu(bot, chatId, Number(data.slice("adm_delduration_menu_".length))); return; }
      if (data.startsWith("adm_delduration_")) {
        const rest = data.slice("adm_delduration_".length);
        const sep  = rest.indexOf("_");
        await handleAdmDelDuration(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }

      // ── Editar precio ─────────────────────────────────────────────────────
      if (data.startsWith("adm_editprice_menu_")) { await handleAdmEditPriceMenu(bot, chatId, Number(data.slice("adm_editprice_menu_".length))); return; }
      if (data.startsWith("adm_editprice_")) {
        const rest = data.slice("adm_editprice_".length);
        const sep  = rest.indexOf("_");
        await handleAdmEditPrice(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }

      // ── Agregar keys ──────────────────────────────────────────────────────
      if (data.startsWith("adm_addkeys_menu_")) { await handleAdmAddKeysMenu(bot, chatId, Number(data.slice("adm_addkeys_menu_".length))); return; }
      if (data.startsWith("adm_addkeys_")) {
        const rest = data.slice("adm_addkeys_".length);
        const sep  = rest.indexOf("_");
        await handleAdmAddKeys(bot, chatId, Number(rest.slice(0, sep)), Number(rest.slice(sep + 1)));
        return;
      }

      // ── Métodos de pago ───────────────────────────────────────────────────
      if (data.startsWith("adm_delmethod_")) { await handleAdmDeleteMethod(bot, chatId, Number(data.slice("adm_delmethod_".length))); return; }

      // adm_mfield_{methodId}_{fieldName}
      if (data.startsWith("adm_mfield_")) {
        const rest      = data.slice("adm_mfield_".length);
        const sep       = rest.indexOf("_");
        const methodId  = Number(rest.slice(0, sep));
        const fieldName = rest.slice(sep + 1);
        await handleAdmMethodFieldEdit(bot, chatId, methodId, fieldName);
        return;
      }

      // adm_method_{id} — después de adm_mfield_ y adm_delmethod_
      if (data.startsWith("adm_method_")) { await handleAdmMethodDetail(bot, chatId, Number(data.slice("adm_method_".length))); return; }

      // ── Aprobación de recargas ────────────────────────────────────────────
      if (data.startsWith("adm_approve_")) { await handleAdmApprove(bot, chatId, data.slice("adm_approve_".length)); return; }
      if (data.startsWith("adm_reject_"))  { await handleAdmReject(bot, chatId, data.slice("adm_reject_".length)); return; }
    });

    bot.on("polling_error", (err) => {
      console.error("Polling error:", err.message);
    });
  });
}
