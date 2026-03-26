# AccessiScan AI Platform

A comprehensive, AI-powered Web Accessibility Audit Platform designed to identify and remediate WCAG 2.1/2.2 violations.

## 🚀 Features

- **Global URL Scanner**: Audit public webpages for standard WCAG compliance.
- **Chrome Extension Suite**: 
  - **AccessiBrowser**: Audit internal dashboards, localhost, and authenticated sessions.
  - **AccessiSimulate**: Simulate visual and motor disabilities in real-time.
- **AI Remediation**: Get precise HTML/React fixes using Llama-3 (Groq API).
- **Interactive Reports**: Download professional PDF audits or view glassmorphic cloud dashboards.

## 🛠️ Technology Stack

- **Frontend**: React (Vite), Framer Motion, Tailwind CSS, Lucide Icons.
- **Backend**: FastAPI, Playwright (Headless Chrome), axe-core.
- **AI**: Groq Cloud (Llama-3-70B).

---

## ⚙️ Setup & Installation

### 1. Python Environment (Backends)
We use a unified virtual environment at the project root for both backends.

```powershell
# Create venv
python -m venv venv

# Activate venv
.\venv\Scripts\Activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium
```

### 2. Frontend Dependencies
```powershell
cd frontend
npm install
```

---

## 🏃 How to Run (3 Terminals Required)

Open three separate terminals in the project root:

### Terminal 1: Main Platform Backend
Responsible for the web dashboard and global URL scanning.
```powershell
.\venv\Scripts\python .\backend\run.py
```
*Accessible at: http://localhost:8001*

### Terminal 2: Extension Support Backend
Responsible for browser extension operations and local audits.
```powershell
.\venv\Scripts\python .\extension\extension\backend\run.py
```
*Accessible at: http://localhost:8000*

### Terminal 3: Frontend Dashboard
The main React-based user interface.
```powershell
cd frontend
npm run dev
```
*Accessible at: http://localhost:5173*

---

## 🧩 Installing the Chrome Extensions

1. Go to the **Chrome Extension** tab in the running app dashboard.
2. Download both `accessibrowser.zip` and `accessisimulate.zip`.
3. Extract each ZIP into its own folder.
4. Open Chrome and navigate to `chrome://extensions/`.
5. Toggle **Developer mode** (top right).
6. Click **Load unpacked** and select the extracted folders.

---

## 📄 License
MIT License - Created for AccessiScan Hackathon.
