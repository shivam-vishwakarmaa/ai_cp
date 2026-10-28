import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, CloudRain, Wind, Thermometer, Droplets, Droplet, 
  Mountain, Trees, ShieldAlert, BarChart3, AlertTriangle, 
  RefreshCw, MapPin, Search, Navigation, Compass, Globe, CheckCircle2
} from 'lucide-react';
import './index.css';

const API_BASE_URL = 'http://localhost:8000';

const POPULAR_CITIES = [
  { name: 'New Delhi', lat: 28.6139, lon: 77.2090, country: 'India' },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777, country: 'India' },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946, country: 'India' },
  { name: 'London', lat: 51.5074, lon: -0.1278, country: 'UK' },
  { name: 'New York', lat: 40.7128, lon: -74.0060, country: 'USA' },
  { name: 'Tokyo', lat: 35.6762, lon: 139.6503, country: 'Japan' }
];

function App() {
  // --- Location State ---
  const [cityInput, setCityInput] = useState('');
  const [currentLocation, setCurrentLocation] = useState({
    name: 'New Delhi',
    country: 'India',
    lat: 28.6139,
    lon: 77.2090
  });
  const [lastUpdated, setLastUpdated] = useState('');

  // --- Real-time Sensor / Atmosphere State ---
  const [liveSensors, setLiveSensors] = useState({
    temperature: 25.0,
    humidity: 50.0,
    absHumidity: 11.5,
    no2: 45.0,
    nox: 95.0,
    pm25: 35.0,
    precipitation: 0.0,
    soilMoisture: 0.35,
    windSpeed: 8.5
  });

  // --- Air Quality Model Inputs ---
  const [airData, setAirData] = useState({
    T: 25.0,
    RH: 50.0,
    AH: 11.5,
    NOx_GT: 95.0,
    NO2_GT: 45.0
  });
  const [airPrediction, setAirPrediction] = useState(null);
  const [airLoading, setAirLoading] = useState(false);
  const [airMode, setAirMode] = useState('live'); // 'live' | 'manual'

  // --- Flood Detection Model Inputs ---
  const [floodData, setFloodData] = useState({
    MonsoonIntensity: 4,
    RiverManagement: 5,
    Deforestation: 6,
    Urbanization: 7,
    ClimateChange: 5,
    DamsQuality: 5,
    DrainageSystems: 4
  });
  const [floodPrediction, setFloodPrediction] = useState(null);
  const [floodLoading, setFloodLoading] = useState(false);
  const [floodMode, setFloodMode] = useState('live'); // 'live' | 'manual'

  const [isFetchingLive, setIsFetchingLive] = useState(false);

  // --- Scientific Magnus-Tetens formula for Absolute Humidity (g/m³) ---
  const calculateAbsoluteHumidity = (temp, relHumidity) => {
    const saturationVaporPressure = 6.112 * Math.exp((17.67 * temp) / (temp + 243.5));
    const actualVaporPressure = saturationVaporPressure * (relHumidity / 100);
    const absHum = (actualVaporPressure * 100 * 2.1674) / (273.15 + temp);
    return Math.max(0.1, parseFloat(absHum.toFixed(2)));
  };

  // --- Fetch Live Real-Time Data for Coordinates ---
  const fetchLiveEnvironmentalData = async (lat, lon, locationName = currentLocation.name, country = currentLocation.country) => {
    setIsFetchingLive(true);
    try {
      // 1. Fetch live weather & soil/precipitation metrics
      const weatherRes = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m,soil_moisture_0_to_1cm`
      );

      // 2. Fetch live atmospheric air quality metrics
      const aqiRes = await axios.get(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=nitrogen_dioxide,pm10,pm2_5,carbon_monoxide`
      );

      const currentW = weatherRes.data?.current || {};
      const currentAQ = aqiRes.data?.current || {};

      const temp = currentW.temperature_2m ?? 24;
      const rh = currentW.relative_humidity_2m ?? 50;
      const calculatedAH = calculateAbsoluteHumidity(temp, rh);
      const no2Val = currentAQ.nitrogen_dioxide ?? 35;
      const pm25Val = currentAQ.pm2_5 ?? 30;
      const estimatedNox = Math.round(no2Val * 2.1 + (pm25Val * 0.4));
      const rain = currentW.precipitation ?? currentW.rain ?? 0;
      const soilM = currentW.soil_moisture_0_to_1cm ?? 0.3;
      const wind = currentW.wind_speed_10m ?? 8;

      const updatedLive = {
        temperature: temp,
        humidity: rh,
        absHumidity: calculatedAH,
        no2: parseFloat(no2Val.toFixed(1)),
        nox: parseFloat(estimatedNox.toFixed(1)),
        pm25: parseFloat(pm25Val.toFixed(1)),
        precipitation: parseFloat(rain.toFixed(1)),
        soilMoisture: parseFloat(soilM.toFixed(2)),
        windSpeed: parseFloat(wind.toFixed(1))
      };

      setLiveSensors(updatedLive);
      setCurrentLocation({ name: locationName, country: country, lat, lon });
      setLastUpdated(new Date().toLocaleTimeString());

      // Update AI Input parameters
      const newAirData = {
        T: temp,
        RH: rh,
        AH: calculatedAH,
        NOx_GT: estimatedNox,
        NO2_GT: parseFloat(no2Val.toFixed(1))
      };
      setAirData(newAirData);

      // Compute dynamic flood variables from live weather
      const monsoonScale = Math.min(10, Math.max(1, Math.round(rain * 1.5 + (rh > 75 ? 3 : 1))));
      const drainageScale = Math.min(10, Math.max(1, Math.round((1 - soilM) * 10)));
      const newFloodData = {
        MonsoonIntensity: monsoonScale,
        RiverManagement: 5,
        Deforestation: 6,
        Urbanization: 7,
        ClimateChange: temp > 32 ? 8 : 5,
        DamsQuality: 5,
        DrainageSystems: drainageScale
      };
      setFloodData(newFloodData);

      // Trigger automatic real-time prediction using the AI backend
      await runPredictions(newAirData, newFloodData);

    } catch (err) {
      console.error('Failed to fetch real-time live environmental data:', err);
    } finally {
      setIsFetchingLive(false);
    }
  };

  // --- Run AI Predictions ---
  const runPredictions = async (airPayload = airData, floodPayload = floodData) => {
    // Air Quality AI Prediction
    setAirLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/predict/air-quality`, airPayload);
      setAirPrediction(res.data);
    } catch (err) {
      console.error('Air Quality Prediction error:', err);
    } finally {
      setAirLoading(false);
    }

    // Flood Risk AI Prediction
    setFloodLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/predict/flood`, floodPayload);
      setFloodPrediction(res.data);
    } catch (err) {
      console.error('Flood Prediction error:', err);
    } finally {
      setFloodLoading(false);
    }
  };

  // --- Search City Handler ---
  const handleCitySearch = async (e) => {
    e?.preventDefault();
    if (!cityInput.trim()) return;

    setIsFetchingLive(true);
    try {
      const geoRes = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityInput.trim())}&count=1&language=en&format=json`
      );

      if (geoRes.data?.results && geoRes.data.results.length > 0) {
        const place = geoRes.data.results[0];
        await fetchLiveEnvironmentalData(place.latitude, place.longitude, place.name, place.country || '');
        setCityInput('');
      } else {
        alert(`Could not find coordinates for "${cityInput}". Try another major city.`);
      }
    } catch (err) {
      console.error('Geocoding error:', err);
      alert('Error searching for city.');
    } finally {
      setIsFetchingLive(false);
    }
  };

  // --- Browser GPS Geolocation Handler ---
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsFetchingLive(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await fetchLiveEnvironmentalData(latitude, longitude, 'My Location (GPS)', '');
      },
      (err) => {
        console.error('GPS error:', err);
        alert('Could not access your location. Please check browser permissions.');
        setIsFetchingLive(false);
      }
    );
  };

  // Auto-fetch initial live data on mount
  useEffect(() => {
    fetchLiveEnvironmentalData(currentLocation.lat, currentLocation.lon, currentLocation.name, currentLocation.country);
  }, []);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon-wrapper">
            <Activity size={26} color="#ffffff" />
          </div>
          <div>
            <h1>EcoMonitor AI</h1>
            <p style={{ fontSize: '0.85rem' }}>AI-Powered Environmental & Hazard Intelligence</p>
          </div>
        </div>

        <div className="header-badge">
          <span className="pulse-dot"></span>
          <span>Live ML Backend Active</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Real-time Global City Search & Location Controller */}
        <section className="location-control-panel">
          <form onSubmit={handleCitySearch} className="search-row">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="search-input"
                placeholder="Search any global city (e.g. Mumbai, New York, Tokyo, Paris)..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
              />
            </div>

            <button type="submit" className="action-btn btn-fetch" disabled={isFetchingLive}>
              <Search size={16} /> Search & Fetch Live
            </button>

            <button 
              type="button" 
              onClick={handleUseCurrentLocation} 
              className="action-btn btn-gps"
              disabled={isFetchingLive}
            >
              <Navigation size={16} /> Use My GPS Location
            </button>

            <button 
              type="button" 
              onClick={() => fetchLiveEnvironmentalData(currentLocation.lat, currentLocation.lon, currentLocation.name, currentLocation.country)} 
              className="action-btn btn-gps"
              disabled={isFetchingLive}
              title="Refresh live data for current city"
            >
              <RefreshCw size={16} className={isFetchingLive ? 'spin' : ''} /> Refresh Live Data
            </button>
          </form>

          {/* Quick Select City Pills */}
          <div className="quick-cities">
            <span className="quick-label">Popular Monitoring Hubs:</span>
            {POPULAR_CITIES.map((c) => (
              <button
                key={c.name}
                type="button"
                className={`city-pill ${currentLocation.name === c.name ? 'active' : ''}`}
                onClick={() => fetchLiveEnvironmentalData(c.lat, c.lon, c.name, c.country)}
                disabled={isFetchingLive}
              >
                {c.name}, {c.country}
              </button>
            ))}
          </div>

          {/* Location Status Bar */}
          <div className="location-status-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={16} color="#60a5fa" />
              <span>
                Active Target: <span className="active-city-tag">{currentLocation.name} {currentLocation.country ? `(${currentLocation.country})` : ''}</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                [{currentLocation.lat.toFixed(3)}° N, {currentLocation.lon.toFixed(3)}° E]
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <Compass size={15} />
              <span>Last Synchronized: <strong style={{ color: 'var(--text-secondary)' }}>{lastUpdated || 'Loading...'}</strong></span>
            </div>
          </div>
        </section>

        {/* 2-Column AI Intelligence Grid */}
        <div className="dashboard-grid">
          {/* ======================================================== */}
          {/* Card 1: Air Pollution & Atmosphere AI Intelligence */}
          {/* ======================================================== */}
          <div className="glass-card air-card animate-fade-in delay-1">
            <div className="card-header">
              <div className="card-title">
                <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '0.5rem', borderRadius: '10px' }}>
                  <Wind size={22} color="var(--accent-blue)" />
                </div>
                <div>
                  <h2>Air Pollution Intelligence</h2>
                  <p style={{ fontSize: '0.82rem' }}>Machine Learning Carbon Monoxide & AQI Predictor</p>
                </div>
              </div>

              <div className="mode-toggle-group">
                <button
                  type="button"
                  className={`mode-btn ${airMode === 'live' ? 'active' : ''}`}
                  onClick={() => {
                    setAirMode('live');
                    setAirData({
                      T: liveSensors.temperature,
                      RH: liveSensors.humidity,
                      AH: liveSensors.absHumidity,
                      NOx_GT: liveSensors.nox,
                      NO2_GT: liveSensors.no2
                    });
                  }}
                >
                  📡 Live Satellite
                </button>
                <button
                  type="button"
                  className={`mode-btn ${airMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setAirMode('manual')}
                >
                  ⚙️ What-If Simulation
                </button>
              </div>
            </div>

            {/* Live Atmospheric Telemetry Preview */}
            <div className="sensor-pill-grid">
              <div className="sensor-box">
                <span className="sensor-label"><Thermometer size={13} color="#f97316"/> Temperature</span>
                <span className="sensor-val">{liveSensors.temperature}°<span className="sensor-unit">C</span></span>
              </div>
              <div className="sensor-box">
                <span className="sensor-label"><Droplet size={13} color="#38bdf8"/> Humidity (RH)</span>
                <span className="sensor-val">{liveSensors.humidity}<span className="sensor-unit">%</span></span>
              </div>
              <div className="sensor-box">
                <span className="sensor-label"><CloudRain size={13} color="#a855f7"/> NO₂ Sensor</span>
                <span className="sensor-val">{liveSensors.no2}<span className="sensor-unit">µg/m³</span></span>
              </div>
              <div className="sensor-box">
                <span className="sensor-label"><Activity size={13} color="#ef4444"/> PM 2.5</span>
                <span className="sensor-val">{liveSensors.pm25}<span className="sensor-unit">µg/m³</span></span>
              </div>
            </div>

            {/* Parameter Controls / Manual Customization Form */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label"><Thermometer size={13}/> Temp (°C)</label>
                <input
                  type="number"
                  name="T"
                  value={airData.T}
                  disabled={airMode === 'live'}
                  onChange={(e) => setAirData({ ...airData, T: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                  step="0.5"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Droplet size={13}/> Relative Humidity (%)</label>
                <input
                  type="number"
                  name="RH"
                  value={airData.RH}
                  disabled={airMode === 'live'}
                  onChange={(e) => setAirData({ ...airData, RH: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Droplets size={13}/> Absolute Humidity</label>
                <input
                  type="number"
                  name="AH"
                  value={airData.AH}
                  disabled={airMode === 'live'}
                  onChange={(e) => setAirData({ ...airData, AH: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                  step="0.1"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Wind size={13}/> NOx Conc.</label>
                <input
                  type="number"
                  name="NOx_GT"
                  value={airData.NOx_GT}
                  disabled={airMode === 'live'}
                  onChange={(e) => setAirData({ ...airData, NOx_GT: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><CloudRain size={13}/> NO₂ Conc.</label>
                <input
                  type="number"
                  name="NO2_GT"
                  value={airData.NO2_GT}
                  disabled={airMode === 'live'}
                  onChange={(e) => setAirData({ ...airData, NO2_GT: parseFloat(e.target.value) || 0 })}
                  className="form-input"
                />
              </div>
            </div>

            <button 
              type="button" 
              className="btn-main btn-blue" 
              onClick={() => runPredictions(airData, floodData)}
              disabled={airLoading}
            >
              <BarChart3 size={18} /> {airLoading ? 'AI Evaluating...' : 'Run Air Quality Model'}
            </button>

            {/* AI Model Output Display */}
            {airPrediction && (
              <div className="prediction-panel animate-fade-in">
                <div className="result-heading">Random Forest Regression: Estimated CO Level</div>
                <div className="result-main-val">
                  {airPrediction.prediction_CO_GT.toFixed(2)}
                  <span style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>mg/m³</span>
                </div>
                <span className={`status-badge ${
                  airPrediction.status === 'Good' ? 'status-good' : 
                  airPrediction.status === 'Moderate' ? 'status-moderate' : 'status-high'
                }`}>
                  <CheckCircle2 size={14} /> Air Quality: {airPrediction.status}
                </span>
              </div>
            )}
          </div>

          {/* ======================================================== */}
          {/* Card 2: Flood Risk Assessment AI Intelligence */}
          {/* ======================================================== */}
          <div className="glass-card flood-card animate-fade-in delay-2">
            <div className="card-header">
              <div className="card-title">
                <div style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '0.5rem', borderRadius: '10px' }}>
                  <AlertTriangle size={22} color="var(--accent-purple)" />
                </div>
                <div>
                  <h2>Flood Risk Intelligence</h2>
                  <p style={{ fontSize: '0.82rem' }}>Topographical & Hydrological Hazard Classification</p>
                </div>
              </div>

              <div className="mode-toggle-group">
                <button
                  type="button"
                  className={`mode-btn ${floodMode === 'live' ? 'active' : ''}`}
                  onClick={() => setFloodMode('live')}
                >
                  📡 Live Weather
                </button>
                <button
                  type="button"
                  className={`mode-btn ${floodMode === 'manual' ? 'active' : ''}`}
                  onClick={() => setFloodMode('manual')}
                >
                  ⚙️ Stress Test
                </button>
              </div>
            </div>

            {/* Live Hydrological / Meteorological Telemetry */}
            <div className="sensor-pill-grid">
              <div className="sensor-box">
                <span className="sensor-label"><CloudRain size={13} color="#38bdf8"/> Precipitation</span>
                <span className="sensor-val">{liveSensors.precipitation}<span className="sensor-unit">mm</span></span>
              </div>
              <div className="sensor-box">
                <span className="sensor-label"><Droplets size={13} color="#34d399"/> Soil Moisture</span>
                <span className="sensor-val">{liveSensors.soilMoisture}<span className="sensor-unit">m³/m³</span></span>
              </div>
              <div className="sensor-box">
                <span className="sensor-label"><Wind size={13} color="#facc15"/> Wind Velocity</span>
                <span className="sensor-val">{liveSensors.windSpeed}<span className="sensor-unit">km/h</span></span>
              </div>
              <div className="sensor-box">
                <span className="sensor-label"><ShieldAlert size={13} color="#c084fc"/> Drainage Rating</span>
                <span className="sensor-val">{floodData.DrainageSystems}<span className="sensor-unit">/10</span></span>
              </div>
            </div>

            {/* Parameter Controls / Manual Customization Form */}
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label"><CloudRain size={13}/> Monsoon Intensity</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  name="MonsoonIntensity"
                  value={floodData.MonsoonIntensity}
                  disabled={floodMode === 'live'}
                  onChange={(e) => setFloodData({ ...floodData, MonsoonIntensity: parseInt(e.target.value) || 1 })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Activity size={13}/> Drainage Systems</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  name="DrainageSystems"
                  value={floodData.DrainageSystems}
                  disabled={floodMode === 'live'}
                  onChange={(e) => setFloodData({ ...floodData, DrainageSystems: parseInt(e.target.value) || 1 })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Trees size={13}/> Deforestation</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  name="Deforestation"
                  value={floodData.Deforestation}
                  onChange={(e) => setFloodData({ ...floodData, Deforestation: parseInt(e.target.value) || 1 })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Mountain size={13}/> River Management</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  name="RiverManagement"
                  value={floodData.RiverManagement}
                  onChange={(e) => setFloodData({ ...floodData, RiverManagement: parseInt(e.target.value) || 1 })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><Thermometer size={13}/> Climate Change</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  name="ClimateChange"
                  value={floodData.ClimateChange}
                  onChange={(e) => setFloodData({ ...floodData, ClimateChange: parseInt(e.target.value) || 1 })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label"><ShieldAlert size={13}/> Dams Quality</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  name="DamsQuality"
                  value={floodData.DamsQuality}
                  onChange={(e) => setFloodData({ ...floodData, DamsQuality: parseInt(e.target.value) || 1 })}
                  className="form-input"
                />
              </div>
            </div>

            <button 
              type="button" 
              className="btn-main btn-purple" 
              onClick={() => runPredictions(airData, floodData)}
              disabled={floodLoading}
            >
              <ShieldAlert size={18} /> {floodLoading ? 'AI Evaluating...' : 'Run Flood Risk Model'}
            </button>

            {/* AI Model Output Display */}
            {floodPrediction && (
              <div className="prediction-panel animate-fade-in">
                <div className="result-heading">Random Forest Classifier: Flood Hazard Probability</div>
                <div className="result-main-val">
                  {(floodPrediction.probability_high_risk * 100).toFixed(1)}%
                </div>
                <span className={`status-badge ${
                  floodPrediction.risk_label === 'Low Risk' ? 'status-good' : 'status-high'
                }`}>
                  <AlertTriangle size={14} /> Hazard Assessment: {floodPrediction.risk_label}
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
