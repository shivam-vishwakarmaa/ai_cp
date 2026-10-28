# AI Environmental Monitoring & Risk Prediction Platform

An interactive AI-powered environmental monitoring web platform that predicts **Air Quality** and **Flood Risk** using machine learning models built with scikit-learn and served via FastAPI, with a real-time reactive React (Vite) frontend.

---

## 🌟 Features

- **Air Quality Prediction**: Predicts Air Quality Index & CO concentration levels based on Temperature, Relative Humidity, Absolute Humidity, NOx, and NO2 levels.
- **Flood Risk Prediction**: Predicts flood probability and risk classification based on monsoon intensity, river management, deforestation, urbanization, climate factors, and infrastructure quality.
- **Live Atmosphere & Sensor Feeds**: Interactive location search and telemetry visualization for major cities.
- **Modern Responsive Dashboard**: Built with React, Tailwind/modern CSS styling, and Lucide icons.

---

## 🏗️ Project Architecture

```
ai_cp/
├── backend/
│   ├── data/                 # Datasets and training metrics
│   ├── models/               # Serialized ML models (.joblib)
│   ├── main.py               # FastAPI backend server
│   ├── train_models.py       # Data preparation & ML training script
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── public/               # Static assets & icons
│   ├── src/                  # React components & UI code
│   ├── package.json          # Node dependencies & scripts
│   └── vite.config.js        # Vite configuration
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Run the API server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend API will be available at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

*(Optional)* To retrain models:
```bash
python train_models.py
```

---

### 2. Frontend Setup (React + Vite)

1. In a new terminal, navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🛠️ Tech Stack

- **Backend**: FastAPI, Uvicorn, Scikit-Learn, Pandas, NumPy, Joblib
- **Frontend**: React 19, Vite, Axios, Lucide React
- **Machine Learning**: Random Forest Regressor & Classifier
