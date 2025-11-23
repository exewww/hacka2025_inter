# 🚀 Mahanc: AI-Powered Financial Life & Property Planner

Mahanc is an interactive financial simulation platform that transforms
everyday personal narratives into structured, data-driven financial
roadmaps. Users can simply write a "letter" describing their future
plans --- from buying a car, starting a family, or retiring early ---
and Mahanc automatically extracts milestones, estimates financial
impacts, and generates intelligent capital-growth projections.

A major long-term objective supported by Mahanc is **helping users plan,
track, and stay reminded about their journey toward owning property**
through actionable insights and automated guidance.
---

## 📁 Project Structure

```
project/
│
├── backend/
│   ├── pyproject.toml         # Poetry project file
│   ├── poetry.lock
│   ├── .env                   # Environment variables
│   └── src/
│       ├── app.py             # Flask entry point
│       ├── routes/
│       │   └── generate.py    # API route for generation
│       └── services/
│           
│
└── frontend/
    ├── package.json
    ├── package-lock.json
    └── src/
        ├── App.js
        ├── components/       # React components
        ├── hooks/            # Custom React hooks
        └── 
           
```

---

## ✨ Key Features

### 📝 Narrative-to-Roadmap

Write your goals in plain language (e.g., "I want to retire by 50 and
buy a home").\
Mahanc uses Generative AI to convert this into a structured timeline
with milestones, costs, and financial checkpoints --- including
property-ownership goals like down-payment savings or mortgage
readiness.

### 📈 Interactive Capital Simulation

Get a monthly capital curve based on your income, savings, lifestyle,
and major life events.\
Property-related events (deposit saving, home purchase, mortgage
commitments) are visualized clearly.

### 🖱️ Draggable Feature Points

Interact directly with the chart: adjust Savings Rate, Risk Appetite,
Deposit Target, or other parameters and watch the roadmap update in real
time.

### 📅 Dynamic Timeline

A living roadmap of your financial journey. Hover over events to reveal
cost impacts, income shifts, or how a property purchase affects future
projections.

### 🤖 AI Suggestions & Smart Reminders

Click any point in the chart to receive context-aware advice.\
Mahanc can also send **helpful reminders** to keep you on track ---
especially for long-term goals like owning property.

### 📱 Telegram Integration

Sync Mahanc with a Telegram Bot to add life events, ask for updates, or
receive property-saving reminders directly from your phone.

### ⚡ Smart Debouncing

Ensures the app stays responsive as you drag charts or type, minimizing
unnecessary backend calls.

## 🛠️ Setup Instructions

## 1️⃣ Backend (Flask + Poetry)

### Install Poetry (if not installed)

    pip install poetry

### Install dependencies

    cd backend
    poetry install

### Create a `.env` file

Inside the **backend** folder:

    GEMINI_API_KEY='xxx'
    Telegram_Bot_Token='xxx'
    Target_Chat_ID='xxx'

### Run the Flask server

    poetry run python app.py

Backend runs at: http://localhost:5000

## 2️⃣ Frontend (React + Prettier)

### Install dependencies

    cd ../frontend
    npm install

### Start the development server

    npm start

Frontend runs at: http://localhost:3000

## 3️⃣ How It Works (Frontend ↔ Backend)

1.  User edits text or interacts with draggable points.
2.  React tracks which features are locked/unlocked.
3.  Debounce ensures only stable updates are sent.
4.  Backend recalculates data.
5.  React merges updated values.
6.  Live updates refresh immediately.

## 🧹 Code Formatting (Prettier)

Format your code:

    npm run format
