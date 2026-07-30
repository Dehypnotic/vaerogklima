import json
import time
from datetime import datetime
import requests

INPUT_FIL = "kommuner_koordinater.json"
NOWCAST_URL = "https://api.met.no/weatherapi/nowcast/2.0/complete"

# --- HUSK Å SETTE INN DINE DETALJER FRA JSONBIN.IO HER ---
JSONBIN_BIN_ID = "6a6bacc4f5f4af5e29d748d2"
JSONBIN_API_KEY = "$2a$10$RKrUENVnz7CG/bSnyRnJcelPjzvDj7iTTHRnW.LmZ9zJQ26OchS3K"
# --------------------------------------------------------

HEADERS = {
    "User-Agent": "KommuneVaerToppliste/1.0 (kontakt: dehypnotic@outlook.com)"
}

try:
    with open(INPUT_FIL, "r", encoding="utf-8") as f:
        kommuner = json.load(f)
except FileNotFoundError:
    print(f"❌ FEIL: Fant ikke filen '{INPUT_FIL}'!")
    exit()

vaer_data = []
print(f"🚀 Starter datahenting for {len(kommuner)} kommuner via GitHub Actions...")

for i, kommune in enumerate(kommuner):
    if "svalbard" in kommune["kommune"].lower() or "jan mayen" in kommune["kommune"].lower():
        continue

    params = {"lat": kommune["lat"], "lon": kommune["lon"]}
    try:
        response = requests.get(NOWCAST_URL, params=params, headers=HEADERS)
        if response.status_code == 200:
            data = response.json()
            timeseries = data["properties"]["timeseries"]
            
            if len(timeseries) > 0:
                details = timeseries[0]["data"]["instant"]["details"]
                
                regn = 0.0
                if "next_1_hours" in timeseries[0]["data"]:
                    regn = timeseries[0]["data"]["next_1_hours"]["details"].get("precipitation_amount", 0.0)
                    
                vaer_data.append({
                    "navn": kommune["kommune"],
                    "fylke": kommune["fylke"],
                    "temp": details.get("air_temperature", -999),
                    "vind": details.get("wind_speed", 0),
                    "regn": regn
                })
    except Exception:
        continue
        
    time.sleep(0.1)

gyldige_data = [k for k in vaer_data if k["temp"] != -999]

# Hvis listen er tom, tvinger vi skriptet til å krasje så det SKINNER RØDT i GitHub Actions
if not gyldige_data:
    print(f"❌ KRITISK FEIL: Listen med værdata ble helt tom!")
    print(f"Sjekket totalt {len(kommuner)} kommuner fra filen.")
    if len(kommuner) == 0:
        print(f"Bane brukt: {INPUT_FIL}")
        print(f"Filer i mappen: {os.listdir(BASE_DIR) if os.path.exists(BASE_DIR) else 'Fant ikke mappen'}")
    exit(1) # Tvinger GitHub til å vise rød feilmelding

# Hvis alt er i orden, fortsetter vi som planlagt:
alle_varmest = sorted(gyldige_data, key=lambda x: x["temp"], reverse=True)
alle_kaldest = sorted(gyldige_data, key=lambda x: x["temp"])
alle_vaatest = sorted(gyldige_data, key=lambda x: x["regn"], reverse=True)
alle_vind    = sorted(gyldige_data, key=lambda x: x["vind"], reverse=True)

resultat = {
    "sist_oppdatert": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "varmest": alle_varmest[:10],
    "kaldest": alle_kaldest[:10],
    "vaatest": alle_vaatest[:10],
    "mest_vind": alle_vind[:10],
    "alle_kommuner": alle_varmest
}

url = f"https://jsonbin.io{JSONBIN_BIN_ID}"
headers = {
    "Content-Type": "application/json",
    "X-Master-key": JSONBIN_API_KEY,
    "X-Bin-Versioning": "false"
}

res = requests.put(url, json=resultat, headers=headers)
if res.status_code == 200:
    print("✅ SUKSESS! Værdataene ble overskrevet og lagret i skyen hos JSONBin.io!")
else:
    print(f"❌ FEIL FRA JSONBIN: Status {res.status_code}. Melding: {res.text}")
    exit(1)

