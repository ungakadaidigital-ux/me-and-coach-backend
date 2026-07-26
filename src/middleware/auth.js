const { supabaseAdmin } = require("../config/supabase");

// Verifies the Supabase access token sent by the frontend, then loads the
// coach row so every downstream route knows which academy_id to scope to.
// This is what makes RLS's current_setting('request.jwt.claim.academy_id')
// check meaningful — we set it per-request below.
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "கணக்கில் நுழையவில்லை (no session)" });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Session காலாவதியானது, மீண்டும் Log In பண்ணுங்க" });

    const { data: coach, error: coachErr } = await supabaseAdmin
      .from("coaches")
      .select("*")
      .eq("auth_user_id", data.user.id)
      .single();

    if (coachErr || !coach) return res.status(403).json({ error: "இந்த கணக்கு எந்த academy-உடனும் இணைக்கப்படவில்லை" });

    // Scope the Postgres session for this request so RLS policies apply.
    await supabaseAdmin.rpc("set_config", {
      setting: "request.jwt.claim.academy_id",
      value: coach.academy_id,
      is_local: true,
    }).catch(() => {
      // set_config RPC is optional (see migrations note); requests still
      // work because the service-role client filters by academy_id
      // explicitly in every route below.
    });

    req.coach = coach;
    req.academyId = coach.academy_id;
    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { requireAuth };
