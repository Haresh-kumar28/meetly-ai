# Meetly AI Intelligence

A polished evolution of Meetly: meeting processing, cross-meeting memory/RAG workspace, live AI copilot UI, action center, and PDF meeting reports.

## What is included
- **Dashboard** — latest intelligence, KPIs and memory overview.
- **New Meeting** — connects to the existing Whisper + Groq processing pipeline.
- **Live Copilot** — real-time meeting workspace prototype with transcript feed, context retrieval and live signals.
- **Knowledge / RAG** — section for indexed documents, previous meetings and project memory.
- **Meetings** — meeting history and detailed intelligence view.
- **Action Center** — task tracking with completion state.
- **Reports** — browser-side polished PDF generation using jsPDF.
- **Google Meet ready architecture** — UI and environment placeholders for the future Add-on + Media API integration.

## Run
### Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal.

### Backend
```bash
cd backend
npm install
copy .env.example .env
```
Add your Groq key and (optionally) MongoDB URI, then:
```bash
npm run dev
```

The frontend expects the backend at `http://localhost:5000`. To change it, create `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
```

## Google Meet roadmap
The current live copilot is connector-ready but does not pretend to be a production Google Meet capture integration. A production implementation should add Google OAuth, a Google Meet Add-on, Workspace Events, and the Meet Media API where eligible. Keep raw media permissions and participant consent requirements explicit.

## Architecture
```text
Google Meet / Audio Upload
          ↓
 Speech-to-Text (Whisper)
          ↓
 Transcript chunks
          ↓
 ┌────────┴─────────┐
 │                  │
RAG memory       AI analysis
 │                  │
 └────────┬─────────┘
          ↓
Summary · Decisions · Tasks
          ↓
 MongoDB / Workspace Memory
          ↓
React Dashboard + Live Copilot + PDF Reports
```
