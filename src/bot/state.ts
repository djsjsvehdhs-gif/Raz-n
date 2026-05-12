export type UserState =
  | { step: "idle" }
  | { step: "recharge_country" }
  | { step: "recharge_amount"; country: string; methodId: number }
  | { step: "recharge_photo"; transactionId: string; country: string; amountUsd: number }
  | { step: "recharge_confirm"; transactionId: string }
  | { step: "adm_broadcast" }
  | { step: "adm_ban" }
  // ── Product creation wizard ─────────────────────────────────────────────────
  | { step: "adm_add_product_name" }
  | { step: "adm_add_product_category"; productName: string }
  | { step: "adm_wizard_dur_label"; productId: number; productName: string }
  | { step: "adm_wizard_dur_price"; productId: number; productName: string; label: string }
  | { step: "adm_wizard_dur_stock"; productId: number; productName: string; label: string; price: number; durationId: number }
  | { step: "adm_wizard_dur_keys"; productId: number; productName: string; label: string; price: number; durationId: number; stockCount: number }
  // ── Product edit ────────────────────────────────────────────────────────────
  | { step: "adm_add_duration_label"; productId: number }
  | { step: "adm_add_duration_price"; productId: number; label: string }
  | { step: "adm_add_keys"; productId: number; durationId: number }
  | { step: "adm_rename_product"; productId: number }
  | { step: "adm_edit_price"; productId: number; durationId: number }
  | { step: "adm_add_stock"; productId: number; durationId: number }
  // ── Payment methods ─────────────────────────────────────────────────────────
  | { step: "adm_add_method_country" }
  | { step: "adm_add_method_emoji"; country: string }
  | { step: "adm_add_method_bank"; country: string; emoji: string }
  | { step: "adm_add_method_holder"; country: string; emoji: string; bank: string }
  | { step: "adm_add_method_account"; country: string; emoji: string; bank: string; holder: string }
  | { step: "adm_add_method_minimum"; country: string; emoji: string; bank: string; holder: string; account: string }
  | { step: "adm_add_method_rate"; country: string; emoji: string; bank: string; holder: string; account: string; minimum: number }
  | { step: "adm_add_method_currency"; country: string; emoji: string; bank: string; holder: string; account: string; minimum: number; rate: number }
  | { step: "adm_edit_method_field"; methodId: number; field: string }
  // ── Buy ─────────────────────────────────────────────────────────────────────
  | { step: "buy_select_duration"; productId: number }
  | { step: "buy_confirm"; productId: number; durationId: number; price: number };

const userStates = new Map<number, UserState>();

export function getState(userId: number): UserState {
  return userStates.get(userId) ?? { step: "idle" };
}

export function setState(userId: number, state: UserState) {
  userStates.set(userId, state);
}

export function clearState(userId: number) {
  userStates.set(userId, { step: "idle" });
}
