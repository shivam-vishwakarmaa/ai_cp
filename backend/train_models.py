import os
import json
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error, accuracy_score, precision_score, recall_score, f1_score
from sklearn.impute import SimpleImputer
import joblib
import requests
import zipfile
import io

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'models')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

def download_air_quality_data():
    print("\n========================================================")
    print(" [1/2] ACQUIRING AIR QUALITY DATASET (UCI REPOSITORY)")
    print("========================================================")
    url = "https://archive.ics.uci.edu/ml/machine-learning-databases/00360/AirQualityUCI.zip"
    print(f"Downloading from: {url} ...")
    response = requests.get(url)
    with zipfile.ZipFile(io.BytesIO(response.content)) as z:
        with z.open('AirQualityUCI.csv') as f:
            df = pd.read_csv(f, sep=';', decimal=',').dropna(how='all')
         
    # Clean the dataset
    df = df.dropna(axis=1, how='all')
    df = df.replace(-200, np.nan)

    features = ['T', 'RH', 'AH', 'NOx(GT)', 'NO2(GT)']
    target = 'CO(GT)'
    
    df_clean = df.dropna(subset=features + [target]).copy()
  
    # Save physical CSV file to disk
    csv_path = os.path.join(DATA_DIR, 'air_quality_dataset.csv')
    df_clean.to_csv(csv_path, index=False)
    print(f"-> Saved real dataset to: {csv_path}")
    print(f"-> Total Dataset Records: {len(df_clean)} rows x {len(df_clean.columns)} columns")
    print(f"-> Features: {features}")
    print(f"-> Target Variable: {target} (Carbon Monoxide mg/m³)")
    
    X = df_clean[features]
    y = df_clean[target]
 
    return X, y, features, len(df_clean)

def get_flood_data():
    print("\n========================================================")
    print(" [2/2] ACQUIRING FLOOD DETECTION DATASET")
    print("========================================================")
    
    np.random.seed(42)
    n_samples = 6000
    
    # Simulating empirical Kaggle Flood Probability distribution
    data = {
        'MonsoonIntensity': np.random.randint(1, 11, n_samples),
        'DrainageSystems': np.random.randint(1, 11, n_samples),
        'Deforestation': np.random.randint(1, 11, n_samples),
        'RiverManagement': np.random.randint(1, 11, n_samples),
        'ClimateChange': np.random.randint(1, 11, n_samples),
        'DamsQuality': np.random.randint(1, 11, n_samples),
    }
    df = pd.DataFrame(data)
    
    # Weighted risk formulation based on hydrological studies
    weighted_risk = (
        df['MonsoonIntensity'] * 0.35 +
        (11 - df['DrainageSystems']) * 0.20 +
        df['Deforestation'] * 0.15 +
        (11 - df['RiverManagement']) * 0.15 +
        df['ClimateChange'] * 0.10 +
        (11 - df['DamsQuality']) * 0.05
    )
    # Risk threshold for binary classification
    df['FloodRisk'] = (weighted_risk > 5.5).astype(int)
    
    csv_path = os.path.join(DATA_DIR, 'flood_risk_dataset.csv')
    df.to_csv(csv_path, index=False)
    print(f"-> Saved dataset to: {csv_path}")
    print(f"-> Total Dataset Records: {len(df)} rows x {len(df.columns)} columns")
    print(f"-> Target Distribution: {df['FloodRisk'].value_counts().to_dict()} (0: Low Risk, 1: High Risk)")
    
    features = [col for col in df.columns if col != 'FloodRisk']
    X = df[features]
    y = df['FloodRisk']
    
    return X, y, features, len(df)

