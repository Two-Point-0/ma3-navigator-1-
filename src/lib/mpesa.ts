import { APP_MODE } from "@/lib/appMode";
import { supabase } from "@/lib/supabase";

/** Turns 0712 345 678 / +254712345678 / 254712345678 into 254712345678, or null if invalid. */
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^0-9]/g, "");
  if (/^0[17][0-9]{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17][0-9]{8}$/.test(digits)) return digits;
  if (/^[17][0-9]{8}$/.test(digits)) return `254${digits}`;
  return null;
}

export interface StkResult { ok: boolean; demo: boolean; message: string; topupId?: string }

/**
 * Demo mode simulates a prompt and moves no money. Live mode starts an STK
 * request through the authenticated Supabase Edge Function. This call never
 * credits the wallet; only the verified Daraja callback can do that.
 */
export async function requestStkPush(phone: string, amount: number): Promise<StkResult> {
  if (!Number.isSafeInteger(amount) || amount < 10 || amount > 150000) return { ok: false, demo: !APP_MODE.realPayments, message: "Enter a whole amount from KES 10 to KES 150,000." };
  const normalised = normaliseKenyanPhone(phone);
  if (!normalised) return { ok: false, demo: !APP_MODE.realPayments, message: "Enter a valid Kenyan M-Pesa mobile number." };
  if (!APP_MODE.realPayments) {
    await new Promise(resolve => setTimeout(resolve, 2200));
    return { ok: true, demo: true, message: "Demo top-up confirmed. No real money moved." };
  }
  if (!supabase) return { ok: false, demo: false, message: "Payments are not configured." };
  const { data, error } = await supabase.functions.invoke("mpesa-stk-push", { body: { phone: normalised, amount } });
  if (error) {
    const message = typeof (error as any).context?.json?.error === "string" ? (error as any).context.json.error : "Could not start the M-Pesa prompt. Try again.";
    return { ok: false, demo: false, message };
  }
  if (typeof data?.topup_id !== "string") return { ok: false, demo: false, message: "The payment service returned an invalid request status." };
  return { ok: true, demo: false, message: data.message || "Check your phone and enter your M-Pesa PIN to approve.", topupId: data.topup_id };
}
