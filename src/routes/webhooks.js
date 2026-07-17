import { Router } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabase.js";

const router = Router();

// POST /api/webhooks/razorpay
// Verify signature per Razorpay docs before trusting the payload.
router.post("/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");
  if (signature !== expected) return res.status(400).json({ error: "Invalid signature" });

  const event = req.body;
  if (event.event === "payment_link.paid") {
    const paymentLinkId = event.payload.payment_link.entity.id;
    const { error } = await supabaseAdmin
      .from("payments")
      .update({ status: "paid", paid_date: new Date().toISOString().slice(0, 10), method: "razorpay" })
      .eq("razorpay_link", paymentLinkId);
    if (error) console.error("Failed to mark payment paid:", error.message);
  }

  res.status(200).json({ received: true });
});

// POST /api/webhooks/wati — delivery/read status callback
router.post("/wati", async (req, res) => {
  const { id: watiMessageId, eventType } = req.body; // adjust to actual Wati payload shape
  const statusMap = { sent: "sent", delivered: "delivered", read: "read", failed: "failed" };
  const status = statusMap[eventType];
  if (watiMessageId && status) {
    await supabaseAdmin.from("reminders").update({ status }).eq("wati_message_id", watiMessageId);
  }
  res.status(200).json({ received: true });
});

export default router;

