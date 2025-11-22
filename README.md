# 🧠 Mahanc Project

**mahanc** is an interactive text processing tool that allows users to edit text dynamically. Changes to text are sent to the backend in a controlled, efficient way, ensuring only updated or unlocked features are processed. The project uses a React frontend and a Python (Flask) backend, with the backend optionally using LLMs for text enhancement or generation.

### How it works:

1. **User Input**: The user types text into an input box or interacts with features in the interface.
2. **Feature Tracking**: Each feature or sentence is tracked, with a lock/unlock system determining which items can be updated.
3. **Debounce and Progress**: Changes trigger a debounce timer (default 5 seconds) with a progress indicator.
4. **Backend Update**: Once the timer expires, only unlocked or changed items are sent to the backend.
5. **Backend Processing**: The backend updates the unlocked features (values, text, etc.) and returns the results.
6. **Frontend Merge**: Only the updated items are merged back into the frontend state, preserving locked values.
7. **Display**: The updated text/features are displayed live.

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
│           └── llm_service.py # LLM processing logic
│
└── frontend/
    ├── package.json
    ├── package-lock.json
    └── src/
        ├── App.js
        ├── components/       # React components
        ├── hooks/            # Custom React hooks
        └── services/
            └── api.js        # API helper functions
```

---

## ⚙️ Setup Instructions

### 1️⃣ Backend (Flask + Poetry)

#### Install Poetry (if not installed)

```bash
pip install poetry
```

#### Install dependencies

```bash
cd backend
poetry install
```

#### Create a `.env` file

In the `backend` folder, create a `.env` file with your OpenAI API key:

```
OPENAI_API_KEY=your_openai_api_key_here
```

#### Run the Flask server

```bash
poetry run python src/app.py
```

The Flask app will start on `http://localhost:5000`.

---

### 2️⃣ Frontend (React + Prettier)

#### Install dependencies

```bash
cd ../frontend
npm install
```

#### Start the development server

```bash
npm start
```

The app will open on `http://localhost:3000`.

---

### 3️⃣ How It Works (Frontend ↔ Backend)

1. User edits text or interacts with feature points in React.
2. React tracks which features are unlocked or changed.
3. A debounce timer ensures only stable changes are sent to the backend.
4. Backend receives the latest values, updates unlocked features, and returns the results.
5. React merges updated values while keeping locked features unchanged.
6. Live updates are displayed immediately.

---

## 🧹 Code Formatting (Prettier)

Prettier is used in the **frontend** to automatically format code.

### Format Your Code

```bash
npm run format
```

This ensures consistent styling across all React components.
