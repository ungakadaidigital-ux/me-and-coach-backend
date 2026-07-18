const BASE_URL = "https://control.msg91.com/api/v5/otp";

function requireEnv() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  if (!authKey || !templateId) {
    throw new Error("MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID must be set");
  }
  return { authKey, templateId };
}

/**
 * Normalizes to MSG91's expected format: country code + number,
 * no '+', no spaces. Defaults to India (91) if no country code given —
 * adjust defaultCountryCode per product/market if this is reused
 * outside India.
 */
export function normalizePhone(phone, defaultCountryCode = "91") {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `${defaultCountryCode}${digits}`;
  return digits; // already has a country code
}

/** MSG91 generates AND sends the OTP — we never see or store the code itself. */
export async function sendOtp(phone) {
  const { authKey, templateId } = requireEnv();
  const mobile = normalizePhone(phone);
  const res = await fetch(
    `${BASE_URL}?template_id=${templateId}&mobile=${mobile}&otp_length=6&otp_expiry=10`,
    { method: "POST", headers: { authkey: authKey, "Content-Type": "application/json" } }
  );
  const json = await res.json();
  if (json.type !== "success") {
    throw new Error(json.message || "MSG91 send-OTP failed");
  }
  return { requestId: json.request_id };
}

/** MSG91 validates the code against what it generated for this phone. */
export async function verifyOtp(phone, otp) {
  const { authKey } = requireEnv();
  const mobile = normalizePhone(phone);
  const res = await fetch(`${BASE_URL}/verify?mobile=${mobile}&otp=${otp}`, {
    method: "GET",
    headers: { authkey: authKey },
  });
  const json = await res.json();
  // MSG91 returns type:'success' on a valid OTP, type:'error' otherwise
  // (expired, wrong code, too many attempts, etc.) — message has detail.
  return { ok: json.type === "success", message: json.message };
}

export async function resendOtp(phone, retryType = "text") {
  const { authKey } = requireEnv();
  const mobile = normalizePhone(phone);
  const res = await fetch(`${BASE_URL}/retry?mobile=${mobile}&retrytype=${retryType}`, {
    method: "GET",
    headers: { authkey: authKey },
  });
  const json = await res.json();
  if (json.type !== "success") throw new Error(json.message || "MSG91 resend-OTP failed");
  return { ok: true };
}