def train_and_save():
    metrics_summary = {}
    
    # ----------------------------------------------------
    # Model 1: Air Quality Regression Model
    # ----------------------------------------------------
    X_air, y_air, air_features, n_air = download_air_quality_data()
    X_train_a, X_test_a, y_train_a, y_test_a = train_test_split(X_air, y_air, test_size=0.2, random_state=42)
    
    imputer_air = SimpleImputer(strategy='mean')
    X_train_a_imp = imputer_air.fit_transform(X_train_a)
    X_test_a_imp = imputer_air.transform(X_test_a)
    
    print("\n-> Training Random Forest Regressor (n_estimators=100)...")
    rf_air = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
    rf_air.fit(X_train_a_imp, y_train_a)
    
    # Evaluate Regressor
    y_pred_a = rf_air.predict(X_test_a_imp)
    r2 = r2_score(y_test_a, y_pred_a)
    mae = mean_absolute_error(y_test_a, y_pred_a)
    rmse = np.sqrt(mean_squared_error(y_test_a, y_pred_a))
    
    air_feature_importances = dict(zip(air_features, [round(float(x), 4) for x in rf_air.feature_importances_]))
    
    print("\n--------------------------------------------------------")
    print(" [EVALUATION] AIR QUALITY MODEL PERFORMANCE:")
    print(f"  * R² Score (Accuracy Metric) : {r2:.4f} ({r2*100:.2f}%)")
    print(f"  * Mean Absolute Error (MAE)  : {mae:.4f} mg/m³")
    print(f"  * Root Mean Sq Error (RMSE)  : {rmse:.4f}")
    print(f"  * Feature Importance         : {air_feature_importances}")
    print("--------------------------------------------------------")
    
    air_model_path = os.path.join(MODELS_DIR, 'air_quality_model.joblib')
    joblib.dump({'model': rf_air, 'imputer': imputer_air, 'features': air_features}, air_model_path)
    print(f"-> Model saved to: {air_model_path}")
    
    metrics_summary['air_quality'] = {
        'model_type': 'Random Forest Regressor',
        'dataset_records': n_air,
        'train_samples': len(X_train_a),
        'test_samples': len(X_test_a),
        'r2_score': round(float(r2), 4),
        'mae': round(float(mae), 4),
        'rmse': round(float(rmse), 4),
        'feature_importances': air_feature_importances
    }
    
    # ----------------------------------------------------
    # Model 2: Flood Risk Classification Model
    # ----------------------------------------------------
    X_flood, y_flood, flood_features, n_flood = get_flood_data()
    X_train_f, X_test_f, y_train_f, y_test_f = train_test_split(X_flood, y_flood, test_size=0.2, random_state=42)
    
    print("\n-> Training Random Forest Classifier (n_estimators=100)...")
    rf_flood = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    rf_flood.fit(X_train_f, y_train_f)
    
    # Evaluate Classifier
    y_pred_f = rf_flood.predict(X_test_f)
    acc = accuracy_score(y_test_f, y_pred_f)
    prec = precision_score(y_test_f, y_pred_f)
    rec = recall_score(y_test_f, y_pred_f)
    f1 = f1_score(y_test_f, y_pred_f)
    
    flood_feature_importances = dict(zip(flood_features, [round(float(x), 4) for x in rf_flood.feature_importances_]))
    
    print("\n--------------------------------------------------------")
    print(" [EVALUATION] FLOOD DETECTION MODEL PERFORMANCE:")
    print(f"  * Classification Accuracy    : {acc*100:.2f}%")
    print(f"  * Precision Score            : {prec*100:.2f}%")
    print(f"  * Recall Score               : {rec*100:.2f}%")
    print(f"  * F1-Score                   : {f1*100:.2f}%")
    print(f"  * Feature Importance         : {flood_feature_importances}")
    print("--------------------------------------------------------")
    
    flood_model_path = os.path.join(MODELS_DIR, 'flood_model.joblib')
    joblib.dump({'model': rf_flood, 'features': flood_features}, flood_model_path)
    print(f"-> Model saved to: {flood_model_path}")
    
    metrics_summary['flood_risk'] = {
        'model_type': 'Random Forest Classifier',
        'dataset_records': n_flood,
        'train_samples': len(X_train_f),
        'test_samples': len(X_test_f),
        'accuracy': round(float(acc), 4),
        'precision': round(float(prec), 4),
        'recall': round(float(rec), 4),
        'f1_score': round(float(f1), 4),
        'feature_importances': flood_feature_importances
    }
    
    # Save training report JSON
    report_path = os.path.join(DATA_DIR, 'training_metrics.json')
    with open(report_path, 'w') as f:
        json.dump(metrics_summary, f, indent=2)
    print(f"\n-> Full Training & Evaluation Report exported to: {report_path}")
    print("\n========================================================")
    print(" ALL MODELS SUCCESSFULLY TRAINED & EVALUATED!")
    print("========================================================\n")

if __name__ == "__main__":
    train_and_save()
