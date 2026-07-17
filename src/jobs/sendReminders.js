/**
 * Run daily (Railway Cron), after generatePayments.js.
 * Frozen workflow rules:
 *  - payment_due sent once, on the due date itself
 *  - after a 3-day grace period past due, mark overdue and send
 *    ONE escalation (escalation_level caps at 1 — no repeat spam)
 */
import "dotenv/config";
import { supabaseAdmin } from "../lib/supabase.js";
import { sendWhatsAppTemplate } from "../lib/wati.js";

const GRACE_DAYS = 3;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function sendAndLog({ payment, template }) {
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
  await supabaseAdmin.from("reminders").insert({
    academy_id: payment.academy_id,
    student_id: payment.student_id,
    payment_id: payment.id,
    template,
    wati_message_id: result.messageId,
    status: result.ok ? "sent" : "failed",
  });
  return result.ok;
}

async function run() {
  const today = todayISO();

  // 1. Due today, no reminder sent yet for this cycle.
  const { data: dueToday } = await supabaseAdmin
    .from("payments")
    .select("*, students(name, parent_name, parent_phone)")
    .eq("status", "due")
    .eq("due_date", today);

  for (const payment of dueToday || []) {
    await sendAndLog({ payment, template: "payment_due" });
  }

  // 2. Past due_date + GRACE_DAYS, still 'due' -> flip to overdue,
  //    send the single capped escalation.
  const graceThreshold = daysAgoISO(GRACE_DAYS);
  const { data: overdueCandidates } = await supabaseAdmin
    .from("payments")
    .select("*, students(name, parent_name, parent_phone)")
    .eq("status", "due")
    .lte("due_date", graceThreshold)
    .lt("escalation_level", 1);

  for (const payment of overdueCandidates || []) {
    const sent = await sendAndLog({ payment, template: "payment_overdue" });
    await supabaseAdmin
      .from("payments")
      .update({ status: "overdue", escalation_level: 1 })
      .eq("id", payment.id);
    if (!sent) console.error(`Escalation send failed for payment ${payment.id}`);
  }

  console.log(
    `sendReminders: ${dueToday?.length || 0} due-today reminder(s), ${overdueCandidates?.length || 0} escalation(s)`
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

