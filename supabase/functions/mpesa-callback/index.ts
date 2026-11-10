import { createClient } from "npm:@supabase/supabase-js@2";
import { queryStk } from "../_shared/daraja.ts";

const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function envKey(name: string, mapName: string) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  try { return JSON.parse(Deno.env.get(mapName) || "{}").default || ""; } catch { return ""; }
}
function metadataItems(value: unknown) {
  if (!value || typeof value !== "object") return {} as Record<string, unknown>;
  const items = (value as { Item?: unknown[] }).Item;
  return Object.fromEntries((Array.isArray(items) ? items : []).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const record = item as { Name?: unknown; Value?: unknown };
    return typeof record.Name === "string" ? [[record.Name, record.Value]] : [];
  }));
}

Deno.serve(async req => {
  if (req.method !== "POST") return reply({ ResultCode: 1, ResultDesc: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = envKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
  if (!url || !secretKey) return reply({ ResultCode: 1, ResultDesc: "Callback service unavailable" }, 503);

  let body: any;
  try { body = await req.json(); } catch { return reply({ ResultCode: 1, ResultDesc: "Invalid callback body" }, 400); }
  const callback = body?.Body?.stkCallback;
  const checkoutId = callback?.CheckoutRequestID;
  if (typeof checkoutId !== "string" || checkoutId.length > 160) return reply({ ResultCode: 1, ResultDesc: "Missing checkout request id" }, 400);

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: topup, error } = await admin.from("wallet_topups")
    .select("id,status,amount_kes,phone_number,checkout_request_id")
    .eq("checkout_request_id", checkoutId).maybeSingle();
  if (error) { console.error("Top-up lookup failed", error.message); return reply({ ResultCode: 1, ResultDesc: "Temporary processing error" }, 503); }
  if (!topup) return reply({ ResultCode: 1, ResultDesc: "Unknown checkout request" }, 404);
  if (topup.status === "succeeded") return reply({ ResultCode: 0, ResultDesc: "Already processed" });
  if (topup.status !== "pending") return reply({ ResultCode: 0, ResultDesc: "Request already closed" });

  try {
    // Safaricom's callback is a notification, not a signed payment proof.
    // Verify the CheckoutRequestID against Daraja before changing the ledger.
    let query: Awaited<ReturnType<typeof queryStk>> | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      query = await queryStk(checkoutId);
      if (query.ResultCode !== undefined && query.ResultCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
    if (!query || query.ResultCode === undefined || query.ResultCode === null) {
      return reply({ ResultCode: 1, ResultDesc: "Transaction verification pending" }, 503);
    }
    const queryCode = String(query.ResultCode);
    if (queryCode !== "0") {
      const description = String(query.ResultDesc || "M-Pesa transaction was not completed").slice(0, 250);
      await admin.from("wallet_topups").update({ status: "failed", result_code: queryCode, result_description: description, updated_at: new Date().toISOString() }).eq("id", topup.id).eq("status", "pending");
      return reply({ ResultCode: 0, ResultDesc: "Transaction not successful" });
    }

    const metadata = metadataItems(callback.CallbackMetadata);
    const callbackAmount = Number(metadata.Amount);
    const callbackPhone = String(metadata.PhoneNumber ?? "");
    const receipt = String(metadata.MpesaReceiptNumber ?? "");
    if (String(callback.ResultCode) !== "0" || !Number.isSafeInteger(callbackAmount) || callbackAmount !== topup.amount_kes || callbackPhone !== topup.phone_number || !/^[A-Z0-9]{8,16}$/.test(receipt)) {
      console.error("Verified checkout callback did not match stored amount/phone/receipt fields", { checkoutId });
      return reply({ ResultCode: 1, ResultDesc: "Payment details require review" }, 400);
    }

    const { data: credited, error: settleError } = await admin.rpc("settle_mpesa_wallet_topup", {
      p_checkout_request_id: checkoutId,
      p_amount_kes: callbackAmount,
      p_phone_number: callbackPhone,
      p_mpesa_receipt: receipt,
      p_result_code: "0",
    });
    if (settleError) { console.error("Wallet settlement failed", settleError.message); return reply({ ResultCode: 1, ResultDesc: "Settlement will be retried" }, 503); }
    return reply({ ResultCode: 0, ResultDesc: credited ? "Payment verified and wallet credited" : "Already processed" });
  } catch (error) {
    console.error("Daraja callback verification failed", error instanceof Error ? error.message : "unknown error");
    return reply({ ResultCode: 1, ResultDesc: "Transaction verification is temporarily unavailable" }, 503);
  }
});
