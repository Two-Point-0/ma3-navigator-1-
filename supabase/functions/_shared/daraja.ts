export type DarajaEnv = "sandbox" | "production";

export function darajaConfig() {
  const environment = (Deno.env.get("DARAJA_ENV") || "sandbox") as DarajaEnv;
  if (environment !== "sandbox" && environment !== "production") throw new Error("DARAJA_ENV must be sandbox or production");
  const baseUrl = environment === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke";
  const consumerKey = Deno.env.get("DARAJA_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("DARAJA_CONSUMER_SECRET");
  const shortcode = Deno.env.get("DARAJA_SHORTCODE");
  const passkey = Deno.env.get("DARAJA_PASSKEY");
  const callbackUrl = Deno.env.get("DARAJA_CALLBACK_URL");
  const transactionType = Deno.env.get("DARAJA_TRANSACTION_TYPE") || "CustomerPayBillOnline";
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) throw new Error("Daraja is not configured");
  if (!/^https:\/\//i.test(callbackUrl)) throw new Error("DARAJA_CALLBACK_URL must use HTTPS");
  if (!/^\d{5,7}$/.test(shortcode)) throw new Error("DARAJA_SHORTCODE must be a configured PayBill or Till number");
  if (!new Set(["CustomerPayBillOnline", "CustomerBuyGoodsOnline"]).has(transactionType)) throw new Error("Unsupported DARAJA_TRANSACTION_TYPE");
  return { environment, baseUrl, consumerKey, consumerSecret, shortcode, passkey, callbackUrl, transactionType };
}

function stampNairobi() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}${value.month}${value.day}${value.hour}${value.minute}${value.second}`;
}

function base64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function accessToken(config: ReturnType<typeof darajaConfig>) {
  const credentials = btoa(`${config.consumerKey}:${config.consumerSecret}`);
  const response = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}`, Accept: "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.access_token !== "string") throw new Error(`Daraja authentication failed (${response.status})`);
  return body.access_token as string;
}

export interface StkPushResponse {
  ResponseCode?: string; ResponseDescription?: string; MerchantRequestID?: string;
  CheckoutRequestID?: string; CustomerMessage?: string;
}

export async function sendStkPush(input: { phone: string; amount: number; accountReference: string; description: string }): Promise<StkPushResponse> {
  const config = darajaConfig();
  const token = await accessToken(config);
  const timestamp = stampNairobi();
  const password = base64Utf8(`${config.shortcode}${config.passkey}${timestamp}`);
  const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: config.transactionType,
      Amount: input.amount,
      PartyA: input.phone,
      PartyB: config.shortcode,
      PhoneNumber: input.phone,
      CallBackURL: config.callbackUrl,
      AccountReference: input.accountReference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Daraja STK request failed (${response.status})`);
  return body as StkPushResponse;
}

export interface StkQueryResponse {
  ResponseCode?: string; ResponseDescription?: string; MerchantRequestID?: string;
  CheckoutRequestID?: string; ResultCode?: string | number; ResultDesc?: string;
}

export async function queryStk(checkoutRequestId: string): Promise<StkQueryResponse> {
  const config = darajaConfig();
  const token = await accessToken(config);
  const timestamp = stampNairobi();
  const password = base64Utf8(`${config.shortcode}${config.passkey}${timestamp}`);
  const response = await fetch(`${config.baseUrl}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ BusinessShortCode: config.shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Daraja transaction query failed (${response.status})`);
  return body as StkQueryResponse;
}

export function callbackCors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const configured = Deno.env.get("APP_ORIGIN") || "";
  const allowed = !origin || origin === configured || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    allowed,
    headers: {
      "Access-Control-Allow-Origin": origin && origin === configured ? origin : "http://localhost:3000",
      "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  };
}
