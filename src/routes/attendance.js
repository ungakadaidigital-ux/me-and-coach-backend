const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("attendance").select("*").eq("academy_id", req.academyId);
    if (req.query.batch_id) query = query.eq("batch_id", req.query.batch_id);
    if (req.query.date) query = query.eq("session_date", req.query.date);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ attendance: data });
  } catch (e) {
    next(e);
  }
});

// POST /api/attendance/bulk
// Coach App queues attendance offline (client-generated UUID per row) and
// flushes the queue here once the phone is back online. Upsert on the
// unique (batch_id, student_id, session_date) constraint makes retries safe.
router.post("/bulk", async (req, res, next) => {
  try {
    const rows = req.body.records;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "records array தேவை" });
    }
    const payload = rows.map((r) => ({
      id: r.id,
      academy_id: req.academyId,
      batch_id: r.batch_id,
      student_id: r.student_id,
      session_date: r.session_date,
      status: r.status,
      marked_by: req.coach.id,
      device_marked_at: r.device_marked_at,
    }));

    const { data, error } = await supabaseAdmin
      .from("attendance")
      .upsert(payload, { onConflict: "batch_id,student_id,session_date" })
      .select();
    if (error) throw error;
    res.status(201).json({ synced: data.length, records: data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
