const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const router = express.Router();

// GET /api/academies/me — academy profile + its vertical field configs
router.get("/me", async (req, res, next) => {
  try {
    const { data: academy, error } = await supabaseAdmin
      .from("academies").select("*").eq("id", req.academyId).single();
    if (error) throw error;

    const { data: configs } = await supabaseAdmin
      .from("vertical_configs").select("*").eq("academy_id", req.academyId).order("sort_order");

    res.json({ academy, vertical_configs: configs || [] });
  } catch (e) {
    next(e);
  }
});

// POST /api/academies/vertical-configs — define/replace a custom field
router.post("/vertical-configs", async (req, res, next) => {
  try {
    const { vertical, field_key, field_label_ta, field_label_en, field_type, options, sort_order } = req.body;
    const { data, error } = await supabaseAdmin
      .from("vertical_configs")
      .upsert(
        { academy_id: req.academyId, vertical, field_key, field_label_ta, field_label_en, field_type, options, sort_order },
        { onConflict: "academy_id,vertical,field_key" }
      )
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ config: data });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
