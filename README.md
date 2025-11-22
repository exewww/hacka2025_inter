# 🧠 figlyjo Project

Info about the project. how it is working right now:
User Input
The user types text into the input box.

Split Input into Sentences
The input text is split into an array of sentences: currentSentences[].

Compare with Backend-Confirmed Sentences
Each sentence is compared to the last backend-confirmed version: previousSentences[].

Identify Changed Sentences
Only the indices of sentences that differ are stored in changedIndexes[].

Start Debounce Timer
A debounce timer (e.g., 5 seconds) starts, and a progress bar shows the time remaining.

Send Changed Sentences to Backend
Once the timer expires, only the changed sentences are sent to the backend for processing.

Backend Processing
The backend updates the changed sentences (e.g., using LLMs) and returns the new text.

Update Output
Only the changed sentences in outputSentences[] are updated, leaving the rest unchanged.

Display Output
outputSentences[] is joined back into a single string and displayed in the output box.
---

## 📁 Project Structure

```
project/
│
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── .env
│   └── src/
│       ├── routes/
│       │   └── generate.py
│       └── services/
│           └── llm_service.py
│
└── frontend/
    ├── package.json
    └── src/
        ├── App.js
        ├── components/
        │   ├── InputBox
        │   ├── OutputDiagram
        │   └── OutputDisplay
        ├── hooks/
        │   └── useInteractiveText.js
        └── services/
            └── api.js
```

---

## ⚙️ Setup Instructions

### 1️⃣ Backend (Flask)

#### Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### Create a `.env` file

In the `backend` folder, create a file named `.env` and add your API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

#### Run the Flask server

```bash
python app.py
```

The Flask app will start on `http://localhost:5000`

---

### 2️⃣ Frontend (React)

#### Install dependencies

```bash
cd ../frontend
npm install
```

#### Start the React development server

```bash
npm start
```

The app will open on `http://localhost:3000`

---

### 3️⃣ How It Works

1. Type something into the input box in the React app.
2. React sends your text to the Flask API at `http://localhost:5000/generate`.
3. Flask calls the OpenAI API to generate a response.
4. The result appears live in your browser.

---

## 🧹 Code Formatting (Prettier)

Prettier is used in the **frontend** to automatically format your React code.

### Format Your Code

Run Prettier across the frontend project:

```bash
npm run format
```
