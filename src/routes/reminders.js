const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("reminders").select("*").eq("academy_id", req.academyId).order("sent_at", { ascending: false });
    if (error) throw error;
    res.json({ reminders: data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
