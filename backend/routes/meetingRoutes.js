import express from "express";
import upload from "../middleware/upload.js";

import {
  createMeeting,
  getAllMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  analyzeMeeting,
  transcribeMeetingAudio,
  processMeetingAudio,
} from "../controllers/meetingController.js";

const router = express.Router();

// Audio transcription
router.post(
  "/transcribe",
  upload.single("audio"),
  transcribeMeetingAudio
);

router.post(
  "/process-audio",
  upload.single("audio"),
  processMeetingAudio
);
// Meeting CRUD
router.post("/", createMeeting);
router.get("/", getAllMeetings);
router.get("/:id", getMeetingById);
router.patch("/:id", updateMeeting);
router.delete("/:id", deleteMeeting);

// AI analysis
router.post("/:id/analyze", analyzeMeeting);



export default router;