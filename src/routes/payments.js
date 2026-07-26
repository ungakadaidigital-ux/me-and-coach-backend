const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const { sendWhatsAppTemplate } = require("../utils/whatsapp");
const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    let query = supabaseAdmin.from("payments").select("*, students(name, parent_phone, vertical)").eq("academy_id", req.academyId);
    if (req.query.status) query = query.eq("status", req.query.status);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ payments: data });
  } catch (e) {
    next(e);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { student_id, amount, due_date } = req.body;
    if (!student_id || !amount || !due_date) return res.status(400).json({ error: "student_id, amount, due_date தேவை" });
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({ academy_id: req.academyId, student_id, amount, due_date })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({ payment: data });
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const updates = { ...req.body, is_edited: true, edited_at: new Date().toISOString(), edited_by: req.coach.id };
    delete updates.id;
    delete updates.academy_id;
    const { data, error } = await supabaseAdmin
      .from("payments").update(updates).eq("academy_id", req.academyId).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ payment: data });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/mark-paid", async (req, res, next) => {
  try {
    const { method } = req.body;
    const { data, error } = await supabaseAdmin
      .from("payments")
      .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10), method: method || "cash" })
      .eq("academy_id", req.academyId).eq("id", req.params.id).select().single();
    if (error) throw error;
    res.json({ payment: data });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/send-reminder", async (req, res, next) => {
  try {
    const { data: payment, error } = await supabaseAdmin
      .from("payments").select("*, students(name, parent_name, parent_phone)")
      .eq("academy_id", req.academyId).eq("id", req.params.id).single();
    if (error) throw error;

    const result = await sendWhatsAppTemplate({
      template: "payment_due",
      to: payment.students.parent_phone,
      params: { parent_name: payment.students.parent_name || "பெற்றோர்", student_name: payment.students.name, amount: payment.amount },
    });

    const { data: reminder } = await supabaseAdmin
      .from("reminders")
      .insert({
        academy_id: req.academyId,
        student_id: payment.student_id,
        payment_id: payment.id,
        template: "payment_due",
        wati_message_id: result.messageId,
        status: result.ok ? "sent" : "failed",
      })
      .select()
      .single();

    res.status(201).json({ reminder });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
