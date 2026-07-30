import os
import json
import time
from datetime import datetime
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FIL = os.path.join(BASE_DIR, "kommuner_koordinater.json")
NOWCAST_URL = "https://api.met.no/weatherapi/nowcast/2.0/complete"

# Dine ferdigutfylte detaljer for JSONBin.io
JSONBIN_BIN_ID = "6a6bacc4f5f4af5e29d748d2"
JSONBIN_API_KEY = "$2a$10$RKrUENVnz7CG/bSnyRnJcelPjzvDj7iTTHRnW.LmZ9zJQ26OchS3K"

HEADERS = {
    "User-Agent": "KommuneVaerTopplisteApp/2.0 dehypnotic@outlook.com"
}

if not os.path.exists(INPUT_FIL):
    print(f"❌ KRITISK FEIL: Fant ikke koordinatfilen i mappen!")
    exit(1)

try:
    with open(INPUT_FIL, "r", encoding="utf-8") as f:
        kommuner = json.load(f)
except Exception as e:
    print(f"❌ KRITISK FEIL: Kunne ikke lese JSON-filen: {e}")
    exit(1)

vaer_data = []
forste_feil_skrevet = False

print(f"🚀 Starter datahenting for {len(kommuner)} kommuner via GitHub Actions...")

for i, kommune in enumerate(kommuner):
    if not kommune.get("kommune") or "svalbard" in kommune["kommune"].lower() or "jan mayen" in kommune["kommune"].lower():
        continue

    try:
        lat_float = float(kommune["lat"])
        lon_float = float(kommune["lon"])
    except (ValueError, TypeError):
        continue

    params = {
        "lat": f"{lat_float:.4f}", 
        "lon": f"{lon_float:.4f}"
    }
    
    try:
        response = requests.get(NOWCAST_URL, params=params, headers=HEADERS, timeout=5)
        
        if response.status_code == 200:
            if not response.text or response.text.strip() == "":
                continue
                
            data = response.json()
            timeseries = data["properties"]["timeseries"]
            
            if len(timeseries) > 0:
                gjeldende_varsel = timeseries[0]
                details = gjeldende_varsel["data"]["instant"]["details"]
                
                regn = 0.0
                if "next_1_hours" in gjeldende_varsel["data"]:
                    regn = gjeldende_varsel["data"]["next_1_hours"]["details"].get("precipitation_amount", 0.0)
                    
                vaer_data.append({
                    "navn": kommune["kommune"],
                    "fylke": kommune["fylke"],
                    "temp": details.get("air_temperature", -999),
                    "vind": details.get("wind_speed", 0),
                    "regn": regn
                })
        else:
            if not forste_feil_skrevet:
                print(f"⚠️ API-avvisning for {kommune['kommune']}: Statuskode {response.status_code}.")
                forste_feil_skrevet = True
    except Exception as e:
        if not forste_feil_skrevet:
            print(f"❌ Teknisk feil under utlesing for {kommune['kommune']}: {str(e)}")
            forste_feil_skrevet = True
        continue
        
    time.sleep(0.1)

gyldige_data = [k for k in vaer_data if k["temp"] != -999]

if not gyldige_data:
    print(f"❌ KRITISK FEIL: Listen med værdata ble helt tom!")
    exit(1)

# Sortering
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

# DEN RIKTIGE OG OFFISIELLE ENDEPUNKT-URL-EN TIL JSONBIN:
url = f"https://api.jsonbin.io/v3/b/{JSONBIN_BIN_ID}"

headers = {
    "Content-Type": "application/json",
    "X-Master-key": JSONBIN_API_KEY,
    "X-Bin-Versioning": "false"
}

print("📤 Sender data over til JSONBin.io...")
res = requests.put(url, json=resultat, headers=headers)

if res.status_code == 200:
    print("✅ SUKSESS! Værdataene ble overskrevet og lagret i skyen hos JSONBin.io!")
else:
    print(f"❌ FEIL FRA JSONBIN: Status {res.status_code}. Melding: {res.text}")
    exit(1)
