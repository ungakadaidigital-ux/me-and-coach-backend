const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const router = express.Router();

// GET /api/students?vertical=&batch_id=&q=
router.get("/", async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("students").select("*").eq("academy_id", req.academyId).order("name");
    if (req.query.vertical) query = query.eq("vertical", req.query.vertical);
    if (req.query.batch_id) query = query.eq("batch_id", req.query.batch_id);
    if (req.query.q) query = query.ilike("name", `%${req.query.q}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ students: data });
  } catch (e) {
    next(e);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("students").select("*").eq("academy_id", req.academyId).eq("id", req.params.id).single();
    if (error) throw error;
    res.json({ student: data });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, vertical, batch_id, parent_phone, parent_name, join_date, custom_fields } = req.body;
    if (!name || !vertical || !parent_phone) {
      return res.status(400).json({ error: "name, vertical, parent_phone தேவை" });
    }
    const { data, error } = await supabaseAdmin
      .from("students")
      .insert({ academy_id: req.academyId, name, vertical, batch_id, parent_phone, parent_name, join_date, custom_fields: custom_fields || {} })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ student: data });
  } catch (e) {
    next(e);
  }
});

// PATCH — every update marks the record as edited (Principles #6).
router.patch("/:id", async (req, res, next) => {
  try {
    const updates = { ...req.body, is_edited: true, edited_at: new Date().toISOString(), edited_by: req.coach.id };
    delete updates.id;
    delete updates.academy_id;

    const { data, error } = await supabaseAdmin
      .from("students")
      .update(updates)
      .eq("academy_id", req.academyId)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ student: data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
