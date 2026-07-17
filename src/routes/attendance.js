import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const router = Router();
router.use(requireAuth);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/attendance/bulk
 * body: [{ id, batch_id, student_id, status, device_marked_at }, ...]
 *
 * All rows must be for today's session_date — same-day-only editing
 * is the frozen workflow rule, enforced here rather than in RLS.
 * Client-generated UUIDs + the DB unique(batch_id, student_id,
 * session_date) constraint make retried/duplicate offline syncs safe.
 *
 * Each newly-inserted "absent" row auto-fires the absent_alert
 * reminder (frozen workflow decision) via the admin client, since
 * that's a system action, not a user-scoped RLS write.
 */
router.post("/bulk", async (req, res) => {
  const rows = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "Expected a non-empty array" });
  }

  const today = todayISO();
  const prepared = rows.map((r) => ({
    id: r.id,
    academy_id: req.academyId,
    batch_id: r.batch_id,
    student_id: r.student_id,
    session_date: today,
    status: r.status,
    marked_by: req.coachId,
    device_marked_at: r.device_marked_at,
  }));

  const { data, error } = await req.supabase
    .from("attendance")
    .upsert(prepared, { onConflict: "batch_id,student_id,session_date" })
    .select();
  if (error) return res.status(400).json({ error: error.message });

  const absentRows = data.filter((r) => r.status === "absent");
  if (absentRows.length > 0) {
    // Fire-and-forget: don't block the sync response on WhatsApp delivery.
    triggerAbsentAlerts(absentRows).catch((e) =>
      console.error("absent_alert dispatch failed:", e.message)
    );
  }

  res.json({ synced: data.length, records: data });
});

async function triggerAbsentAlerts(absentRows) {
  const studentIds = absentRows.map((r) => r.student_id);
  const { data: students } = await supabaseAdmin
    .from("students")
    .select("id, name, parent_phone, parent_name, academy_id")
    .in("id", studentIds);

  const { sendWhatsAppTemplate } = await import("../lib/wati.js");

  for (const row of absentRows) {
    const student = students?.find((s) => s.id === row.student_id);
    if (!student) continue;
    const result = await sendWhatsAppTemplate({
      template: "absent_alert",
      phone: student.parent_phone,
      params: { parent_name: student.parent_name || "", student_name: student.name },
    });
    await supabaseAdmin.from("reminders").insert({
      academy_id: student.academy_id,
      student_id: student.id,
      template: "absent_alert",
      wati_message_id: result.messageId,
      status: result.ok ? "sent" : "failed",
    });
  }
}

// GET /api/attendance?batch_id=&date=
router.get("/", async (req, res) => {
  let query = req.supabase.from("attendance").select("*").eq("academy_id", req.academyId);
  if (req.query.batch_id) query = query.eq("batch_id", req.query.batch_id);
  if (req.query.date) query = query.eq("session_date", req.query.date);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;

