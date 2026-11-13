const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const WEATHER_CODES = {
    0: { desc: 'Clear Sky', icon: '☀️' },
    1: { desc: 'Mainly Clear', icon: '🌤️' },
    2: { desc: 'Partly Cloudy', icon: '⛅' },
    3: { desc: 'Overcast', icon: '☁️' },
    45: { desc: 'Fog', icon: '🌫️' },
    48: { desc: 'Depositing Rime Fog', icon: '🌫️' },
    51: { desc: 'Light Drizzle', icon: '🌦️' },
    53: { desc: 'Moderate Drizzle', icon: '🌦️' },
    55: { desc: 'Dense Drizzle', icon: '🌧️' },
    61: { desc: 'Slight Rain', icon: '🌦️' },
    63: { desc: 'Moderate Rain', icon: '🌧️' },
    65: { desc: 'Heavy Rain', icon: '⛈️' },
    71: { desc: 'Slight Snowfall', icon: '🌨️' },
    73: { desc: 'Moderate Snowfall', icon: '❄️' },
    75: { desc: 'Heavy Snowfall', icon: '❄️' },
    80: { desc: 'Slight Rain Showers', icon: '🌦️' },
    81: { desc: 'Moderate Rain Showers', icon: '🌧️' },
    82: { desc: 'Violent Rain Showers', icon: '⛈️' },
    95: { desc: 'Thunderstorm', icon: '⛈️' },
    96: { desc: 'Thunderstorm with Hail', icon: '⛈️' },
    99: { desc: 'Heavy Thunderstorm with Hail', icon: '⛈️' }
};

