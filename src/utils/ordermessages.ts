import type { Order, OrderStatus } from "./types";

const STORE = "Rahath"; // ← your shop name as customers should see it

/** Where customers open the app to rate the order and see their bill. */
const APP_URL = ""; // ← optional, e.g. "https://rahath.in". Empty = the site you are on now.

const money = (n: number) =>
  "₹" +
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** 10-digit Indian numbers get the 91 country code, as wa.me needs it. */
export function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `91${d}`;
  if (d.length === 11 && d.startsWith("0")) return `91${d.slice(1)}`;
  return d;
}

/** Opens a WhatsApp chat with the customer with the message already typed. */
export const customerWaUrl = (phone: string, text: string) =>
  `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;

/** Sent once an order is delivered: thanks, feedback and rating request, bill is in the app. */
export function deliveredMessage(o: Order) {
  const url =
    APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return [
    `Hi ${o.customerName}, your order ${o.orderNo} has been delivered. Thank you for shopping with ${STORE}`,
    "",
    "We would love to hear from you. Please give your feedback and a rating in the app.",
    "",
    "Your bill is available in the app too.",
    ...(url ? [url] : []),
  ].join("\n");
}

/** The message sent to the customer when an order reaches `o.status`. */
export function statusMessage(o: Order) {
  const hi = `Hi ${o.customerName},`;
  const ref = `order ${o.orderNo}`;
  const byStatus: Record<OrderStatus, string> = {
    Pending: `${hi} we have received your ${ref} of ${money(o.total)} (cash on delivery). We will confirm it shortly.`,
    Confirmed: `${hi} your ${ref} is confirmed. We are getting it ready.`,
    "Out for delivery": `${hi} your ${ref} is out for delivery. Please keep ${money(o.total)} ready.`,
    Delivered: deliveredMessage(o),
    Cancelled: `${hi} your ${ref} has been cancelled. Please contact us if you have any questions.`,
  };
  return byStatus[o.status];
}
