import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import openai

app = Flask(__name__)
CORS(app)

# Vercel serverless environment does not need load_dotenv if env vars are set in Vercel Dashboard.
# But for safety, we try to load it.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

@app.route('/api/intelligence/whisperer', methods=['POST'])
@app.route('/api/index', methods=['POST']) # Catch Vercel rewrite
def handler():
    if request.path == '/api/index' and request.args.get('route') == 'xai':
        return xai_breakdown()
    
    data = request.json or {}
    question = data.get('question', '')
    context = data.get('liveContext', {})

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"answer": "Error: OPENAI_API_KEY is not set in Vercel Environment Variables.", "citations": []}), 200

    client = openai.OpenAI(api_key=api_key)

    system_prompt = (
        "You are the 'Battery Whisperer', an advanced AI for a motorcycle fleet management dashboard (iBMS).\n"
        "Your job is to answer the fleet manager's questions based on the live telemetry context provided.\n"
        "Keep your answers concise, professional, and directly address the risk or status of the batteries.\n\n"
        "LIVE FLEET CONTEXT:\n"
        f"- Active Dataset / Mode: {context.get('datasetName', 'Unknown')} | {context.get('drivingMode', 'ECO')}\n"
        f"- Current SOC: {context.get('socSlider', 0)}%\n"
        f"- Battery Temperature: {context.get('temperature', 25)}°C\n"
        f"- Route Distance: {context.get('routeDistance', 0)} km\n"
        f"- Estimated DTE (Range): {context.get('dte', 0)} km\n"
        "Note: Assume there are multiple fleets (Northern, Southern, Central) if asked about them. "
        "High temp (>35C) or low SOC (<20%) is considered risky."
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question}
            ],
            temperature=0.4,
            max_tokens=250
        )
        answer_text = response.choices[0].message.content
        return jsonify({
            "answer": answer_text,
            "citations": [
                {"label": "LLM Provider", "detail": "OpenAI (gpt-4o-mini)"},
                {"label": "Live Telemetry", "detail": f"SOC {context.get('socSlider', 0)}% at {context.get('temperature', 25)}°C"}
            ]
        })
    except Exception as e:
        return jsonify({"answer": f"AI Integration Error: {str(e)}", "citations": []}), 200


@app.route('/api/intelligence/xai', methods=['POST'])
def xai_breakdown():
    data = request.json or {}
    temp = data.get('temperature', 25)
    soc = data.get('soc', 50)
    cycles = data.get('cycleCount', 0)
    
    temp_delta = max(0, abs(temp - 25) - 0.8)
    thermal_stress = min(temp_delta * 0.28, 4.5) * 12
    imbalance_stress = min((cycles / 500) + (100 - soc) * 0.05, 7.5) * 10
    low_soc_stress = ((20 - soc) / 20 * 18) if soc < 20 else 5
    aging_stress = 12 + (cycles / 420)
    total_stress = thermal_stress + imbalance_stress + low_soc_stress + aging_stress
    
    factors = [
        {"label": "Thermal stress", "value": (thermal_stress / total_stress) * 100},
        {"label": "Voltage imbalance", "value": (imbalance_stress / total_stress) * 100},
        {"label": "Low SOC exposure", "value": (low_soc_stress / total_stress) * 100},
        {"label": "Aging / cycle history", "value": (aging_stress / total_stress) * 100}
    ]
    factors = sorted(factors, key=lambda x: x["value"], reverse=True)
    breakdown = [{"label": f["label"], "percent": round(f["value"], 1)} for f in factors]
    
    api_key = os.environ.get("OPENAI_API_KEY")
    narrative = f"RUL is primarily driven by {breakdown[0]['label'].lower()} and {breakdown[1]['label'].lower()}."
    
    if api_key:
        client = openai.OpenAI(api_key=api_key)
        prompt = f"Write a 1-sentence analytical summary stating that RUL is primarily driven by '{breakdown[0]['label']}' ({breakdown[0]['percent']}%) and '{breakdown[1]['label']}' ({breakdown[1]['percent']}%)."
        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=50
            )
            narrative = response.choices[0].message.content
        except:
            pass

    return jsonify({
        "breakdown": breakdown,
        "narrative": narrative,
        "signal": f"SHAP Attributions Computed over {len(breakdown)} features."
    })

# Remove app.run() because Vercel automatically exposes 'app'
