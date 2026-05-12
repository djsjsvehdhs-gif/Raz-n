import TelegramBot from "node-telegram-bot-api";

export const mainMenu = (showAdm = false): TelegramBot.ReplyKeyboardMarkup => ({
  keyboard: [
    [{ text: "🛒 Ver Productos" }, { text: "📋 Mis Compras" }],
    [{ text: "👤 Mi Perfil" }],
    [{ text: "📦 Mis Movimientos" }, { text: "💳 Recargar Saldo" }],
    [{ text: "👥 Invitar Amigos" }],
    ...(showAdm ? [[{ text: "⚙️ Menú ADM" }]] : []),
  ],
  resize_keyboard: true,
});

export const backToMain = (): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [[{ text: "◀️ Volver Al Menú", callback_data: "main_menu" }]],
});

export const categoryKeyboard = (): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [
    [{ text: "🤖 Android", callback_data: "cat_android" }, { text: "🍎 iOS", callback_data: "cat_ios" }],
    [{ text: "🖥️ PC", callback_data: "cat_pc" }],
    [{ text: "🏠 Menú Principal", callback_data: "main_menu" }],
  ],
});

export const admMenu = (): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [
    [{ text: "📦 Productos", callback_data: "adm_products" }, { text: "💳 Métodos de Pago", callback_data: "adm_methods" }],
    [{ text: "💰 Recargas Pendientes", callback_data: "adm_recharges" }, { text: "👥 Usuarios", callback_data: "adm_users" }],
    [{ text: "🚫 Banear / Desbanear", callback_data: "adm_ban" }, { text: "📢 Broadcast", callback_data: "adm_broadcast" }],
  ],
});

export const rechargeCountryKeyboard = (methods: any[]): TelegramBot.InlineKeyboardMarkup => {
  const rows: TelegramBot.InlineKeyboardButton[][] = methods.map(m => ([{
    text: `${m.emoji} ${m.country} (${m.currency}, mín $${m.minimum})`,
    callback_data: `recharge_method_${m.id}`,
  }]));
  rows.push([{ text: "🏠 Menú Principal", callback_data: "main_menu" }]);
  return { inline_keyboard: rows };
};
