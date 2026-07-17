import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();
router.use(requireAuth);

// GET /api/students?vertical=&batch_id=
router.get("/", async (req, res) => {
  let query = req.supabase.from("students").select("*").eq("academy_id", req.academyId);
  if (req.query.vertical) query = query.eq("vertical", req.query.vertical);
  if (req.query.batch_id) query = query.eq("batch_id", req.query.batch_id);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/students — RLS blocks this for role=coach automatically
router.post("/", async (req, res) => {
  const { data, error } = await req.supabase
    .from("students")
    .insert({ ...req.body, academy_id: req.academyId })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

router.get("/:id", async (req, res) => {
  const { data, error } = await req.supabase
    .from("students")
    .select("*, fee_plans(*)")
    .eq("id", req.params.id)
    .single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

router.patch("/:id", async (req, res) => {
  const { data, error } = await req.supabase
    .from("students")
    .update(req.body)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;

