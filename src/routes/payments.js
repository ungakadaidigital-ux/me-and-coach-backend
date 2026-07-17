import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendWhatsAppTemplate } from "../lib/wati.js";

const router = Router();
router.use(requireAuth);

// GET /api/payments?status=due
router.get("/", async (req, res) => {
  let query = req.supabase
    .from("payments")
    .select("*, students(name, parent_name, parent_phone)")
    .eq("academy_id", req.academyId);
  if (req.query.status) query = query.eq("status", req.query.status);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/payments/:id/mark-paid — Assistant recording cash/UPI manually
router.post("/:id/mark-paid", async (req, res) => {
  const { method } = req.body; // 'cash' | 'upi'
  const { data, error } = await req.supabase
    .from("payments")
    .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10), method })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// POST /api/payments/:id/send-reminder — manual override, any time (frozen workflow)
router.post("/:id/send-reminder", async (req, res) => {
  const { data: payment, error } = await req.supabase
    .from("payments")
    .select("*, students(name, parent_name, parent_phone)")
    .eq("id", req.params.id)
    .single();
  if (error || !payment) return res.status(404).json({ error: "Payment not found" });

  const template = payment.status === "overdue" ? "payment_overdue" : "payment_due";
  const result = await sendWhatsAppTemplate({
    template,
    phone: payment.students.parent_phone,
    params: {
      parent_name: payment.students.parent_name || "",
      student_name: payment.students.name,
      amount: payment.amount,
      payment_link: payment.razorpay_link || "",
    },
  });

  await req.supabase.from("reminders").insert({
    academy_id: req.academyId,
    student_id: payment.student_id,
    payment_id: payment.id,
    template,
    wati_message_id: result.messageId,
    status: result.ok ? "sent" : "failed",
  });

  res.json({ sent: result.ok });
});

export default router;

