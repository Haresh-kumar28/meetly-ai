import fs from "fs";

import Meeting from "../models/Meeting.js";
import Task from "../models/Task.js";

import { analyzeMeetingTranscript } from "../services/aiService.js";
import { transcribeAudio } from "../services/transcriptionService.js";
// CREATE a new meeting
export const createMeeting = async (req, res) => {
  try {
    const { title, transcript } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Meeting title is required",
      });
    }

    const newMeeting = await Meeting.create({
      title,
      transcript: transcript || "",
    });

    res.status(201).json({
      message: "Meeting created successfully",
      meeting: newMeeting,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create meeting",
      error: error.message,
    });
  }
};

// READ all meetings
export const getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find().sort({
      createdAt: -1,
    });

    res.status(200).json({
      count: meetings.length,
      meetings,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get meetings",
      error: error.message,
    });
  }
};

// READ one meeting
export const getMeetingById = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    res.status(200).json(meeting);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get meeting",
      error: error.message,
    });
  }
};

// UPDATE a meeting
export const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    res.status(200).json({
      message: "Meeting updated successfully",
      meeting,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update meeting",
      error: error.message,
    });
  }
};

// DELETE a meeting
export const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    res.status(200).json({
      message: "Meeting deleted successfully",
      meeting,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete meeting",
      error: error.message,
    });
  }
};
export const analyzeMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        message: "Meeting not found",
      });
    }

    if (!meeting.transcript || !meeting.transcript.trim()) {
      return res.status(400).json({
        message: "Meeting transcript is empty",
      });
    }

    // Send transcript to Groq AI
    const analysis = await analyzeMeetingTranscript(
      meeting.transcript
    );

    // Save AI-generated summary and decisions
    meeting.summary = analysis.summary;
    meeting.decisions = analysis.decisions || [];

    await meeting.save();

    // Prevent duplicate tasks if meeting is analyzed again
    await Task.deleteMany({
      meetingId: meeting._id,
    });

    // Prepare AI-generated action items for MongoDB
    const tasksToCreate = (analysis.actionItems || []).map(
      (item) => ({
        meetingId: meeting._id,
        task: item.task,
        assignedTo: item.assignedTo || "Unassigned",
        deadline: item.deadline || "No deadline",
        status: "pending",
      })
    );

    // Save tasks to MongoDB
    const savedTasks =
      tasksToCreate.length > 0
        ? await Task.insertMany(tasksToCreate)
        : [];

    res.status(200).json({
      message: "Meeting analyzed successfully",
      meeting,
      tasks: savedTasks,
    });
  } catch (error) {
    console.error("AI analysis error:", error);

    res.status(500).json({
      message: "Failed to analyze meeting",
      error: error.message,
    });
  }
};

// TRANSCRIBE uploaded meeting audio
export const transcribeMeetingAudio = async (req, res) => {
  let filePath;

  try {
    // Check if audio file was uploaded
    if (!req.file) {
      return res.status(400).json({
        message: "Please upload an audio file",
      });
    }

    // Get temporary uploaded file path
    filePath = req.file.path;

    // Send audio to speech-to-text service
    const transcript = await transcribeAudio(filePath);

    // Return generated transcript
    res.status(200).json({
      message: "Audio transcribed successfully",
      transcript,
    });
  } catch (error) {
    console.error("Transcription error:", error);

    res.status(500).json({
      message: "Failed to transcribe audio",
      error: error.message,
    });
  } finally {
    // Delete temporary audio file after processing
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};
// COMPLETE PIPELINE:
// Audio → Transcript → Meeting → AI Analysis → Tasks
export const processMeetingAudio = async (req, res) => {
  let filePath;

  try {
    console.log("PROCESS AUDIO REQUEST RECEIVED");
    console.log("STEP 1: Request received");

    if (!req.file) {
      console.log("ERROR: No audio file received");

      return res.status(400).json({
        message: "Please upload an audio file",
      });
    }

    const { title } = req.body;

    console.log("STEP 2: Title received:", title);
    console.log("STEP 2: Audio received:", req.file.originalname);

    if (!title || !title.trim()) {
      return res.status(400).json({
        message: "Meeting title is required",
      });
    }

    filePath = req.file.path;

    console.log("STEP 3: Starting transcription...");

    const transcript = await transcribeAudio(filePath);

    console.log("STEP 4: Transcription completed");
    console.log("Transcript length:", transcript?.length);

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        message: "No speech could be transcribed from the audio",
      });
    }

    console.log("STEP 5: Starting AI analysis...");

    const analysis = await analyzeMeetingTranscript(transcript);

    console.log("STEP 6: AI analysis completed");

    console.log("STEP 7: Saving meeting to MongoDB...");

    const meeting = await Meeting.create({
      title: title.trim(),
      transcript,
      summary: analysis.summary || "",
      decisions: analysis.decisions || [],
    });

    console.log("STEP 8: Meeting saved:", meeting._id);

    const tasksToCreate = (analysis.actionItems || []).map(
      (item) => ({
        meetingId: meeting._id,
        task: item.task,
        assignedTo: item.assignedTo || "Unassigned",
        deadline: item.deadline || "No deadline",
        status: "pending",
      })
    );

    console.log(
      "STEP 9: Number of tasks to save:",
      tasksToCreate.length
    );

    const savedTasks =
      tasksToCreate.length > 0
        ? await Task.insertMany(tasksToCreate)
        : [];

    console.log("STEP 10: Tasks saved");
    console.log("STEP 11: Sending response to frontend");

    return res.status(201).json({
      message: "Meeting processed successfully",
      meeting,
      tasks: savedTasks,
    });
  } catch (error) {
    console.error("PROCESS MEETING ERROR:", error);

    return res.status(500).json({
      message: "Failed to process meeting audio",
      error: error.message,
    });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("STEP 12: Temporary audio deleted");
    }
  }
};