import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import mongoose from "mongoose";
import Groq, { toFile } from "groq-sdk";

import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   BASIC CONFIG
========================================================= */

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.use(express.urlencoded({ extended: true }));

/* =========================================================
   UPLOAD DIRECTORY
========================================================= */

const uploadDir = path.join(
  __dirname,
  "uploads"
);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, {
    recursive: true,
  });
}

/* =========================================================
   MULTER
========================================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext =
      path.extname(file.originalname) ||
      ".mp3";

    const safeName =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}${ext}`;

    cb(null, safeName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 25 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowed = [
      ".mp3",
      ".wav",
      ".m4a",
      ".webm",
      ".ogg",
      ".mp4",
      ".mpeg",
      ".mpga",
      ".flac",
    ];

    const ext = path
      .extname(file.originalname)
      .toLowerCase();

    if (!allowed.includes(ext)) {
      return cb(
        new Error(
          `Unsupported audio format: ${ext}`
        )
      );
    }

    cb(null, true);
  },
});

/* =========================================================
   GROQ
========================================================= */

if (!process.env.GROQ_API_KEY) {
  console.warn(
    "⚠ GROQ_API_KEY is missing from .env"
  );
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

/* =========================================================
   TEMPORARY MEETING MEMORY
=========================================================

   For the current prototype we keep meetings in memory.

   Later this can be replaced with MongoDB persistence.
========================================================= */

const meetings = [];

/* =========================================================
   HELPERS
========================================================= */

function cleanupFile(filePath) {
  if (!filePath) return;

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(
      "Could not delete temporary file:",
      error.message
    );
  }
}

function safeArray(value) {
  if (Array.isArray(value)) {
    return value;
  }

  return [];
}

function normalizeMeeting(meeting) {
  return {
    id: meeting._id,

    title:
      meeting.title ||
      "Untitled Meeting",

    summary:
      meeting.summary ||
      "",

    decisions: safeArray(
      meeting.decisions
    ),

    tasks: safeArray(
      meeting.tasks
    ),

    transcript:
      meeting.transcript ||
      "",

    createdAt:
      meeting.createdAt ||
      new Date().toISOString(),
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Meetly backend is running.",
    timestamp: new Date().toISOString(),
    meetingsInMemory: meetings.length,
  });
});

/* =========================================================
   GOOGLE AUTH
========================================================= */

app.use("/auth", authRoutes);

/* =========================================================
   PROCESS AUDIO
========================================================= */