// Live Autocomplete Suggestions API (No token required)
app.get('/api/suggest', async (req, res) => {
    const query = req.query.q || '';
    if (query.length < 2) return res.json([]);

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`);
        const geoData = await geoRes.json();
        
        if (geoData.results) {
            const suggestions = geoData.results.map(loc => ({
                name: loc.name,
                admin1: loc.admin1 || '',
                country: loc.country || ''
            }));
            return res.json(suggestions);
        }
        res.json([]);
    } catch (err) {
        res.json([]);
    }
});

// Main Route
app.get('/', async (req, res) => {
    const city = req.query.city || 'Kolkata';
    let weatherData = null;
    let locationData = null;
    let errorMessage = null;

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
            errorMessage = `City "${city}" not found. Please select a valid place from suggestions.`;
        } else {
            const loc = geoData.results[0];
            locationData = {
                name: loc.name,
                country: loc.country,
                admin1: loc.admin1 || '',
                elevation: loc.elevation ?? 0
            };

            const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
            const wData = await weatherRes.json();
            const curr = wData.current;
            const codeInfo = WEATHER_CODES[curr.weather_code] || { desc: 'Unknown', icon: '🌡️' };

            weatherData = {
                temp: Math.round(curr.temperature_2m),
                feels_like: Math.round(curr.apparent_temperature),
                humidity: curr.relative_humidity_2m,
                wind_speed: curr.wind_speed_10m,
                desc: codeInfo.desc,
                icon: codeInfo.icon
            };
        }
    } catch (err) {
        errorMessage = 'Server error while fetching weather records.';
    }

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Fetch App</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { min-height: 100vh; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); display: flex; justify-content: center; align-items: center; padding: 20px; color: #ffffff; }
        .container { width: 100%; max-width: 480px; background: rgba(255, 255, 255, 0.12); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 20px; padding: 30px 24px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3); }
        .app-header { text-align: center; margin-bottom: 24px; }
        .app-header h1 { font-size: 1.8rem; font-weight: 700; }
        .app-header p { font-size: 0.9rem; color: #cbd5e1; margin-top: 4px; }
        
        .search-container { position: relative; margin-bottom: 20px; }
        .search-box { display: flex; gap: 10px; }
        .search-box input { flex: 1; padding: 12px 16px; border: none; border-radius: 12px; background: rgba(255, 255, 255, 0.9); color: #0f172a; font-size: 1rem; outline: none; }
        .search-box input:focus { box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.5); }
        .search-box button { padding: 12px 20px; border: none; border-radius: 12px; background: #38bdf8; color: #0f172a; font-weight: 600; font-size: 1rem; cursor: pointer; transition: background 0.2s ease; }
        .search-box button:hover { background: #7dd3fc; }

        .suggestions-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            margin-top: 6px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 99;
            display: none;
        }
        .suggestion-item {
            padding: 10px 16px;
            cursor: pointer;
            font-size: 0.95rem;
            color: #e2e8f0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .suggestion-item:hover {
            background: rgba(56, 189, 248, 0.2);
            color: #ffffff;
        }

        .error-box { background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.6); color: #fecaca; padding: 12px 16px; border-radius: 12px; text-align: center; margin-bottom: 16px; }
        .weather-card { text-align: center; }
        .location-info h2 { font-size: 1.6rem; font-weight: 700; }
        .location-info span { font-size: 0.9rem; color: #cbd5e1; }
        .temp-section { margin: 24px 0; }
        .weather-icon { font-size: 4rem; line-height: 1; margin-bottom: 8px; }
        .temp-value { font-size: 3.5rem; font-weight: 800; line-height: 1; }
        .temp-value .unit { font-size: 1.8rem; font-weight: 500; vertical-align: super; }
        #weather-desc { font-size: 1.1rem; color: #e2e8f0; margin-top: 8px; text-transform: capitalize; }
        .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 20px; }
        .detail-item { background: rgba(255, 255, 255, 0.08); padding: 14px; border-radius: 14px; display: flex; flex-direction: column; gap: 4px; }
        .detail-item .label { font-size: 0.8rem; color: #cbd5e1; }
        .detail-item .value { font-size: 1.15rem; font-weight: 600; }
        @media (max-width: 480px) { .container { padding: 22px 16px; } .search-box { flex-direction: column; } .search-box button { width: 100%; } }
    </style>
</head>
<body>
    <main class="container">
        <header class="app-header">
            <h1>Weather Fetch</h1>
            <p>Token-Free Open Weather API</p>
        </header>

        <form action="/" method="GET" class="search-container" id="search-form">
            <div class="search-box">
                <input type="text" name="city" id="city-input" value="${city}" placeholder="Type place name..." required autocomplete="off">
                <button type="submit">Search</button>
            </div>
            <div id="suggestions" class="suggestions-dropdown"></div>
        </form>

        ${errorMessage ? `<div class="error-box">${errorMessage}</div>` : ''}

        ${weatherData && locationData ? `
        <section class="weather-card">
            <div class="location-info">
                <h2>${locationData.name}</h2>
                <span>${locationData.admin1 ? locationData.admin1 + ', ' : ''}${locationData.country}</span>
            </div>
            <div class="temp-section">
                <div class="weather-icon">${weatherData.icon}</div>
                <div class="temp-value"><span>${weatherData.temp}</span><span class="unit">°C</span></div>
                <p id="weather-desc">${weatherData.desc}</p>
            </div>
            <div class="details-grid">
                <div class="detail-item"><span class="label">Feels Like</span><span class="value">${weatherData.feels_like}°C</span></div>
                <div class="detail-item"><span class="label">Humidity</span><span class="value">${weatherData.humidity}%</span></div>
                <div class="detail-item"><span class="label">Wind Speed</span><span class="value">${weatherData.wind_speed} km/h</span></div>
                <div class="detail-item"><span class="label">Elevation</span><span class="value">${locationData.elevation} m</span></div>
            </div>
        </section>` : ''}
    </main>

    <script>
        const input = document.getElementById('city-input');
        const dropdown = document.getElementById('suggestions');

        input.addEventListener('input', async function() {
            const query = this.value.trim();
            if (query.length < 2) {
                dropdown.style.display = 'none';
                return;
            }

            try {
                const res = await fetch(\`/api/suggest?q=\${encodeURIComponent(query)}\`);
                const places = await res.json();

                if (places.length > 0) {
                    dropdown.innerHTML = '';
                    places.forEach(place => {
                        const div = document.createElement('div');
                        div.className = 'suggestion-item';
                        div.textContent = place.admin1 ? \`\${place.name}, \${place.admin1}, \${place.country}\` : \`\${place.name}, \${place.country}\`;
                        
                        div.addEventListener('click', () => {
                            input.value = place.name;
                            dropdown.style.display = 'none';
                            document.getElementById('search-form').submit();
                        });
                        dropdown.appendChild(div);
                    });
                    dropdown.style.display = 'block';
                } else {
                    dropdown.style.display = 'none';
                }
            } catch (err) {
                dropdown.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                dropdown.style.display = 'none';
            }
        });
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});