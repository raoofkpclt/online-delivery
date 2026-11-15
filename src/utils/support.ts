/** Your store's contact details. Replace the placeholders. Used by the Orders page and the Footer. */
export const SUPPORT = {
  phone: "+91 8075888900", // shown to customers and used for call links
  whatsapp: "918075888900", // digits only, with country code
  email: "support@example.com",
} as const;

export const telHref = () => `tel:${SUPPORT.phone.replace(/[^\d+]/g, "")}`;

export const whatsappUrl = (message: string) =>
  `https://wa.me/${SUPPORT.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

export const mailtoHref = (subject: string, body: string) =>
  `mailto:${SUPPORT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
