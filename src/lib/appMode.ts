export const APP_MODE = {
  demo: true,
  liveTransport: false,
  livePricing: false,
  realPayments: false,
  realDriverBroadcasts: false,
} as const;

export const PROTOTYPE_NOTICE = "Prototype only. No real transport booking, live driver broadcast, official retailer pricing or real payments are enabled.";
