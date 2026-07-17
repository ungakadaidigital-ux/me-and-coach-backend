const WATI_ENDPOINT = process.env.WATI_API_ENDPOINT;
const WATI_API_KEY = process.env.WATI_API_KEY;

/**
 * Sends a pre-approved WhatsApp template via Wati.
 * template: 'payment_due' | 'payment_overdue' | 'absent_alert'
 * Map these to your actual Wati-approved template names below —
 * placeholder names shown match the spec doc's template text.
 */
const TEMPLATE_NAME_MAP = {
  payment_due: "payment_due",
  payment_overdue: "payment_overdue_escalation",
  absent_alert: "absent_alert",
};

export async function sendWhatsAppTemplate({ template, phone, params }) {
  const watiTemplateName = TEMPLATE_NAME_MAP[template];
  if (!watiTemplateName) throw new Error(`Unknown template: ${template}`);

  try {
    const res = await fetch(
      `${WATI_ENDPOINT}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(phone)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WATI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_name: watiTemplateName,
          broadcast_name: `${watiTemplateName}_${Date.now()}`,
          parameters: Object.entries(params).map(([name, value]) => ({ name, value: String(value) })),
        }),
      }
    );
    const json = await res.json();
    return { ok: res.ok, messageId: json?.id || null, raw: json };
  } catch (err) {
    return { ok: false, messageId: null, error: err.message };
  }
}

