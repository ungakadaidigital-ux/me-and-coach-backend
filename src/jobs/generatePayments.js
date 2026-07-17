/**
 * Run daily (Railway Cron / GitHub Actions schedule).
 * For every active fee_plan with a monthly/quarterly cycle, create
 * this cycle's `payments` row LEAD_DAYS before due_day if one
 * doesn't already exist — gives reminders lead time before the
 * due date, per the frozen fee-collection workflow.
 */
import "dotenv/config";
import { supabaseAdmin } from "../lib/supabase.js";

const LEAD_DAYS = 5;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function nextDueDate(dueDay, cycle, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), dueDay);
  if (d < from) d.setMonth(d.getMonth() + (cycle === "quarterly" ? 3 : 1));
  return d;
}

async function run() {
  const { data: plans, error } = await supabaseAdmin
    .from("fee_plans")
    .select("*")
    .eq("active", true)
    .in("cycle", ["monthly", "quarterly"]);
  if (error) throw error;

  const today = new Date();
  let created = 0;

  for (const plan of plans) {
    const due = nextDueDate(plan.due_day, plan.cycle, today);
    const generateFrom = addDays(due, -LEAD_DAYS);
    if (today < generateFrom) continue; // not yet time to generate this cycle's row

    const dueISO = due.toISOString().slice(0, 10);

    // Skip if a payment for this student+due_date already exists.
    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id")
      .eq("student_id", plan.student_id)
      .eq("due_date", dueISO)
      .maybeSingle();
    if (existing) continue;

    const { error: insertErr } = await supabaseAdmin.from("payments").insert({
      academy_id: plan.academy_id,
      student_id: plan.student_id,
      fee_plan_id: plan.id,
      amount: plan.amount,
      due_date: dueISO,
      status: "due",
    });
    if (insertErr) {
      console.error(`Failed for fee_plan ${plan.id}:`, insertErr.message);
      continue;
    }
    created++;
  }

  console.log(`generatePayments: created ${created} payment row(s)`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

