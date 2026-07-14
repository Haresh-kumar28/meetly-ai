import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import meetingRoutes from "./routes/meetingRoutes.js";
import connectDB from "./config/db.js";
import taskRoutes from "./routes/taskRoutes.js";
dotenv.config();
connectDB();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "AI Meeting-to-Action API is running 🚀",
  });
});

// Meeting routes
app.use("/api/meetings", meetingRoutes);
app.use("/api/tasks", taskRoutes);
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});