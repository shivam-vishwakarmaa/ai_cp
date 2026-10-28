from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI(title="Environmental Monitoring API")

# Setup CORS to allow the React frontend to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained models globally
air_model_data = None
flood_model_data = None

try:
    air_model_data = joblib.load('models/air_quality_model.joblib')
    print("Air Quality Model loaded.")
except Exception as e:
    print(f"Failed to load Air Quality model: {e}")

try:
    flood_model_data = joblib.load('models/flood_model.joblib')
    print("Flood Model loaded.")
except Exception as e:
    print(f"Failed to load Flood model: {e}")


# Define Pydantic models for the request bodies
class AirQualityRequest(BaseModel):
    T: float # Temperature
    RH: float # Relative Humidity
    AH: float # Absolute Humidity
    NOx_GT: float # NOx concentration
    NO2_GT: float # NO2 concentration

class FloodRequest(BaseModel):
    MonsoonIntensity: int
    RiverManagement: int
    Deforestation: int
    Urbanization: int
    ClimateChange: int
    DamsQuality: int
    DrainageSystems: int


@app.get("/")
def read_root():
    return {"message": "Welcome to the Environmental Monitoring API"}

@app.post("/predict/air-quality")
def predict_air_quality(data: AirQualityRequest):
    if not air_model_data:
        raise HTTPException(status_code=500, detail="Air Quality model is not loaded.")
        
    model = air_model_data['model']
    imputer = air_model_data['imputer']
    features = air_model_data['features']
    
    # Map request payload to dataframe using the correct feature names from training
    # Note: Pydantic doesn't allow parentheses in field names, so we map NOx_GT to NOx(GT)
    input_data = pd.DataFrame([{
        'T': data.T,
        'RH': data.RH,
        'AH': data.AH,
        'NOx(GT)': data.NOx_GT,
        'NO2(GT)': data.NO2_GT
    }])
    
    # Preprocess
    input_imputed = imputer.transform(input_data)
    
    # Predict
    prediction = model.predict(input_imputed)[0]
    
    return {
        "prediction_CO_GT": float(prediction),
        "status": "Good" if prediction < 2.0 else ("Moderate" if prediction < 5.0 else "Hazardous")
    }

@app.get("/training-metrics")
def get_training_metrics():
    import os, json
    metrics_path = os.path.join(os.path.dirname(__file__), 'data', 'training_metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            return json.load(f)
    return {"message": "Metrics report not found. Run train_models.py first."}

@app.post("/predict/flood")
def predict_flood(data: FloodRequest):
    if not flood_model_data:
        raise HTTPException(status_code=500, detail="Flood model is not loaded.")
        
    model = flood_model_data['model']
    features = flood_model_data['features']
    
    # Map request to dataframe using exact features expected by the trained model
    input_dict = data.model_dump()
    row = {feat: input_dict.get(feat, 5) for feat in features}
    input_data = pd.DataFrame([row])
    
    # Predict
    prediction = model.predict(input_data)[0]
    probabilities = model.predict_proba(input_data)[0]
    
    return {
        "flood_risk_prediction": int(prediction),
        "risk_label": "High Risk" if prediction == 1 else "Low Risk",
        "probability_high_risk": float(probabilities[1])
    }

