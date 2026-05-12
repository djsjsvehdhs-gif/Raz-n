import TelegramBot from "node-telegram-bot-api";
import { getOrCreateUser, getUser, createProduct, createDuration, addKeys, renameProduct, updateDurationPrice, createPaymentMethod, updatePaymentMethod } from "./db.js";
import { getState, setState, clearState } from "./state.js";

import { handleStart, sendMainMenu } from "./handlers/menu.js";
import { handleProfile, handleMovements, handlePurchases, handleReferral } from "./handlers/profile.js";
import { handleViewProducts, handleCategory, handleProductDetail, handleBuy, handleConfirmBuy } from "./handlers/products.js";
import { handleRecharge, handleRechargeMethod, handleRechargeAmount, handleRechargePhoto, handleRechargeSent } from "./handlers/recharge.js";
import {
  isAdmin, handleAdmMenu, handleAdmProducts, handleAdmProductDetail, handleAdmMethodDetail,
  startAddProduct, handleAdmRenameProduct, handleAdmDeleteProduct,
  handleAdmNewDuration, handleAdmDelDurationMenu, handleAdmDelDuration,
  handleAdmEditPriceMenu, handleAdmEditPrice,
  handleAdmAddKeysMenu, handleAdmAddKeys, handleAdmAddStockMenu,
  handleAdmMethods, handleAdmMethodFieldEdit, handleAdmDeleteMethod, startAddMethod,
  handleAdmRecharges, handleAdmApprove, handleAdmReject,
  handleAdmUsers, handleAdmBan, handleAdmBroadcast, executeBroadcast, executeBanToggle,
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

    // ─── Helper: duración añadida ────────────────────────────────────────────
    async function showDurationAdded(chatId: number, productId: number, label: string, price: number, keyCount: number) {
      await bot.sendMessage(chatId,
        `✅ Duración agregada: *${label}* - $${price.toFixed(2)} USD - ${keyCount} keys.`,
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

    // ─── /start ──────────────────────────────────────────────────────────────
    bot.onText(/\/start(?:\s+ref_(\d+))?/, async (msg, match) => {
      if (msg.chat.type !== "private") return;
      const referrerId = match?.[1] ? parseInt(match[1]) : undefined;
      getOrCreateUser(msg.from!.id, msg.from!.username, msg.from!.first_name);
      await handleStart(bot, msg, referrerId);
    });

    // ─── /cancelar ───────────────────────────────────────────────────────────
    bot.onText(/\/cancelar/, async (msg) => {
      if (msg.chat.type !== "private") return;
      clearState(msg.from!.id);
      await sendMainMenu(bot, msg.chat.id);
    });

    // ─── Fotos (comprobantes de recarga) ─────────────────────────────────────
    bot.on("photo", async (msg) => {
      if (msg.chat.type !== "private") return;
      const userId = msg.from!.id;
      const state = getState(userId);
      if (state.step === "recharge_photo") {
        await handleRechargePhoto(bot, msg);
      }
    });

    // ─── Videos (broadcast) ──────────────────────────────────────────────────
    bot.on("video", async (msg) => {
      if (msg.chat.type !== "private") return;
      const userId = msg.from!.id;
      const state = getState(userId);
      if (state.step === "adm_broadcast" && isAdmin(userId)) {
        const fileId = msg.video!.file_id;
        const caption = msg.caption ?? undefined;
        await executeBroadcast(bot, userId, "", { type: "video", fileId, caption });
      }
    });

    // ─── Mensajes de texto ───────────────────────────────────────────────────
    bot.on("message", async (msg) => {
      if (msg.chat.type !== "private") return;
      if (!msg.text) return;

      const chatId = msg.chat.id;
      const userId = msg.from!.id;
      const text = msg.text;
      const state = getState(userId);

      const user = getUser(userId);
      if (user?.banned) {
        await bot.sendMessage(chatId, "🚫 Tu cuenta ha sido suspendida. Contacta al administrador.");
        return;
      }

      // ── Menú por texto ────────────────────────────────────────────────────
      if (text === "🛒 Ver Productos") { await handleViewProducts(bot, chatId); return; }
      if (text === "👤 Mi Perfil") { getOrCreateUser(chatId); await handleProfile(bot, chatId); return; }
      if (text === "📦 Mis Movimientos") { await handleMovements(bot, chatId); return; }
      if (text === "📋 Mis Compras") { await handlePurchases(bot, chatId); return; }
      if (text === "💳 Recargar Saldo") { await handleRecharge(bot, chatId); return; }
      if (text === "👥 Invitar Amigos") { await handleReferral(bot, chatId, botUsername); return; }
      if (text === "⚙️ Menú Adm" && isAdmin(userId)) { await handleAdmMenu(bot, chatId); return; }

      // ── Estados ───────────────────────────────────────────────────────────
      switch (state.step) {

        // ── Recarga ─────────────────────────────────────────────────────────
        case "recharge_amount":
          await handleRechargeAmount(bot, chatId, text);
          break;

        // ── Broadcast ────────────────────────────────────────────────────────
        case "adm_broadcast":
          if (!isAdmin(userId)) break;
          if (msg.photo && msg.photo.length > 0) {
            const fileId = msg.photo[msg.photo.length - 1]!.file_id;
            const caption = msg.caption ?? undefined;
            await executeBroadcast(bot, userId, "", { type: "photo", fileId, caption });
          } else {
            await executeBroadcast(bot, userId, text);
          }
          break;

        // ── Ban ──────────────────────────────────────────────────────────────
        case "adm_ban":
          if (!isAdmin(userId)) break;
          await executeBanToggle(bot, userId, text);
          break;

        // ── Creación de producto — wizard ─────────────────────────────────────
        case "adm_add_product_name":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_product_category", productName: text });
          await bot.sendMessage(chatId, `📦 Categoría para *${text}*:`, {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🤖 Android", callback_data: "adm_wizard_cat_android" }, { text: "🍎 iOS", callback_data: "adm_wizard_cat_ios" }, { text: "🖥️ PC", callback_data: "adm_wizard_cat_pc" }],
                [{ text: "❌ Cancelar", callback_data: "adm_products" }],
              ],
            },
          });
          break;

        case "adm_wizard_dur_label":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_wizard_dur_price", productId: state.productId, productName: state.productName, label: text });
          await bot.sendMessage(chatId, `💰 Precio en USD para *${text}* (ej: 5.99):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${state.productId}` }]] },
          });
          break;

        case "adm_wizard_dur_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) { await bot.sendMessage(chatId, "❌ Precio inválido. Ej: 5.99"); break; }
          const durationId = createDuration(state.productId, state.label, price);
          setState(chatId, { step: "adm_wizard_dur_stock", productId: state.productId, productName: state.productName, label: state.label, price, durationId });
          await bot.sendMessage(chatId, `📦 ¿Cuántas keys quieres agregar para *${state.label}*? (número):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "⏭️ Omitir (sin stock)", callback_data: `adm_wizard_skip_stock_${state.productId}` }]] },
          });
          break;
        }

        case "adm_wizard_dur_stock": {
          if (!isAdmin(userId)) break;
          const count = parseInt(text);
          if (isNaN(count) || count <= 0) { await bot.sendMessage(chatId, "❌ Número inválido."); break; }
          setState(chatId, { step: "adm_wizard_dur_keys", productId: state.productId, productName: state.productName, label: state.label, price: state.price, durationId: state.durationId, stockCount: count });
          await bot.sendMessage(chatId, `🔑 Envía *${count} keys*, una por línea:`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${state.productId}` }]] },
          });
          break;
        }

        case "adm_wizard_dur_keys": {
          if (!isAdmin(userId)) break;
          const keyLines = text.split("\n").map(l => l.trim()).filter(Boolean);
          addKeys(state.productId, state.durationId, keyLines);
          clearState(chatId);
          await showDurationAdded(chatId, state.productId, state.label, state.price, keyLines.length);
          break;
        }

        // ── Edición de producto ───────────────────────────────────────────────
        case "adm_rename_product":
          if (!isAdmin(userId)) break;
          renameProduct(state.productId, text);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Producto renombrado a *${text}*.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          break;

        case "adm_add_duration_label":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_duration_price", productId: state.productId, label: text });
          await bot.sendMessage(chatId, `💰 Precio en USD para *${text}* (ej: 5.99):`, {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${state.productId}` }]] },
          });
          break;

        case "adm_add_duration_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) { await bot.sendMessage(chatId, "❌ Precio inválido."); break; }
          createDuration(state.productId, state.label, price);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Duración *${state.label}* a $${price.toFixed(2)} USD creada.`, { parse_mode: "Markdown" });
          await handleAdmProductDetail(bot, chatId, state.productId);
          break;
        }

        case "adm_add_keys": {
          if (!isAdmin(userId)) break;
          const keyLines = text.split("\n").map(l => l.trim()).filter(Boolean);
          addKeys(state.productId, state.durationId, keyLines);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ ${keyLines.length} keys agregadas.`);
          await handleAdmProductDetail(bot, chatId, state.productId);
          break;
        }

        case "adm_edit_price": {
          if (!isAdmin(userId)) break;
          const price = parseFloat(text);
          if (isNaN(price) || price <= 0) { await bot.sendMessage(chatId, "❌ Precio inválido."); break; }
          updateDurationPrice(state.durationId, price);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Precio actualizado a $${price.toFixed(2)} USD.`);
          await handleAdmProductDetail(bot, chatId, state.productId);
          break;
        }

        // ── Métodos de pago — wizard ──────────────────────────────────────────
        case "adm_add_method_country":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_emoji", country: text });
          await bot.sendMessage(chatId, `Emoji para ${text} (ej: 🇲🇽):`);
          break;
        case "adm_add_method_emoji":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_bank", country: state.country, emoji: text });
          await bot.sendMessage(chatId, "Nombre del banco:");
          break;
        case "adm_add_method_bank":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_holder", country: state.country, emoji: state.emoji, bank: text });
          await bot.sendMessage(chatId, "Nombre del titular:");
          break;
        case "adm_add_method_holder":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_account", country: state.country, emoji: state.emoji, bank: state.bank, holder: text });
          await bot.sendMessage(chatId, "Número de cuenta / CLABE:");
          break;
        case "adm_add_method_account":
          if (!isAdmin(userId)) break;
          setState(chatId, { step: "adm_add_method_minimum", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: text });
          await bot.sendMessage(chatId, "Monto mínimo en USD (ej: 2):");
          break;
        case "adm_add_method_minimum": {
          if (!isAdmin(userId)) break;
          const min = parseFloat(text);
          if (isNaN(min)) { await bot.sendMessage(chatId, "❌ Monto inválido."); break; }
          setState(chatId, { step: "adm_add_method_rate", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: min });
          await bot.sendMessage(chatId, "Tasa de cambio (ej: 17.5 para 17.5 moneda local/USD):");
          break;
        }
        case "adm_add_method_rate": {
          if (!isAdmin(userId)) break;
          const rate = parseFloat(text);
          if (isNaN(rate)) { await bot.sendMessage(chatId, "❌ Tasa inválida."); break; }
          setState(chatId, { step: "adm_add_method_currency", country: state.country, emoji: state.emoji, bank: state.bank, holder: state.holder, account: state.account, minimum: state.minimum, rate });
          await bot.sendMessage(chatId, "Código de moneda (ej: MXN, ARS, USDT, VES):");
          break;
        }
        case "adm_add_method_currency": {
          if (!isAdmin(userId)) break;
          createPaymentMethod({
            country: state.country, emoji: state.emoji, bank: state.bank,
            holder: state.holder, account: state.account,
            minimum: state.minimum, rate: state.rate, currency: text,
          });
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Método *${state.emoji} ${state.country}* agregado.`, { parse_mode: "Markdown" });
          await handleAdmMethods(bot, chatId);
          break;
        }
        case "adm_edit_method_field": {
          if (!isAdmin(userId)) break;
          const numFields = ["minimum", "rate"];
          const val = numFields.includes(state.field) ? parseFloat(text) : text;
          updatePaymentMethod(state.methodId, state.field, val as any);
          clearState(chatId);
          await bot.sendMessage(chatId, `✅ Campo actualizado.`);
          await handleAdmMethodDetail(bot, chatId, state.methodId);
          break;
        }
      }
    });

    // ─── Callback queries (funciona en privado Y grupos) ─────────────────────
    bot.on("callback_query", async (query) => {
      const chatId = query.message?.chat.id;
      const userId = query.from.id;
      const data = query.data ?? "";
      const isGroupChat = query.message?.chat.type === "group" || query.message?.chat.type === "supergroup";

      if (!chatId) return;
      await bot.answerCallbackQuery(query.id);

      // Desde grupo: solo aprobar/rechazar recargas (solo admin)
      if (isGroupChat) {
        if (!isAdmin(userId)) return;
        if (data.startsWith("adm_approve_")) { await handleAdmApprove(bot, userId, data.replace("adm_approve_", "")); return; }
        if (data.startsWith("adm_reject_"))  { await handleAdmReject(bot, userId, data.replace("adm_reject_", "")); return; }
        return;
      }

      const user = getUser(userId);
      if (user?.banned) { await bot.sendMessage(chatId, "🚫 Tu cuenta ha sido suspendida."); return; }

      // ── Navegación principal ──────────────────────────────────────────────
      if (data === "main_menu")      { await sendMainMenu(bot, chatId); return; }
      if (data === "view_products")  { await handleViewProducts(bot, chatId); return; }
      if (data === "recharge")       { await handleRecharge(bot, chatId); return; }

      // ── Categorías de productos ───────────────────────────────────────────
      if (data.startsWith("cat_"))     { await handleCategory(bot, chatId, data.replace("cat_", "")); return; }
      if (data.startsWith("product_")) { await handleProductDetail(bot, chatId, parseInt(data.replace("product_", ""))); return; }

      // ── Compra ───────────────────────────────────────────────────────────
      if (data.startsWith("buy_")) {
        const [, pid, did] = data.split("_");
        await handleBuy(bot, chatId, parseInt(pid!), parseInt(did!));
        return;
      }
      if (data.startsWith("confirm_buy_")) {
        const [, , pid, did] = data.split("_");
        await handleConfirmBuy(bot, chatId, parseInt(pid!), parseInt(did!));
        return;
      }

      // ── Recarga ──────────────────────────────────────────────────────────
      if (data.startsWith("recharge_method_")) { await handleRechargeMethod(bot, chatId, parseInt(data.replace("recharge_method_", ""))); return; }
      if (data.startsWith("recharge_sent_"))   { await handleRechargeSent(bot, chatId); return; }

      // ── Admin ─────────────────────────────────────────────────────────────
      if (!isAdmin(userId)) return;

      if (data === "adm_menu")      { await handleAdmMenu(bot, chatId); return; }
      if (data === "adm_products")  { await handleAdmProducts(bot, chatId); return; }
      if (data === "adm_methods")   { await handleAdmMethods(bot, chatId); return; }
      if (data === "adm_recharges") { await handleAdmRecharges(bot, chatId); return; }
      if (data === "adm_users")     { await handleAdmUsers(bot, chatId); return; }
      if (data === "adm_ban")       { await handleAdmBan(bot, chatId); return; }
      if (data === "adm_broadcast") { await handleAdmBroadcast(bot, chatId); return; }
      if (data === "adm_add_product") { await startAddProduct(bot, chatId); return; }
      if (data === "adm_add_method")  { await startAddMethod(bot, chatId); return; }

      if (data.startsWith("adm_product_"))           { await handleAdmProductDetail(bot, chatId, parseInt(data.replace("adm_product_", ""))); return; }
      if (data.startsWith("adm_rename_"))             { await handleAdmRenameProduct(bot, chatId, parseInt(data.replace("adm_rename_", ""))); return; }
      if (data.startsWith("adm_delproduct_"))         { await handleAdmDeleteProduct(bot, chatId, parseInt(data.replace("adm_delproduct_", ""))); return; }
      if (data.startsWith("adm_newduration_"))        { await handleAdmNewDuration(bot, chatId, parseInt(data.replace("adm_newduration_", ""))); return; }
      if (data.startsWith("adm_delduration_menu_"))   { await handleAdmDelDurationMenu(bot, chatId, parseInt(data.replace("adm_delduration_menu_", ""))); return; }
      if (data.startsWith("adm_editprice_menu_"))     { await handleAdmEditPriceMenu(bot, chatId, parseInt(data.replace("adm_editprice_menu_", ""))); return; }
      if (data.startsWith("adm_addkeys_menu_"))       { await handleAdmAddKeysMenu(bot, chatId, parseInt(data.replace("adm_addkeys_menu_", ""))); return; }
      if (data.startsWith("adm_stock_menu_"))         { await handleAdmAddStockMenu(bot, chatId, parseInt(data.replace("adm_stock_menu_", ""))); return; }
      if (data.startsWith("adm_method_"))             { await handleAdmMethodDetail(bot, chatId, parseInt(data.replace("adm_method_", ""))); return; }
      if (data.startsWith("adm_delmethod_"))          { await handleAdmDeleteMethod(bot, chatId, parseInt(data.replace("adm_delmethod_", ""))); return; }
      if (data.startsWith("adm_approve_"))            { await handleAdmApprove(bot, chatId, data.replace("adm_approve_", "")); return; }
      if (data.startsWith("adm_reject_"))             { await handleAdmReject(bot, chatId, data.replace("adm_reject_", "")); return; }

      if (data.startsWith("adm_delduration_")) {
        const parts = data.replace("adm_delduration_", "").split("_");
        await handleAdmDelDuration(bot, chatId, parseInt(parts[0]!), parseInt(parts[1]!));
        return;
      }
      if (data.startsWith("adm_editprice_")) {
        const parts = data.replace("adm_editprice_", "").split("_");
        await handleAdmEditPrice(bot, chatId, parseInt(parts[0]!), parseInt(parts[1]!));
        return;
      }
      if (data.startsWith("adm_addkeys_")) {
        const parts = data.replace("adm_addkeys_", "").split("_");
        await handleAdmAddKeys(bot, chatId, parseInt(parts[0]!), parseInt(parts[1]!));
        return;
      }
      if (data.startsWith("adm_mfield_")) {
        const parts = data.replace("adm_mfield_", "").split("_");
        await handleAdmMethodFieldEdit(bot, chatId, parseInt(parts[0]!), parts[1]!);
        return;
      }

      // ── Wizard categoría ─────────────────────────────────────────────────
      if (data.startsWith("adm_wizard_cat_")) {
        const state = getState(userId);
        if (state.step !== "adm_add_product_category") return;
        const category = data.replace("adm_wizard_cat_", "");
        const productId = createProduct(state.productName, category);
        setState(chatId, { step: "adm_wizard_dur_label", productId, productName: state.productName });
        await bot.sendMessage(chatId,
          `✅ Producto *${state.productName}* creado.\n\nAhora escribe el nombre de la primera duración (ej: 1 Mes, 7 Días):`,
          {
            parse_mode: "Markdown",
            reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
          }
        );
        return;
      }

      if (data.startsWith("adm_wizard_skip_stock_")) {
        const productId = parseInt(data.replace("adm_wizard_skip_stock_", ""));
        const state = getState(userId);
        clearState(chatId);
        if (state.step === "adm_wizard_dur_stock") {
          await showDurationAdded(chatId, productId, state.label, state.price, 0);
        }
        return;
      }

      if (data.startsWith("adm_wizard_newdur_")) {
        const productId = parseInt(data.replace("adm_wizard_newdur_", ""));
        const state2 = getState(userId);
        setState(chatId, { step: "adm_wizard_dur_label", productId, productName: (state2 as any).productName ?? "" });
        await bot.sendMessage(chatId, "➕ Escribe el nombre de la nueva duración (ej: 3 Meses):", {
          reply_markup: { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `adm_product_${productId}` }]] },
        });
        return;
      }
    });

    bot.on("polling_error", (err) => {
      console.error("Polling error:", err.message);
    });
  });
}
