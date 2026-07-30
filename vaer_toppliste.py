import json
import time
from datetime import datetime
import requests

INPUT_FIL = "kommuner_koordinater.json"
OUTPUT_FIL = "docs/toppliste.json"
NOWCAST_URL = "https://api.met.no/weatherapi/nowcast/2.0/complete"

# Din ferdigutfylte User-Agent for MET API-et
HEADERS = {
    "User-Agent": "KommuneVaerToppliste/1.0 (kontakt: dehypnotic@outlook.com)"
}

try:
    with open(INPUT_FIL, "r", encoding="utf-8") as f:
        kommuner = json.load(f)
except FileNotFoundError:
    print(f"❌ FEIL: Fant ikke filen '{INPUT_FIL}' i mappen din!")
    exit()

vaer_data = []
print(f"🚀 Starter datahenting for {len(kommuner)} kommuner (Svalbard/Jan Mayen ekskludert)...")

for i, kommune in enumerate(kommuner):
    # Hopper over arktiske områder for å unngå 422-feil og skjevheter i listene
    if "svalbard" in kommune["kommune"].lower() or "jan mayen" in kommune["kommune"].lower():
        continue

    params = {"lat": kommune["lat"], "lon": kommune["lon"]}
    try:
        response = requests.get(NOWCAST_URL, params=params, headers=HEADERS)
        
        if response.status_code == 200:
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
                    "temp": details.get("air_temperature", -999),
                    "vind": details.get("wind_speed", 0),
                    "regn": regn
                })
        else:
            print(f"⚠️ API-feil for {kommune['kommune']}: Statuskode {response.status_code}")
            
    except Exception as e:
        print(f"❌ Teknisk feil ved henting av {kommune['kommune']}: {e}")
        
    if (i + 1) % 50 == 0:
        print(f"Progress: {i + 1}/{len(kommuner)} kommuner sjekket...")
        
    time.sleep(0.2)

print(f"\nHenting ferdig. Fant data for {len(vaer_data)} av {len(kommuner)} kommuner.")

gyldige_data = [k for k in vaer_data if k["temp"] != -999]

if not gyldige_data:
    print("❌ FEIL: Listen med gyldige værdata er helt tom. Ingen filer ble lagret.")
    exit()

# Sorterer ut Topp 10
topp_varmest = sorted(gyldige_data, key=lambda x: x["temp"], reverse=True)[:10]
topp_kaldest = sorted(gyldige_data, key=lambda x: x["temp"])[:10]
topp_vaatest = sorted(gyldige_data, key=lambda x: x["regn"], reverse=True)[:10]
topp_vind    = sorted(gyldige_data, key=lambda x: x["vind"], reverse=True)[:10]

# Skriv ut resultatet i terminalen
print("\n🏆 ====================================================== 🏆")
print("             SANNTIDS VÆRTOPPLISTE (TOPP 10)              ")
print("🏆 ====================================================== 🏆\n")

print("☀️ TOPP 10 VARMEST:")
for nr, k in enumerate(topp_varmest, 1):
    print(f"  {nr:2d}. {k['navn']:<20} {k['temp']:>5} °C")
    
print("\n❄️ TOPP 10 KALDEST:")
for nr, k in enumerate(topp_kaldest, 1):
    print(f"  {nr:2d}. {k['navn']:<20} {k['temp']:>5} °C")
    
print("\n🌧️ TOPP 10 VÅTEST (NESTE TIME):")
for nr, k in enumerate(topp_vaatest, 1):
    print(f"  {nr:2d}. {k['navn']:<20} {k['regn']:>5} mm")
    
print("\n💨 TOPP 10 MEST VIND:")
for nr, k in enumerate(topp_vind, 1):
    print(f"  {nr:2d}. {k['navn']:<20} {k['vind']:>5} m/s")
    
print("\n==========================================================")

# Strukturere og lagre til JSON-filen
resultat = {
    "sist_oppdatert": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "varmest": topp_varmest,
    "kaldest": topp_kaldest,
    "vaatest": topp_vaatest,
    "mest_vind": topp_vind
}

with open(OUTPUT_FIL, "w", encoding="utf-8") as f:
    json.dump(resultat, f, ensure_ascii=False, indent=4)
    
print(f"\n✅ SUKSESS! '{OUTPUT_FIL}' ble opprettet i mappen din uten Svalbard/Jan Mayen.")
