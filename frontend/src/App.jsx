import { useRef, useState } from "react";
import "./App.css";

function App() {
  const [title, setTitle] = useState("");
  const [audio, setAudio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const resultsRef = useRef(null);

  const handleProcessMeeting = async () => {
    if (!title.trim()) {
      setError("Please enter a meeting title.");
      return;
    }

    if (!audio) {
      setError("Please select an audio file.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("audio", audio);

      const response = await fetch(
        "http://localhost:5000/api/meetings/process-audio",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to process meeting."
        );
      }

      setResult(data);

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    } catch (err) {
      console.error("Frontend error:", err);

      setError(
        err.message ||
          "Something went wrong while processing the meeting."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Background decoration */}
      <div className="background-glow glow-one"></div>
      <div className="background-glow glow-two"></div>

      <div className="main-container">

        {/* Header */}
        <header className="header">
          <div className="brand">
            <div className="brand-icon">M</div>

            <div>
              <h2>Meetly</h2>
              <span>AI Meeting Assistant</span>
            </div>
          </div>

          <div className="ai-badge">
            <span className="status-dot"></span>
            AI Powered
          </div>
        </header>

        {/* Hero */}
        <section className="hero">
          <span className="hero-label">
            ✦ Smarter meetings start here
          </span>

          <h1>
            Turn conversations into
            <span> action.</span>
          </h1>

          <p>
            Upload your meeting audio and let AI instantly create
            transcripts, summaries, key decisions, and actionable tasks.
          </p>
        </section>

        {/* Upload Card */}
        <section className="upload-card">
          <div className="card-heading">
            <div className="card-icon">🎙️</div>

            <div>
              <h2>Process a new meeting</h2>
              <p>Upload your audio and let Meetly handle the rest.</p>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="meeting-title">
              Meeting title
            </label>

            <input
              id="meeting-title"
              type="text"
              placeholder="e.g. Weekly Project Sync"
              value={title}
              disabled={loading}
              onChange={(event) =>
                setTitle(event.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="meeting-audio">
              Meeting audio
            </label>

            <label
              htmlFor="meeting-audio"
              className={`file-upload ${audio ? "has-file" : ""}`}
            >
              <div className="upload-icon">
                {audio ? "✓" : "↑"}
              </div>

              <div className="upload-content">
                {audio ? (
                  <>
                    <strong>{audio.name}</strong>
                    <span>
                      {(audio.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Choose an audio file</strong>
                    <span>MP3, WAV, M4A or WEBM</span>
                  </>
                )}
              </div>

              <span className="browse-button">
                {audio ? "Change" : "Browse"}
              </span>
            </label>

            <input
              id="meeting-audio"
              className="hidden-file-input"
              type="file"
              accept=".mp3,.wav,.m4a,.webm"
              disabled={loading}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0];
                setAudio(selectedFile || null);
              }}
            />
          </div>

          <button
            type="button"
            className="process-button"
            onClick={handleProcessMeeting}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Processing your meeting...
              </>
            ) : (
              <>
                <span>✦</span>
                Process Meeting
              </>
            )}
          </button>

          {loading && (
            <p className="processing-note">
              Transcribing and analyzing your meeting. This may take a
              moment.
            </p>
          )}

          {error && (
            <div className="error-message">
              <span>!</span>
              {error}
            </div>
          )}
        </section>

        {/* Results */}
        {result?.meeting && (
          <section
            className="results-section"
            ref={resultsRef}
          >
            <div className="results-header">
              <div>
                <span className="success-label">
                  ✓ Analysis complete
                </span>

                <h2>{result.meeting.title}</h2>
              </div>

              <span className="result-count">
                {result.tasks?.length || 0} action items
              </span>
            </div>

            {/* Summary */}
            <div className="result-card summary-card">
              <div className="result-title">
                <span className="result-icon purple">✦</span>

                <div>
                  <h3>AI Summary</h3>
                  <p>A concise overview of your meeting</p>
                </div>
              </div>

              <p className="summary-text">
                {result.meeting.summary ||
                  "No summary generated."}
              </p>
            </div>

            <div className="results-grid">
              {/* Decisions */}
              <div className="result-card">
                <div className="result-title">
                  <span className="result-icon blue">✓</span>

                  <div>
                    <h3>Key Decisions</h3>
                    <p>Important outcomes</p>
                  </div>
                </div>

                {result.meeting.decisions?.length > 0 ? (
                  <div className="decisions-list">
                    {result.meeting.decisions.map(
                      (decision, index) => (
                        <div
                          className="decision-item"
                          key={index}
                        >
                          <span>{index + 1}</span>
                          <p>{decision}</p>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="empty-state">
                    No decisions identified.
                  </p>
                )}
              </div>

              {/* Tasks */}
              <div className="result-card">
                <div className="result-title">
                  <span className="result-icon orange">→</span>

                  <div>
                    <h3>Action Items</h3>
                    <p>Tasks extracted by AI</p>
                  </div>
                </div>

                {result.tasks?.length > 0 ? (
                  <div className="tasks-list">
                    {result.tasks.map((task) => (
                      <div
                        className="task-item"
                        key={task._id}
                      >
                        <div className="task-top">
                          <h4>{task.task}</h4>

                          <span
                            className={`status ${task.status}`}
                          >
                            {task.status}
                          </span>
                        </div>

                        <div className="task-meta">
                          <span>
                            👤 {task.assignedTo || "Unassigned"}
                          </span>

                          <span>
                            📅 {task.deadline || "No deadline"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">
                    No action items identified.
                  </p>
                )}
              </div>
            </div>

            {/* Transcript */}
            <div className="result-card transcript-card">
              <div className="result-title">
                <span className="result-icon green">≡</span>

                <div>
                  <h3>Full Transcript</h3>
                  <p>Complete speech-to-text transcription</p>
                </div>
              </div>

              <div className="transcript">
                {result.meeting.transcript ||
                  "No transcript available."}
              </div>
            </div>
          </section>
        )}

        <footer>
          <p>
            Meetly · Turn every conversation into meaningful action.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;