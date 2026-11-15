import type { Order } from "./types";
import { gramsLabel, ratePerKgOf } from "./weight";

/** ← EDIT these to your real shop details. They appear on every receipt. */
export const BUSINESS = {
  name: "Rahath",
  tagline: "Groceries & Vegetables",
  address: ["Shop address line 1", "City, Kerala - 000000"],
  phone: "+91 80758 88900",
  gstin: "", // optional, e.g. "32ABCDE1234F1Z5". Leave empty to hide.
};

export const receiptDate = (o: Order) =>
  o.createdAt
    ? o.createdAt.toDate().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "-";

export const num = (n: number) =>
  n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ───────── PDF (80 mm thermal-style bill) ───────── */

const W = 42; // characters per line (monospace)
const dash = "-".repeat(W);
const eq = "=".repeat(W);

// The built-in PDF font only has basic English characters.
const clean = (s: string) =>
  s
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const row = (l: string, r: string) =>
  l + " ".repeat(Math.max(1, W - l.length - r.length)) + r;

function wrap(text: string, width = W): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (word.length > width) {
      if (line) (out.push(line), (line = ""));
      for (let i = 0; i < word.length; i += width)
        out.push(word.slice(i, i + width));
      continue;
    }
    if (!line) line = word;
    else if ((line + " " + word).length <= width) line += " " + word;
    else (out.push(line), (line = word));
  }
  if (line) out.push(line);
  return out;
}

type Ln = { t: string; center?: boolean; bold?: boolean };

function buildLines(o: Order): Ln[] {
  const L: Ln[] = [];
  const add = (t: string, opts: Omit<Ln, "t"> = {}) => L.push({ t, ...opts });

  add(clean(BUSINESS.name).toUpperCase(), { center: true, bold: true });
  if (BUSINESS.tagline) add(clean(BUSINESS.tagline), { center: true });
  BUSINESS.address.forEach((a) =>
    wrap(clean(a)).forEach((t) => add(t, { center: true })),
  );
  add(`Ph: ${BUSINESS.phone}`, { center: true });
  if (BUSINESS.gstin) add(`GSTIN: ${BUSINESS.gstin}`, { center: true });
  add(dash);
  add("BILL RECEIPT", { center: true, bold: true });
  add(dash);

  add(row("Order No:", clean(o.orderNo)));
  add(row("Date:", clean(receiptDate(o))));
  wrap(`Customer: ${clean(o.customerName)}`).forEach((t) => add(t));
  add(`Phone: ${clean(o.phone)}`);
  wrap(`Address: ${clean(o.address)}`).forEach((t) => add(t));
  add(dash);

  add(row("Item (Weight/Qty x Rate)", "Amount (Rs)"), { bold: true });
  add(dash);
  o.items.forEach((i) => {
    wrap(clean(i.name) || "Item").forEach((t) => add(t));
    if (i.grams) {
      // sold by weight: show how much was bought and the per-kg rate
      add(
        row(
          `  ${clean(gramsLabel(i.grams))} x ${num(ratePerKgOf(i))}/kg`,
          num(i.price * i.quantity),
        ),
      );
    } else {
      add(row(`  ${i.quantity} x ${num(i.price)}`, num(i.price * i.quantity)));
    }
  });
  add(dash);

  add(row("Subtotal", num(o.subtotal)));
  if (o.discountAmount > 0)
    add(
      row(
        `Discount${o.couponCode ? ` (${clean(o.couponCode)})` : ""}`,
        "-" + num(o.discountAmount),
      ),
    );
  add(row("Delivery", o.deliveryFee > 0 ? num(o.deliveryFee) : "Free"));
  add(eq);
  add(row("TOTAL (Rs)", num(o.total)), { bold: true });
  add(eq);

  add("Payment: Cash on delivery");
  add("Status: Delivered");
  add("");
  add("Thank you for shopping with us!", { center: true, bold: true });
  add("Please visit again", { center: true });
  return L;
}

export const receiptFileName = (o: Order) =>
  `Receipt-${clean(o.orderNo) || o.id}.pdf`;

/** Builds the receipt PDF in memory. Nothing is saved or downloaded. */
export async function buildReceiptPdf(order: Order): Promise<Blob> {
  const { jsPDF } = await import("jspdf"); // loaded only when needed
  const lines = buildLines(order);
  const lh = 3.6;
  const height = 10 + lines.length * lh + 8;

  const doc = new jsPDF({ unit: "mm", format: [80, height] });
  doc.setFontSize(8);

  let y = 8;
  lines.forEach((ln) => {
    doc.setFont("courier", ln.bold ? "bold" : "normal");
    if (ln.center) doc.text(ln.t, 40, y, { align: "center" });
    else doc.text(ln.t, 4.4, y);
    y += lh;
  });

  return doc.output("blob");
}

/** The receipt as a File, ready for navigator.share() (no download). */
export async function buildReceiptFile(order: Order): Promise<File> {
  const blob = await buildReceiptPdf(order);
  return new File([blob], receiptFileName(order), { type: "application/pdf" });
}

/** Builds the receipt and downloads it as Receipt-<orderNo>.pdf */
export async function downloadReceiptPdf(order: Order) {
  const blob = await buildReceiptPdf(order);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = receiptFileName(order);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
