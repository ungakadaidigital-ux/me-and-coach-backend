// Thin wrapper around Wati's API. If WATI_API_KEY isn't set (local dev,
// or before the Wati account is provisioned), calls are simulated and
// logged instead of failing the request.
const TEMPLATES = {
  payment_due:
    "வணக்கம் {{parent_name}} 🙏\n{{student_name}}-க்கு ₹{{amount}} கட்டணம் நிலுவையில் உள்ளது. இப்போதே கட்டுங்கள்: {{payment_link}}",
  absent_alert:
    "வணக்கம் {{parent_name}},\nஇன்று {{student_name}} வகுப்புக்கு வரவில்லை. காரணம் தெரிந்தால் reply பண்ணுங்கள்.",
};

function fillTemplate(str, params) {
  return str.replace(/{{(.*?)}}/g, (_, key) => params[key.trim()] ?? "");
}

async function sendWhatsAppTemplate({ template, to, params }) {
  const text = fillTemplate(TEMPLATES[template] || "", params);

  if (!process.env.WATI_API_KEY) {
    console.log(`[whatsapp:simulated] to=${to}\n${text}`);
    return { ok: true, messageId: `simulated-${Date.now()}` };
  }

  const resp = await fetch(`${process.env.WATI_API_ENDPOINT}/api/v1/sendTemplateMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WATI_API_KEY}` },
    body: JSON.stringify({ whatsappNumber: to, template_name: template, parameters: params }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, messageId: data.id };
}

module.exports = { sendWhatsAppTemplate };
