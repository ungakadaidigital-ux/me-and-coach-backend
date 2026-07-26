const express = require("express");
const { supabaseAdmin, phoneToPseudoEmail } = require("../config/supabase");
const router = express.Router();

function requireAdminSecret(req, res, next) {
  if (req.headers["x-admin-secret"] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Admin secret தேவை" });
  }
  next();
}

// POST /api/auth/login  { phone, password }
// This is the ONLY entry point the app's Login screen calls.
// No email, no OTP, no magic link (Design & Product Principles #1).
router.post("/login", async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: "Phone number மற்றும் password கொடுங்கள்" });

    const email = phoneToPseudoEmail(phone);
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: "Phone number அல்லது password தவறு" });

    res.json({ session: data.session, user: data.user });
  } catch (e) {
    next(e);
  }
});

// --------------------------------------------------------------------
// MANUAL ACCOUNT CREATION PHASE (Design & Product Principles #1)
// There is no public "Sign Up" flow wired into the app yet. Until the
// business is at a scale that needs self-registration, support/admin
// creates each coach's account directly — either from the Supabase
// dashboard, or by calling this admin-secret-protected endpoint, which
// does the same thing (create auth user + coaches row) in one step.
// --------------------------------------------------------------------
router.post("/admin/create-account", requireAdminSecret, async (req, res, next) => {
  try {
    const { phone, password, name, academy_id, role, verticals } = req.body;
    if (!phone || !password || !name || !academy_id) {
      return res.status(400).json({ error: "phone, password, name, academy_id தேவை" });
    }
    const email = phoneToPseudoEmail(phone);

    const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr) return res.status(400).json({ error: authErr.message });

    const { data: coach, error: coachErr } = await supabaseAdmin
      .from("coaches")
      .insert({
        auth_user_id: authUser.user.id,
        academy_id,
        name,
        phone,
        role: role || "coach",
        verticals: verticals || [],
      })
      .select()
      .single();

    if (coachErr) return res.status(400).json({ error: coachErr.message });
    res.status(201).json({ coach });
  } catch (e) {
    next(e);
  }
});

// Password reset — no email link. A support agent authenticates with the
// admin secret and sets a new password directly, exactly like resetting
// it from the Supabase dashboard (Design & Product Principles #1).
router.post("/admin/reset-password", requireAdminSecret, async (req, res, next) => {
  try {
    const { phone, new_password } = req.body;
    if (!phone || !new_password) return res.status(400).json({ error: "phone, new_password தேவை" });

    const { data: coach } = await supabaseAdmin.from("coaches").select("auth_user_id").eq("phone", phone).single();
    if (!coach) return res.status(404).json({ error: "இந்த phone number-க்கு கணக்கு இல்லை" });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(coach.auth_user_id, { password: new_password });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
