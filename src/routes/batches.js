import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// GET /api/batches?vertical=  — RLS returns all for owner/assistant,
// but a coach only sees batches assigned to them via coach_id.
router.get("/", async (req, res) => {
  let query = req.supabase.from("batches").select("*").eq("academy_id", req.academyId);
  if (req.query.vertical) query = query.eq("vertical", req.query.vertical);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/batches — owner-only, enforced by RLS (batches_write_owner)
router.post("/", async (req, res) => {
  const { data, error } = await req.supabase
    .from("batches")
    .insert({ ...req.body, academy_id: req.academyId })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

export default router;

