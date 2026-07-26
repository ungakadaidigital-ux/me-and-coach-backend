require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const academyRoutes = require("./routes/academies");
const studentRoutes = require("./routes/students");
const batchRoutes = require("./routes/batches");
const attendanceRoutes = require("./routes/attendance");
const paymentRoutes = require("./routes/payments");
const reminderRoutes = require("./routes/reminders");
const { requireAuth } = require("./middleware/auth");

const app = express();

// Dev process note: when FRONTEND_URL is a custom domain behind Railway's
// proxy, trust proxy MUST be set or express-rate-limit throws on the
// X-Forwarded-For header. (See Me & family dev process notes #7.)
app.set("trust proxy", 1);

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(morgan("tiny"));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Auth routes are unauthenticated (login) or admin-secret-protected
// (account creation / password reset during the manual onboarding phase).
app.use("/api/auth", authRoutes);

// Everything else requires a valid coach session.
app.use("/api/academies", requireAuth, academyRoutes);
app.use("/api/students", requireAuth, studentRoutes);
app.use("/api/batches", requireAuth, batchRoutes);
app.use("/api/attendance", requireAuth, attendanceRoutes);
app.use("/api/payments", requireAuth, paymentRoutes);
app.use("/api/reminders", requireAuth, reminderRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`Me & Coach API listening on :${port}`));
