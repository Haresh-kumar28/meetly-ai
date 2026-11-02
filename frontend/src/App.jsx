import React, { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const nav = [
  ["dashboard", "Dashboard", "⌂"],
  ["new", "New Meeting", "＋"],
  ["live", "Live Copilot", "◉"],
  ["knowledge", "Knowledge / RAG", "⌕"],
  ["meetings", "Meetings", "▤"],
  ["tasks", "Action Center", "✓"],
  ["reports", "Reports", "▥"],
];

const seedMeeting = {
  _id: "demo-meeting",
  title: "Product Marketing Weekly Sync",
  date: "30 Sep 2026 · 45 min",
  summary:
    "The team aligned on the next product launch, clarified ownership for campaign assets, and agreed to finalize the launch checklist before Friday.",
  decisions: [
    "Launch checklist will be frozen on Friday.",
    "Product demo will use the new onboarding flow.",
    "Marketing and product will review the final messaging together.",
  ],
  tasks: [
    {
      task: "Finalize launch checklist",
      assignedTo: "Haresh",
      deadline: "Friday",
      status: "pending",
    },
    {
      task: "Prepare updated demo assets",
      assignedTo: "Afnan",
      deadline: "Thursday",
      status: "pending",
    },
    {
      task: "Review final messaging",
      assignedTo: "Marketing Team",
      deadline: "Friday",
      status: "pending",
    },
  ],
  transcript:
    "Speaker 1: Let's finalize the launch checklist before Friday.",
};

function App() {
  const [section, setSection] = useState("dashboard");

  const [meeting, setMeeting] = useState(seedMeeting);
  const [meetings, setMeetings] = useState([seedMeeting]);

  const [live, setLive] = useState(false);

  const [liveLines, setLiveLines] = useState([
    "Speaker 1: We need a clear owner for the launch checklist.",
    "Speaker 2: I can take the first draft by tomorrow.",
    "Meetly: Potential action item detected — assign launch checklist to Speaker 2.",
  ]);

  const [title, setTitle] = useState("");
  const [audio, setAudio] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [creatingMeet, setCreatingMeet] = useState(false);
  const [toast, setToast] = useState("");

  const fileRef = useRef(null);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!live) return;

    const lines = [
      "Speaker 3: We should connect this decision to the previous launch meeting.",
      "Meetly: Retrieved context — the team previously agreed on a Friday checkpoint.",
      "Speaker 1: Good. Let's keep Friday as the decision deadline.",
    ];

    let index = 0;

    const timer = setInterval(() => {
      setLiveLines((current) => [
        ...current,
        lines[index % lines.length],
      ]);

      index += 1;
    }, 2600);

    return () => clearInterval(timer);
  }, [live]);

  const go = (name) => {
    setSection(name);
  };

  async function createGoogleMeet() {
    if (creatingMeet) return;

    setCreatingMeet(true);

    try {
      const response = await fetch(
        `${API}/auth/google/meet`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Failed to create Google Meet."
        );
      }

      setToast("Google Meet created successfully.");

      if (data.meetingUri) {
        window.open(data.meetingUri, "_blank");
      }
    } catch (error) {
      console.error("Google Meet error:", error);

      setToast(
        error.message ||
          "Could not create Google Meet."
      );
    } finally {
      setCreatingMeet(false);
    }
  }

  async function processMeeting() {
    if (!title.trim()) {
      setToast("Enter a meeting title first.");
      return;
    }

    if (!audio) {
      setToast("Select an audio file first.");
      return;
    }

    setProcessing(true);

    try {
      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("audio", audio);

      const response = await fetch(
        `${API}/api/meetings/process-audio`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Meeting processing failed."
        );
      }

      const backendMeeting = data.meeting;

      const newMeeting = {
        _id:
          backendMeeting?._id ||
          String(Date.now()),

        title:
          backendMeeting?.title ||
          title.trim(),

        date: new Date().toLocaleDateString(
          "en-IN",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        ),

        summary:
          backendMeeting?.summary || "",

        decisions:
          Array.isArray(
            backendMeeting?.decisions
          )
            ? backendMeeting.decisions
            : [],

        tasks:
          Array.isArray(backendMeeting?.tasks)
            ? backendMeeting.tasks
            : [],

        transcript:
          backendMeeting?.transcript || "",

        createdAt:
          backendMeeting?.createdAt ||
          new Date().toISOString(),
      };

      setMeeting(newMeeting);

      setMeetings((current) => [
        newMeeting,
        ...current.filter(
          (item) =>
            item._id !== newMeeting._id
        ),
      ]);

      setTitle("");
      setAudio(null);

      if (fileRef.current) {
        fileRef.current.value = "";
      }

      setToast(
        `Meeting analyzed successfully — ${
          newMeeting.tasks.length
        } action item${
          newMeeting.tasks.length === 1
            ? ""
            : "s"
        } detected.`
      );

      go("meetings");
    } catch (error) {
      console.error(
        "Meeting processing error:",
        error
      );

      setToast(
        error.message ||
          "Meeting processing failed."
      );
    } finally {
      setProcessing(false);
    }
  }

  function exportPDF() {
    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.setTextColor(35, 32, 60);
    doc.text("Meetly AI", 20, 22);

    doc.setFontSize(11);
    doc.setTextColor(100, 100, 110);
    doc.text(
      "Meeting Intelligence Report",
      20,
      30
    );

    doc.setFontSize(14);
    doc.setTextColor(35, 35, 45);
    doc.text(
      meeting.title || "Meeting",
      20,
      42
    );

    let y = 55;

    const addSection = (heading, content) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(90, 65, 170);
      doc.setFont("helvetica", "bold");
      doc.text(heading, 20, y);

      y += 8;

      doc.setFontSize(10);
      doc.setTextColor(70, 70, 80);
      doc.setFont("helvetica", "normal");

      const lines = doc.splitTextToSize(
        content || "No information available.",
        170
      );

      lines.forEach((line) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }

        doc.text(line, 20, y);
        y += 5;
      });

      y += 8;
    };

    addSection(
      "Executive Summary",
      meeting.summary
    );

    addSection(
      "Key Decisions",
      (meeting.decisions || [])
        .map(
          (item, index) =>
            `${index + 1}. ${item}`
        )
        .join("\n")
    );

    addSection(
      "Action Items",
      (meeting.tasks || [])
        .map((task, index) => {
          if (typeof task === "string") {
            return `${index + 1}. ${task}`;
          }

          return `${index + 1}. ${
            task.task || "Unknown task"
          } — ${
            task.assignedTo || "Unassigned"
          } — ${
            task.deadline || "No deadline"
          }`;
        })
        .join("\n")
    );

    addSection(
      "Transcript",
      meeting.transcript
    );

    const filename = (
      meeting.title || "meeting"
    )
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase();

    doc.save(
      `${filename}-meetly-report.pdf`
    );

    setToast("PDF report generated.");
  }

  const currentTitle =
    nav.find(
      (item) => item[0] === section
    )?.[1] || "Dashboard";

  return (
    <div className="app">
      <div className="glow glow1" />
      <div className="glow glow2" />

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            M
          </div>

          <div>
            <b>Meetly</b>
            <span>AI Meeting Intelligence</span>
          </div>
        </div>

        <div className="workspace">
          <span>WORKSPACE</span>
          <strong>Personal Workspace</strong>
        </div>

        <nav>
          {nav.map(([id, label, icon]) => (
            <button
              key={id}
              className={
                section === id ? "active" : ""
              }
              onClick={() => go(id)}
            >
              <i>{icon}</i>

              {label}

              {id === "live" && (
                <em>LIVE</em>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="mini-status">
            <span className="dot" />
            AI services ready
          </div>

          <small>
            v1.0 · RAG-ready architecture
          </small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">
              MEETLY AI
            </span>

            <h1>{currentTitle}</h1>
          </div>

          <div className="top-actions">
            <span className="ai-pill">
              <span className="dot" />
              AI Powered
            </span>

            <button className="avatar">
              HK
            </button>
          </div>
        </header>

        {section === "dashboard" && (
          <Dashboard
            go={go}
            meeting={meeting}
            meetings={meetings}
            exportPDF={exportPDF}
            createGoogleMeet={
              createGoogleMeet
            }
            creatingMeet={creatingMeet}
          />
        )}

        {section === "new" && (
          <NewMeeting
            title={title}
            setTitle={setTitle}
            audio={audio}
            setAudio={setAudio}
            processing={processing}
            processMeeting={processMeeting}
            fileRef={fileRef}
          />
        )}

        {section === "live" && (
          <LiveCopilot
            live={live}
            setLive={setLive}
            lines={liveLines}
          />
        )}

        {section === "knowledge" && (
          <Knowledge />
        )}

        {section === "meetings" && (
          <Meetings
            meetings={meetings}
            meeting={meeting}
            setMeeting={setMeeting}
            exportPDF={exportPDF}
          />
        )}

        {section === "tasks" && (
          <Tasks meeting={meeting} />
        )}

        {section === "reports" && (
          <Reports
            meeting={meeting}
            exportPDF={exportPDF}
          />
        )}

        <footer>
          Meetly · From conversation to context
          to action.
        </footer>
      </main>

      {toast && (
        <div className="toast">
          ✓ {toast}
        </div>
      )}
    </div>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  go,
  meeting,
  meetings,
  exportPDF,
  createGoogleMeet,
  creatingMeet,
}) {
  return (
    <section>
      <div className="hero compact">
        <div className="hero-tag">
          ✦ Context-aware meeting intelligence
        </div>

        <h2>
          Turn conversations into{" "}
          <span>action.</span>
        </h2>

        <p>
          Analyze meetings, remember
          organizational context, and surface
          decisions and tasks as they happen.
        </p>

        <div className="hero-actions">
          <button
            className="primary"
            onClick={() => go("new")}
          >
            ＋ New meeting
          </button>

          <button
            className="secondary"
            onClick={() => go("live")}
          >
            ◉ Start live copilot
          </button>

          <button
            className="secondary"
            onClick={createGoogleMeet}
            disabled={creatingMeet}
          >
            {creatingMeet
              ? "Creating Meet..."
              : "🎥 Create Google Meet"}
          </button>
        </div>
      </div>

      <div className="stats">
        <Stat
          n={meetings.length}
          l="Meetings analyzed"
        />

        <Stat
          n={meeting.tasks?.length || 0}
          l="Open action items"
        />

        <Stat
          n={meeting.decisions?.length || 0}
          l="Decisions captured"
        />

        <Stat
          n="RAG"
          l="Context engine"
        />
      </div>

      <div className="grid two">
        <div className="card">
          <Head
            icon="✦"
            title="Latest intelligence"
            sub="Your most recent meeting"
          />

          <h3 className="meeting-name">
            {meeting.title}
          </h3>

          <p className="muted">
            {meeting.summary}
          </p>

          <div className="chips">
            <span>Summary ready</span>

            <span>
              {meeting.tasks?.length || 0} tasks
            </span>

            <span>
              {meeting.decisions?.length || 0}{" "}
              decisions
            </span>
          </div>

          <button
            className="link"
            onClick={() => go("meetings")}
          >
            Open meeting →
          </button>
        </div>

        <div className="card">
          <Head
            icon="⌕"
            title="Memory & RAG"
            sub="Cross-meeting context"
          />

          <div className="rag-box">
            <strong>
              Ask your meeting memory
            </strong>

            <p>
              “What did we decide about the launch
              deadline?”
            </p>

            <div className="answer">
              Previous meeting context found ·
              Friday checkpoint
            </div>
          </div>

          <button
            className="link"
            onClick={() => go("knowledge")}
          >
            Explore knowledge →
          </button>
        </div>
      </div>

      <div className="card feature-strip">
        <div>
          <b>
            Generate a shareable meeting report
          </b>

          <p>
            Export summary, decisions, action
            items and transcript as a polished PDF.
          </p>
        </div>

        <button
          className="secondary"
          onClick={exportPDF}
        >
          ↓ Export PDF
        </button>
      </div>
    </section>
  );
}


/* =========================================================
   STAT
========================================================= */

function Stat({ n, l }) {
  return (
    <div className="stat">
      <strong>{n}</strong>
      <span>{l}</span>
    </div>
  );
}


/* =========================================================
   HEAD
========================================================= */

function Head({ icon, title, sub }) {
  return (
    <div className="head">
      <span className="icon">{icon}</span>

      <div>
        <h3>{title}</h3>
        <p>{sub}</p>
      </div>
    </div>
  );
}


/* =========================================================
   NEW MEETING
========================================================= */

function NewMeeting({
  title,
  setTitle,
  audio,
  setAudio,
  processing,
  processMeeting,
  fileRef,
}) {
  return (
    <section>
      <div className="page-intro">
        <span className="hero-tag">
          NEW MEETING
        </span>

        <h2>
          Bring a conversation into Meetly.
        </h2>

        <p>
          Upload audio for transcription, AI
          analysis, task extraction and decision
          tracking.
        </p>
      </div>

      <div className="card form-card">
        <label>Meeting title</label>

        <input
          value={title}
          disabled={processing}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          placeholder="e.g. Weekly Product Sync"
        />

        <label>Meeting audio</label>

        <div
          className={`drop ${
            audio ? "selected" : ""
          }`}
          onClick={() =>
            fileRef.current?.click()
          }
        >
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".mp3,.wav,.m4a,.webm,.ogg,.mp4"
            onChange={(event) =>
              setAudio(
                event.target.files?.[0] ||
                  null
              )
            }
          />

          <div className="drop-icon">
            {audio ? "✓" : "↑"}
          </div>

          <div>
            <b>
              {audio
                ? audio.name
                : "Choose an audio file"}
            </b>

            <p>
              {audio
                ? `${(
                    audio.size / 1048576
                  ).toFixed(2)} MB`
                : "MP3, WAV, M4A or WEBM"}
            </p>
          </div>

          <span className="browse">
            {audio ? "Change" : "Browse"}
          </span>
        </div>

        <button
          className="primary full"
          disabled={processing}
          onClick={processMeeting}
        >
          {processing
            ? "Processing transcript + AI..."
            : "✦ Process meeting"}
        </button>

        <div className="pipeline">
          <span>01 · Speech-to-text</span>
          <span>02 · AI analysis</span>
          <span>03 · Actions + decisions</span>
          <span>04 · RAG memory</span>
        </div>
      </div>
    </section>
  );
}


/* =========================================================
   LIVE COPILOT
========================================================= */

function LiveCopilot({
  live,
  setLive,
  lines,
}) {
  return (
    <section>
      <div className="page-intro row">
        <div>
          <span className="hero-tag">
            REAL-TIME COPILOT
          </span>

          <h2>
            Meetly listens for the moments that
            matter.
          </h2>

          <p>
            Prototype workspace for live
            transcript, context retrieval and action
            detection.
          </p>
        </div>

        <button
          className={
            live ? "danger" : "primary"
          }
          onClick={() => setLive(!live)}
        >
          {live
            ? "■ End session"
            : "● Start live session"}
        </button>
      </div>

      <div className="live-layout">
        <div className="card live-stage">
          <div className="live-top">
            <div>
              <b>
                {live
                  ? "Live meeting in progress"
                  : "Ready for live meeting"}
              </b>

              <span>
                {live
                  ? "Streaming transcript"
                  : "Google Meet connector ready"}
              </span>
            </div>

            <span
              className={`live-badge ${
                live ? "on" : ""
              }`}
            >
              {live ? "LIVE" : "READY"}
            </span>
          </div>

          <div className="transcript-feed">
            {lines.map((line, index) => (
              <div
                key={index}
                className={
                  line.startsWith("Meetly:")
                    ? "ai-line"
                    : ""
                }
              >
                <small>
                  {line.startsWith("Meetly:")
                    ? "MEETLY AI"
                    : "TRANSCRIPT"}
                </small>

                <p>
                  {line.replace(
                    "Meetly: ",
                    ""
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="card live-side">
          <Head
            icon="⌕"
            title="Context found"
            sub="RAG memory"
          />

          <div className="context-card">
            <b>Launch checkpoint</b>

            <p>
              Previous meeting: Friday was selected
              as the decision checkpoint.
            </p>

            <span>92% relevance</span>
          </div>

          <Head
            icon="→"
            title="Live signals"
            sub="Detected in this session"
          />

          <div className="signal">
            <b>Action item</b>

            <span>
              Assign launch checklist owner
            </span>
          </div>

          <div className="signal">
            <b>Decision</b>

            <span>
              Keep Friday checkpoint
            </span>
          </div>
        </div>
      </div>

      <div className="notice">
        Google Meet creation is connected. Real-time
        meeting media ingestion requires the separate
        Google Meet Media API integration.
      </div>
    </section>
  );
}


/* =========================================================
   KNOWLEDGE / RAG
========================================================= */

function Knowledge() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [selectedMeeting, setSelectedMeeting] =
    useState(null);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);

  const [error, setError] = useState("");

  async function searchKnowledge(value) {
    setQuery(value);
    setError("");

    if (!value.trim()) {
      setResults([]);
      setSelectedMeeting(null);
      setAnswer("");
      return;
    }

    try {
      setSearching(true);

      const response = await fetch(
        `${API}/api/knowledge/search?q=${encodeURIComponent(
          value.trim()
        )}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Knowledge search failed."
        );
      }

      setResults(data.results || []);
    } catch (error) {
      console.error(
        "Knowledge search error:",
        error
      );

      setResults([]);

      setError(
        error.message ||
          "Unable to search meeting memory."
      );
    } finally {
      setSearching(false);
    }
  }

  function selectSource(item) {
    setSelectedMeeting(item);
    setQuestion("");
    setAnswer("");
    setError("");
  }

  async function askSource() {
    if (!selectedMeeting) {
      setError(
        "Select a meeting source first."
      );
      return;
    }

    if (!question.trim()) {
      setError("Enter a question first.");
      return;
    }

    try {
      setAsking(true);
      setAnswer("");
      setError("");

      const response = await fetch(
        `${API}/api/knowledge/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            meetingId: selectedMeeting.id,
            question: question.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to answer question."
        );
      }

      setAnswer(
        data.answer ||
          "No answer was generated."
      );
    } catch (error) {
      console.error(
        "Ask source error:",
        error
      );

      setError(
        error.message ||
          "Unable to get an answer."
      );
    } finally {
      setAsking(false);
    }
  }

  function handleQuestionKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      askSource();
    }
  }

  return (
    <section>
      <div className="page-intro">
        <span className="hero-tag">
          MEMORY ENGINE
        </span>

        <h2>
          One searchable memory for every
          meeting.
        </h2>

        <p>
          Search previous conversations and ask
          questions using Meetly's meeting memory.
        </p>
      </div>

      <div className="card search-card">
        <span>⌕</span>

        <input
          value={query}
          onChange={(event) =>
            searchKnowledge(
              event.target.value
            )
          }
          placeholder="Search meeting memory..."
        />

        {searching && (
          <small className="search-status">
            Searching...
          </small>
        )}
      </div>

      {error && (
        <div className="notice">
          ⚠ {error}
        </div>
      )}

      {query.trim() && (
        <div className="knowledge-results">
          <div className="section-label">
            {searching
              ? "SEARCHING"
              : `${results.length} SOURCE${
                  results.length === 1
                    ? ""
                    : "S"
                } FOUND`}
          </div>

          {!searching &&
            results.length === 0 && (
              <div className="card empty-state">
                <div className="empty-icon">
                  ⌕
                </div>

                <h3>
                  No matching meeting found
                </h3>

                <p>
                  Try a word or phrase that
                  appears in the meeting transcript.
                </p>
              </div>
            )}

          {results.map((item) => (
            <div
              className={`card source ${
                selectedMeeting?.id ===
                item.id
                  ? "selected-source"
                  : ""
              }`}
              key={item.id}
            >
              <div className="source-top">
                <span className="file-icon">
                  ◉
                </span>

                <span>MEETING</span>
              </div>

              <h3>{item.title}</h3>

              <p>{item.summary}</p>

              <div className="source-bottom">
                <span>
                  {item.createdAt
                    ? new Date(
                        item.createdAt
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }
                      )
                    : "Meeting"}
                </span>

                <button
                  className="link"
                  onClick={() =>
                    selectSource(item)
                  }
                >
                  Ask source →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedMeeting && (
        <div className="card rag-question-card">
          <div className="head">
            <span className="icon">
              ✦
            </span>

            <div>
              <h3>Ask this meeting</h3>

              <p>
                Source:{" "}
                {selectedMeeting.title}
              </p>
            </div>
          </div>

          <div className="question-box">
            <textarea
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              onKeyDown={
                handleQuestionKeyDown
              }
              placeholder="Ask anything about this meeting..."
              rows={4}
              disabled={asking}
            />

            <div className="question-footer">
              <span className="input-hint">
                Enter to ask · Shift + Enter
                for new line
              </span>

              <button
                className="primary"
                onClick={askSource}
                disabled={
                  asking ||
                  !question.trim()
                }
              >
                {asking
                  ? "Thinking..."
                  : "✦ Ask Meetly"}
              </button>
            </div>
          </div>

          {answer && (
            <div className="rag-answer">
              <div className="answer-label">
                MEETLY AI
              </div>

              <div className="answer-content">
                {answer}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}


/* =========================================================
   MEETINGS
========================================================= */

function Meetings({
  meetings,
  meeting,
  setMeeting,
  exportPDF,
}) {
  return (
    <section>
      <div className="page-intro row">
        <div>
          <span className="hero-tag">
            MEETING MEMORY
          </span>

          <h2>
            Every conversation, organized.
          </h2>

          <p>
            Open any meeting to inspect its
            intelligence.
          </p>
        </div>

        <button
          className="secondary"
          onClick={exportPDF}
        >
          ↓ PDF report
        </button>
      </div>

      <div className="meeting-list">
        {meetings.map((item, index) => (
          <button
            className={`meeting-row ${
              item._id === meeting._id
                ? "selected"
                : ""
            }`}
            key={item._id || index}
            onClick={() =>
              setMeeting(item)
            }
          >
            <div className="meeting-avatar">
              M
            </div>

            <div>
              <b>{item.title}</b>

              <span>
                {item.date ||
                  (item.createdAt
                    ? new Date(
                        item.createdAt
                      ).toLocaleDateString(
                        "en-IN"
                      )
                    : "Meeting")}
              </span>
            </div>

            <div className="row-count">
              {item.tasks?.length || 0} tasks ·{" "}
              {item.decisions?.length || 0}{" "}
              decisions
            </div>

            <span>→</span>
          </button>
        ))}
      </div>

      <MeetingDetail
        meeting={meeting}
        exportPDF={exportPDF}
      />
    </section>
  );
}


/* =========================================================
   MEETING DETAIL
========================================================= */

function MeetingDetail({
  meeting,
  exportPDF,
}) {
  return (
    <div className="card detail">
      <div className="detail-top">
        <div>
          <span className="success">
            ✓ ANALYSIS COMPLETE
          </span>

          <h3>{meeting.title}</h3>

          <p>
            {meeting.date ||
              (meeting.createdAt
                ? new Date(
                    meeting.createdAt
                  ).toLocaleDateString(
                    "en-IN"
                  )
                : "")}
          </p>
        </div>

        <button
          className="secondary"
          onClick={exportPDF}
        >
          ↓ Generate PDF
        </button>
      </div>

      <div className="summary-block">
        <Head
          icon="✦"
          title="Executive summary"
          sub="AI-generated overview"
        />

        <p>
          {meeting.summary ||
            "No summary available."}
        </p>
      </div>

      <div className="grid two">
        <div>
          <Head
            icon="✓"
            title="Decisions"
            sub="Captured outcomes"
          />

          {meeting.decisions?.length ? (
            meeting.decisions.map(
              (decision, index) => (
                <div
                  className="bullet"
                  key={index}
                >
                  <span>{index + 1}</span>

                  {decision}
                </div>
              )
            )
          ) : (
            <p className="muted">
              No decisions detected.
            </p>
          )}
        </div>

        <div>
          <Head
            icon="→"
            title="Action items"
            sub="Work extracted from conversation"
          />

          {meeting.tasks?.length ? (
            meeting.tasks.map(
              (task, index) => (
                <div
                  className="task"
                  key={index}
                >
                  <b>
                    {typeof task === "string"
                      ? task
                      : task.task ||
                        task.title ||
                        "Unknown task"}
                  </b>

                  {typeof task !== "string" && (
                    <span>
                      {task.assignedTo ||
                        "Unassigned"}{" "}
                      ·{" "}
                      {task.deadline ||
                        "No deadline"}
                    </span>
                  )}
                </div>
              )
            )
          ) : (
            <p className="muted">
              No action items detected.
            </p>
          )}
        </div>
      </div>

      <div className="transcript-box">
        <Head
          icon="≡"
          title="Transcript"
          sub="Speech-to-text source"
        />

        <p>
          {meeting.transcript ||
            "No transcript available."}
        </p>
      </div>
    </div>
  );
}


/* =========================================================
   ACTION CENTER
========================================================= */

function Tasks({ meeting }) {
  const [done, setDone] = useState({});

  const rawTasks = Array.isArray(
    meeting?.tasks
  )
    ? meeting.tasks
    : Array.isArray(
        meeting?.actionItems
      )
      ? meeting.actionItems
      : [];

  const tasks = rawTasks.filter(Boolean);

  return (
    <section>
      <div className="page-intro row">
        <div>
          <span className="hero-tag">
            ACTION CENTER
          </span>

          <h2>
            Move from insight to execution.
          </h2>

          <p>
            Track the work extracted from your
            conversations.
          </p>
        </div>

        <div className="ai-pill">
          <span className="dot" />

          {tasks.length} action item
          {tasks.length === 1
            ? ""
            : "s"}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="card empty-task-state">
          <div className="empty-task-icon">
            ✓
          </div>

          <h3>No action items yet</h3>

          <p>
            Meetly did not detect any actionable
            tasks in this meeting.
          </p>

          <span>
            Process a meeting with actionable work
            to populate this section.
          </span>
        </div>
      ) : (
        <div className="card task-table">
          <div className="task-table-header">
            <div>
              <b>Action items</b>

              <span>
                Extracted from{" "}
                {meeting?.title ||
                  "this meeting"}
              </span>
            </div>

            <span className="task-count">
              {tasks.length} total
            </span>
          </div>

          {tasks.map((task, index) => {
            const taskText =
              typeof task === "string"
                ? task
                : task?.task ||
                  task?.title ||
                  task?.description ||
                  "Unknown task";

            const assignedTo =
              typeof task === "string"
                ? "Unassigned"
                : task?.assignedTo ||
                  task?.assignee ||
                  task?.owner ||
                  "Unassigned";

            const deadline =
              typeof task === "string"
                ? "No deadline"
                : task?.deadline ||
                  task?.dueDate ||
                  "No deadline";

            const status =
              typeof task === "string"
                ? "pending"
                : task?.status ||
                  "pending";

            const isDone = Boolean(
              done[index]
            );

            return (
              <div
                className={`task-row ${
                  isDone ? "done" : ""
                }`}
                key={index}
              >
                <button
                  className="task-check"
                  onClick={() =>
                    setDone((current) => ({
                      ...current,
                      [index]:
                        !current[index],
                    }))
                  }
                >
                  {isDone ? "✓" : ""}
                </button>

                <div className="task-main">
                  <b>{taskText}</b>

                  <span>
                    Owner: {assignedTo}
                  </span>
                </div>

                <div className="task-deadline">
                  <small>DEADLINE</small>

                  <span>
                    {deadline}
                  </span>
                </div>

                <div
                  className={`task-status ${
                    isDone
                      ? "completed"
                      : ""
                  }`}
                >
                  {isDone
                    ? "Completed"
                    : status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}


/* =========================================================
   REPORTS
========================================================= */

function Reports({
  meeting,
  exportPDF,
}) {
  return (
    <section>
      <div className="page-intro row">
        <div>
          <span className="hero-tag">
            REPORTS
          </span>

          <h2>
            Polished output, ready to share.
          </h2>

          <p>
            Generate a clean PDF from the meeting
            intelligence you captured.
          </p>
        </div>

        <button
          className="primary"
          onClick={exportPDF}
        >
          ↓ Generate PDF
        </button>
      </div>

      <div className="report-preview card">
        <div className="report-cover">
          <div className="brand-icon">
            M
          </div>

          <span>MEETLY AI</span>

          <h3>{meeting.title}</h3>

          <p>
            Meeting Intelligence Report ·{" "}
            {meeting.date}
          </p>
        </div>

        <div className="report-body">
          <h4>Executive Summary</h4>

          <p>{meeting.summary}</p>

          <h4>
            Decisions & Action Items
          </h4>

          <div className="grid two">
            <div>
              {(meeting.decisions || []).map(
                (decision, index) => (
                  <p key={index}>
                    ✓ {decision}
                  </p>
                )
              )}
            </div>

            <div>
              {(meeting.tasks || []).map(
                (task, index) => (
                  <p key={index}>
                    →{" "}
                    {typeof task === "string"
                      ? task
                      : task.task}
                  </p>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default App;