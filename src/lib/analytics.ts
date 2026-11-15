// Anonymous usage statistics (Google Analytics 4). Off unless BOTH are true:
//   1. VITE_GA_MEASUREMENT_ID is set in Vercel (looks like G-XXXXXXXXXX), and
//   2. the visitor pressed "Allow" on the consent card.
// No names, phone numbers or exact locations are ever sent.
const KEY = "ma3_analytics_consent";
const ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim();
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }
export const analyticsAvailable = Boolean(ID);
export const readConsent = (): "yes" | "no" | null => { try { const v = localStorage.getItem(KEY); return v === "yes" || v === "no" ? v : null; } catch { return null; } };
export function setConsent(value: "yes" | "no") { try { localStorage.setItem(KEY, value); } catch { /* private mode */ } if (value === "yes") startAnalytics(); }
let started = false;
export function startAnalytics() {
  if (started || !ID || readConsent() !== "yes") return; started = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag("js", new Date()); window.gtag("config", ID, { send_page_view: false, anonymize_ip: true });
  const script = document.createElement("script"); script.async = true; script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`; document.head.appendChild(script);
}
export function trackPage(path: string, title: string) { if (started && window.gtag) window.gtag("event", "page_view", { page_path: path, page_title: title }); }
export function trackEvent(name: string, params?: Record<string, string | number>) { if (started && window.gtag) window.gtag("event", name, params); }