app.post(
  "/api/meetings/process-audio",
  upload.single("audio"),
  async (req, res) => {
    let uploadedFilePath = null;

    try {
      console.log(
        "\n========================================"
      );

      console.log(
        "Starting meeting processing..."
      );

      console.log(
        "========================================"
      );

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "No audio file was uploaded.",
        });
      }

      uploadedFilePath =
        req.file.path;

      const title =
        req.body.title?.trim() ||
        "New Meeting";

      console.log(
        "Meeting title:",
        title
      );

      console.log(
        "Audio file:",
        req.file.originalname
      );

      console.log(
        "Audio size:",
        (
          req.file.size /
          1024 /
          1024
        ).toFixed(2),
        "MB"
      );

      /* =====================================================
         WHISPER
      ===================================================== */

      console.log(
        "Starting Whisper transcription..."
      );

      const audioBuffer =
        fs.readFileSync(
          uploadedFilePath
        );

      const audioFile = await toFile(
        audioBuffer,
        req.file.originalname
      );

      let transcription;

      try {
        transcription =
          await groq.audio.transcriptions.create(
            {
              file: audioFile,

              model:
                "whisper-large-v3-turbo",

              response_format: "json",

              temperature: 0,
            }
          );
      } catch (error) {
        console.error(
          "Whisper transcription error:",
          error
        );

        /*
         * GROQ 429
         */

        if (error?.status === 429) {
          const retryAfterHeader =
            error?.headers?.get?.(
              "retry-after"
            );

          const retryAfterSeconds =
            Number(
              retryAfterHeader
            ) || 0;

          const retryMinutes =
            retryAfterSeconds
              ? Math.ceil(
                  retryAfterSeconds / 60
                )
              : null;

          return res.status(429).json({
            success: false,

            code:
              "WHISPER_RATE_LIMIT",

            message: retryMinutes
              ? `Groq transcription limit reached. Please try again in approximately ${retryMinutes} minutes.`
              : "Groq transcription limit reached. Please try again later.",

            retryAfterSeconds:
              retryAfterSeconds ||
              null,
          });
        }

        throw error;
      }

      const transcript =
        transcription?.text?.trim() ||
        "";

      console.log(
        "Whisper transcription completed ✅"
      );

      console.log(
        "Transcript characters:",
        transcript.length
      );

      if (!transcript) {
        return res.status(422).json({
          success: false,
          message:
            "Whisper returned an empty transcript.",
        });
      }

      /* =====================================================
         LIMIT TRANSCRIPT FOR LLM
      ===================================================== */

      /*
       * Keep the LLM context controlled.
       * Whisper can return a very long transcript.
       */

      const limitedTranscript =
        transcript.slice(0, 28000);

      if (
        transcript.length >
        limitedTranscript.length
      ) {
        console.log(
          `Transcript truncated from ${transcript.length} to ${limitedTranscript.length} characters.`
        );
      }

      /* =====================================================
         GROQ MEETING ANALYSIS
      ===================================================== */

      console.log(
        "Starting meeting analysis..."
      );

      const analysisResponse =
        await groq.chat.completions.create(
          {
            model:
              "openai/gpt-oss-120b",

            temperature: 0.2,

            max_tokens: 3000,

            messages: [
              {
                role: "system",

                content: `
You are Meetly AI, an enterprise meeting intelligence assistant.

Analyze the meeting transcript and return ONLY valid JSON.

Required JSON structure:

{
  "summary": "A concise professional meeting summary.",
  "decisions": [
    "Decision 1",
    "Decision 2"
  ],
  "tasks": [
    {
      "task": "Specific action item",
      "assignedTo": "Person or team if known, otherwise Unassigned",
      "deadline": "Deadline if mentioned, otherwise No deadline",
      "status": "pending"
    }
  ]
}

Rules:
- Do not invent decisions.
- Do not invent people.
- Do not invent deadlines.
- Extract only information supported by the transcript.
- Keep the summary concise.
- Keep each decision concise.
- Keep tasks actionable.
- If no decisions exist, return [].
- If no tasks exist, return [].
                `.trim(),
              },

              {
                role: "user",

                content: `
Meeting title:
${title}

Transcript:
${limitedTranscript}
                `.trim(),
              },
            ],
          }
        );

      const rawAnalysis =
        analysisResponse?.choices?.[0]
          ?.message?.content
          ?.trim() || "";

      console.log(
        "AI analysis completed."
      );

      /* =====================================================
         PARSE JSON
      ===================================================== */

      let analysis = {
        summary:
          "Meeting analysis completed.",
        decisions: [],
        tasks: [],
      };

      try {
        /*
         * Remove markdown JSON fences if model
         * returns them.
         */

        const cleaned =
          rawAnalysis
            .replace(
              /^```json\s*/i,
              ""
            )
            .replace(
              /^```\s*/i,
              ""
            )
            .replace(
              /\s*```$/i,
              ""
            )
            .trim();

        analysis =
          JSON.parse(cleaned);
      } catch (parseError) {
        console.warn(
          "Could not parse AI JSON. Using fallback."
        );

        console.warn(
          rawAnalysis
        );

        analysis = {
          summary:
            rawAnalysis ||
            "Meeting analysis completed.",

          decisions: [],

          tasks: [],
        };
      }

      /* =====================================================
         CREATE MEETING
      ===================================================== */

      const meeting = {
        _id: String(Date.now()),

        title,

        summary:
          analysis.summary ||
          "Meeting analysis completed.",

        decisions:
          safeArray(
            analysis.decisions
          ),

        tasks:
          safeArray(
            analysis.tasks
          ),

        transcript,

        createdAt:
          new Date().toISOString(),
      };

      meetings.unshift(meeting);

      console.log(
        "Meeting saved:",
        meeting._id
      );

      console.log(
        "Decisions:",
        meeting.decisions.length
      );

      console.log(
        "Tasks:",
        meeting.tasks.length
      );

      return res.json({
        success: true,

        message:
          "Meeting processed successfully.",

        meeting,
      });
    } catch (error) {
      console.error(
        "Audio processing error:",
        error
      );

      if (
        error?.status === 429
      ) {
        return res.status(429).json({
          success: false,
          code:
            "GROQ_RATE_LIMIT",
          message:
            "Groq rate limit reached. Please try again later.",
        });
      }

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
          "Failed to process meeting audio.",
      });
    } finally {
      cleanupFile(
        uploadedFilePath
      );
    }
  }
);

/* =========================================================
   GET ALL MEETINGS
========================================================= */

app.get(
  "/api/meetings",
  (req, res) => {
    res.json({
      success: true,

      meetings:
        meetings.map(
          normalizeMeeting
        ),
    });
  }
);

/* =========================================================
   GET SINGLE MEETING
========================================================= */

app.get(
  "/api/meetings/:id",
  (req, res) => {
    const meeting =
      meetings.find(
        (item) =>
          item._id === req.params.id
      );

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message:
          "Meeting not found.",
      });
    }

    res.json({
      success: true,

      meeting:
        normalizeMeeting(meeting),
    });
  }
);

/* =========================================================
   KNOWLEDGE / RAG SEARCH
========================================================= */

app.get(
  "/api/knowledge/search",
  (req, res) => {
    try {
      const q =
        String(
          req.query.q || ""
        )
          .trim()
          .toLowerCase();

      if (!q) {
        return res.json({
          success: true,
          query: "",
          results: [],
        });
      }

      const terms =
        q
          .split(/\s+/)
          .filter(Boolean);

      const results = [];

      for (const meeting of meetings) {
        const searchableText =
          [
            meeting.title,
            meeting.summary,
            meeting.transcript,
            ...safeArray(
              meeting.decisions
            ),
            ...safeArray(
              meeting.tasks
            ).map((task) => {
              if (
                typeof task ===
                "string"
              ) {
                return task;
              }

              return [
                task.task,
                task.assignedTo,
                task.deadline,
                task.status,
              ]
                .filter(Boolean)
                .join(" ");
            }),
          ]
            .join(" ")
            .toLowerCase();

        let score = 0;

        for (const term of terms) {
          if (
            searchableText.includes(
              term
            )
          ) {
            score++;
          }
        }

        if (score > 0) {
          results.push({
            id: meeting._id,

            title:
              meeting.title,

            summary:
              meeting.summary,

            createdAt:
              meeting.createdAt,

            score,
          });
        }
      }

      results.sort(
        (a, b) =>
          b.score - a.score
      );

      return res.json({
        success: true,

        query: q,

        results:
          results.slice(0, 10),
      });
    } catch (error) {
      console.error(
        "Knowledge search error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Knowledge search failed.",
      });
    }
  }
);

/* =========================================================
   KNOWLEDGE / RAG ASK
========================================================= */

app.post(
  "/api/knowledge/ask",
  async (req, res) => {
    try {
      const {
        meetingId,
        question,
      } = req.body;

      if (!meetingId) {
        return res.status(400).json({
          success: false,

          message:
            "meetingId is required.",
        });
      }

      if (
        !question ||
        !question.trim()
      ) {
        return res.status(400).json({
          success: false,

          message:
            "question is required.",
        });
      }

      const meeting =
        meetings.find(
          (item) =>
            item._id ===
            String(meetingId)
        );

      if (!meeting) {
        return res.status(404).json({
          success: false,

          message:
            "Meeting source not found.",
        });
      }

      /* =====================================================
         COMPACT RAG CONTEXT
      ===================================================== */

      const decisions =
        safeArray(
          meeting.decisions
        )
          .slice(0, 15)
          .map(
            (item, index) =>
              `${index + 1}. ${item}`
          )
          .join("\n");

      const tasks =
        safeArray(
          meeting.tasks
        )
          .slice(0, 15)
          .map(
            (task, index) => {
              if (
                typeof task ===
                "string"
              ) {
                return `${
                  index + 1
                }. ${task}`;
              }

              return `${
                index + 1
              }. ${
                task.task ||
                "Unknown task"
              } | Owner: ${
                task.assignedTo ||
                "Unassigned"
              } | Deadline: ${
                task.deadline ||
                "No deadline"
              }`;
            }
          )
          .join("\n");

      /*
       * Keep transcript small for RAG.
       *
       * This is important because the previous
       * implementation could send too much transcript
       * context and hit Groq token limits.
       */

      const transcript =
        String(
          meeting.transcript || ""
        ).slice(0, 14000);

      const context = `
MEETING TITLE:
${meeting.title}

SUMMARY:
${meeting.summary}

DECISIONS:
${decisions || "None"}

ACTION ITEMS:
${tasks || "None"}

TRANSCRIPT:
${transcript || "No transcript available."}
      `.trim();

      console.log(
        "\nRAG question:",
        question
      );

      console.log(
        "RAG context characters:",
        context.length
      );

      /* =====================================================
         RAG LLM
      ===================================================== */

      const response =
        await groq.chat.completions.create(
          {
            model:
              "openai/gpt-oss-120b",

            temperature: 0.1,

            max_tokens: 1200,

            messages: [
              {
                role: "system",

                content: `
You are Meetly AI's meeting-memory assistant.

Answer the user's question using ONLY the supplied meeting context.

Rules:
- Do not invent facts.
- Do not use outside knowledge.
- If the answer is not supported by the context, clearly say that it was not found in this meeting.
- Prefer concise bullet points when multiple facts are requested.
- Mention uncertainty when appropriate.
- Do not claim that something was decided unless the context supports it.
                `.trim(),
              },

              {
                role: "user",

                content: `
MEETING CONTEXT
================

${context}

================

QUESTION
${question.trim()}
                `.trim(),
              },
            ],
          }
        );

      const answer =
        response?.choices?.[0]
          ?.message?.content
          ?.trim() ||
        "I could not find an answer in this meeting.";

      console.log(
        "RAG answer generated ✅"
      );

      return res.json({
        success: true,

        answer,

        source: {
          id: meeting._id,

          title:
            meeting.title,
        },
      });
    } catch (error) {
      console.error(
        "RAG error:",
        error
      );

      if (
        error?.status === 429
      ) {
        return res.status(429).json({
          success: false,

          code:
            "RAG_RATE_LIMIT",

          message:
            "Groq rate limit reached while generating the RAG answer. Please try again shortly.",
        });
      }

      return res.status(500).json({
        success: false,

        message:
          error?.message ||
          "Failed to answer RAG question.",
      });
    }
  }
);

/* =========================================================
   MONGODB
========================================================= */

async function connectMongoDB() {
  const uri =
    process.env.MONGODB_URI;

  if (!uri) {
    console.warn(
      "⚠ MONGODB_URI is not configured."
    );

    console.warn(
      "⚠ Meetly will continue using in-memory meetings."
    );

    return;
  }

  try {
    await mongoose.connect(uri);

    console.log(
      "MongoDB connected successfully ✅"
    );
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    console.warn(
      "⚠ Continuing with in-memory meeting storage."
    );
  }
}

/* =========================================================
   MULTER / GENERAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_SIZE"
      ) {
        return res.status(413).json({
          success: false,

          message:
            "Audio file is too large. Maximum supported upload size is 25 MB.",
        });
      }

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "File upload failed.",
      });
    }

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Internal server error.",
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  await connectMongoDB();

  app.listen(
    PORT,
    () => {
      console.log(
        "\n========================================"
      );

      console.log(
        `Meetly backend running on port ${PORT}`
      );

      console.log(
        `Health: http://localhost:${PORT}/api/health`
      );

      console.log(
        "RAG search: /api/knowledge/search?q=..."
      );

      console.log(
        "RAG ask: POST /api/knowledge/ask"
      );

      console.log(
        "========================================\n"
      );
    }
  );
}

startServer();