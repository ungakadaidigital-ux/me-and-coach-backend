const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("batches").select("*").eq("academy_id", req.academyId).order("start_time");
    if (req.query.vertical) query = query.eq("vertical", req.query.vertical);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ batches: data });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { vertical, name, coach_id, location, days_of_week, start_time, end_time } = req.body;
    if (!vertical || !name || !days_of_week || !start_time || !end_time) {
      return res.status(400).json({ error: "vertical, name, days_of_week, start_time, end_time தேவை" });
    }
    const { data, error } = await supabaseAdmin
      .from("batches")
      .insert({ academy_id: req.academyId, vertical, name, coach_id, location, days_of_week, start_time, end_time })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ batch: data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
