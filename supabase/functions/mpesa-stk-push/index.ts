import { createClient } from "npm:@supabase/supabase-js@2";
import { callbackCors, sendStkPush } from "../_shared/daraja.ts";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

function envKey(name: string, mapName: string) {
  const direct = Deno.env.get(name);
  if (direct) return direct;
  try { return JSON.parse(Deno.env.get(mapName) || "{}").default || ""; } catch { return ""; }
}

Deno.serve(async req => {
  const cors = callbackCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors.headers });
  if (!cors.allowed) return json({ error: "Origin not allowed" }, 403, cors.headers);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors.headers);

  const url = Deno.env.get("SUPABASE_URL");
  const publicKey = envKey("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS");
  const secretKey = envKey("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS");
  const authorization = req.headers.get("Authorization") || "";
  const jwt = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !publicKey || !secretKey) return json({ error: "Payment service is not configured" }, 503, cors.headers);
  if (!jwt) return json({ error: "Sign in before starting a wallet top-up" }, 401, cors.headers);

  const authClient = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
  const user = authData.user;
  if (authError || !user) return json({ error: "Valid sign-in required" }, 401, cors.headers);

  let input: { amount?: unknown; phone?: unknown };
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400, cors.headers); }
  const amount = Number(input.amount);
  const digits = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : "";
  const phone = /^0[17]\d{8}$/.test(digits) ? `254${digits.slice(1)}` : /^254[17]\d{8}$/.test(digits) ? digits : "";
  if (!Number.isSafeInteger(amount) || amount < 10 || amount > 150000) return json({ error: "Enter a whole amount between KES 10 and KES 150,000" }, 400, cors.headers);
  if (!phone) return json({ error: "Enter a valid Kenyan M-Pesa mobile number" }, 400, cors.headers);

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const recentCutoff = new Date(Date.now() - 30_000).toISOString();
  const { data: recent } = await admin.from("wallet_topups").select("id")
    .eq("user_id", user.id).eq("status", "pending").gte("requested_at", recentCutoff).limit(1);
  if (recent?.length) return json({ error: "A top-up prompt is already pending. Check your phone or wait before trying again." }, 429, cors.headers);

  const id = crypto.randomUUID();
  const accountReference = id.replaceAll("-", "").slice(0, 12).toUpperCase();
  const { error: insertError } = await admin.from("wallet_topups").insert({
    id, user_id: user.id, amount_kes: amount, phone_number: phone,
    account_reference: accountReference, status: "pending",
  });
  if (insertError) return json({ error: "Could not create the top-up request" }, 500, cors.headers);

  try {
    const response = await sendStkPush({ phone, amount, accountReference, description: "Ma3 wallet topup" });
    if (response.ResponseCode !== "0" || !response.CheckoutRequestID || !response.MerchantRequestID) {
      await admin.from("wallet_topups").update({ status: "failed", result_description: "Daraja did not accept the STK request", updated_at: new Date().toISOString() }).eq("id", id);
      return json({ error: "Safaricom could not start the M-Pesa prompt. Check the number and try again." }, 502, cors.headers);
    }
    const { error: updateError } = await admin.from("wallet_topups").update({
      checkout_request_id: response.CheckoutRequestID,
      merchant_request_id: response.MerchantRequestID,
      result_description: response.ResponseDescription?.slice(0, 250) ?? null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    if (updateError) {
      console.error("Could not save Daraja checkout identifiers", updateError.message);
      return json({ error: "Safaricom accepted the prompt but status tracking is delayed. Do not retry yet; contact support if the prompt arrives." }, 503, cors.headers);
    }
    return json({ topup_id: id, status: "pending", message: response.CustomerMessage || "Check your phone and enter your M-Pesa PIN to approve." }, 202, cors.headers);
  } catch (error) {
    console.error("M-Pesa initiation failed", error instanceof Error ? error.message : "unknown error");
    await admin.from("wallet_topups").update({ status: "failed", result_description: "Unable to start payment request", updated_at: new Date().toISOString() }).eq("id", id);
    return json({ error: "Could not start the M-Pesa prompt. Try again later." }, 502, cors.headers);
  }
});
