# Meetly 🎙️

**Meetly** is an AI-powered meeting assistant that transforms meeting audio into transcripts, concise summaries, key decisions, and actionable tasks.

## ✨ Features

- 🎙️ Upload meeting audio files
- 📝 Automatic speech-to-text transcription
- 🤖 AI-powered meeting analysis
- 📋 Generate concise meeting summaries
- 💡 Extract important decisions
- ✅ Generate actionable tasks
- 👤 Identify task assignees
- 📅 Extract task deadlines
- 💾 Store meetings and tasks in MongoDB
- 🔄 CRUD operations for meetings and tasks

## 🔄 How It Works

Meeting Audio  
↓  
Speech-to-Text Transcription  
↓  
AI Analysis  
↓  
Summary + Key Decisions + Action Items  
↓  
Save to MongoDB  
↓  
Display Results in React Frontend

## 🛠️ Tech Stack

### Frontend
- React.js
- Vite
- CSS

### Backend
- Node.js
- Express.js
- REST APIs
- Multer

### AI & Speech Processing
- Groq LLM
- Whisper Speech-to-Text

### Database
- MongoDB Atlas
- Mongoose

## 📁 Project Structure

```text
meetly-ai/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   └── package.json
│
├── .gitignore
└── README.md