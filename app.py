from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from google import genai
from google.genai import types
import os
import io
import json
import re
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from pypdf import PdfReader
import docx


# =====================================================
# LOAD ENVIRONMENT VARIABLES
# =====================================================

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)


# =====================================================
# FLASK APP
# =====================================================

app = Flask(__name__)

app.secret_key = os.getenv(
    "SECRET_KEY",
    "career_navigator_secret_key"
)


# =====================================================
# GEMINI CONFIGURATION & MULTI-MODEL FALLBACK
# =====================================================

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY not found in .env file"
    )

# New Google GenAI SDK Client
client = genai.Client(api_key=api_key)

# Resilient model priority chain - handles transient 503 UNAVAILABLE & demand spikes
MODELS_PRIORITY = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
]
MODEL_NAME = MODELS_PRIORITY[0]


def generate_ai_content(contents, max_retries_per_model=2, initial_backoff=1.0):
    """
    Generate content using Gemini with automatic multi-model fallback
    and exponential backoff retry for transient errors (503 UNAVAILABLE, 429, etc.).
    """
    last_error = None
    for model in MODELS_PRIORITY:
        for attempt in range(max_retries_per_model):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=contents
                )
                if response and hasattr(response, "text") and response.text:
                    return response.text
                elif response:
                    return ""
            except Exception as e:
                err_str = str(e)
                last_error = e
                # Check for transient errors like 503, 429, timeout, or high demand
                is_transient = any(code in err_str for code in [
                    "503", "429", "UNAVAILABLE", "RESOURCE_EXHAUSTED",
                    "temporarily unavailable", "high demand", "deadline", "timeout"
                ])
                print(f"[AI Fallback] Model '{model}' attempt {attempt + 1}/{max_retries_per_model} error: {err_str[:120]}")
                if is_transient and attempt < max_retries_per_model - 1:
                    sleep_time = initial_backoff * (2 ** attempt)
                    time.sleep(sleep_time)
                else:
                    # Cascade to the next model in MODELS_PRIORITY
                    break

    # If all models in the fallback cascade failed, re-raise the last exception
    raise last_error if last_error else RuntimeError("AI generation failed across all fallback models.")


# =====================================================
# HELPER FUNCTIONS
# =====================================================

def extract_text_from_file(file):
    """
    Extracts text from uploaded resume files (.pdf, .docx, .txt, images).
    If a PDF is scanned or image-based (yielding < 30 chars), it automatically
    invokes Gemini Multimodal OCR to extract text from the document.
    """
    filename = file.filename.lower()
    text = ""
    try:
        file.seek(0)
        raw_bytes = file.read()
        file.seek(0)

        if filename.endswith(".pdf"):
            # 1. Attempt native text extraction using pypdf
            try:
                reader = PdfReader(io.BytesIO(raw_bytes))
                for page in reader.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
            except Exception as pe:
                print("pypdf text extraction notice:", pe)

            # 2. Scanned / image-based PDF fallback: Canva designs, scanned resumes, etc.
            if not text or len(text.strip()) < 30:
                print(f"PDF contains minimal/no direct text streams ({len(text.strip())} chars). Using Gemini Multimodal OCR fallback...")
                try:
                    part = types.Part.from_bytes(data=raw_bytes, mime_type="application/pdf")
                    ocr_prompt = (
                        "Extract and transcribe all readable text, sections, education, work experience, "
                        "projects, contact info, and skills from this resume accurately in plain text."
                    )
                    text = generate_ai_content(contents=[part, ocr_prompt])
                except Exception as ocr_err:
                    print("Gemini PDF OCR fallback error:", ocr_err)

        elif filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(raw_bytes))
            text = "\n".join([p.text for p in doc.paragraphs if p.text])

        elif filename.endswith((".png", ".jpg", ".jpeg", ".webp")):
            # Direct image resume OCR support
            mime_type = "image/png" if filename.endswith(".png") else "image/jpeg"
            part = types.Part.from_bytes(data=raw_bytes, mime_type=mime_type)
            ocr_prompt = (
                "Extract and transcribe all readable text, sections, education, work experience, "
                "projects, contact info, and skills from this resume accurately in plain text."
            )
            text = generate_ai_content(contents=[part, ocr_prompt])

        else:
            text = raw_bytes.decode("utf-8", errors="ignore")

    except Exception as e:
        print("Error extracting text from file:", e)

    return text.strip() if text else ""


# =====================================================
# HOME PAGE
# =====================================================

@app.route("/")
def home():
    return render_template("index.html")


# =====================================================
# USER INFORMATION PAGE
# =====================================================

@app.route("/user-info")
def user_info():
    return render_template("user_info.html")


# =====================================================
# DASHBOARD
# =====================================================

@app.route("/dashboard", methods=["GET", "POST"])
def dashboard():
    if request.method == "POST":
        session["name"] = request.form.get("name")
        session["career"] = request.form.get("career")
        session["domain"] = request.form.get("domain")
        session["experience"] = request.form.get("experience")

    if "name" not in session:
        return redirect(url_for("user_info"))

    return render_template(
        "dashboard.html",
        name=session.get("name"),
        career=session.get("career"),
        domain=session.get("domain"),
        experience=session.get("experience")
    )


# =====================================================
# AI ROADMAP
# =====================================================

@app.route("/roadmap")
def roadmap():
    if "name" not in session:
        return redirect(url_for("user_info"))

    career = session.get("career")
    domain = session.get("domain")
    experience = session.get("experience")

    prompt = f"""
You are an expert career mentor.

Generate a detailed learning roadmap in clean HTML format.

Career: {career}
Domain: {domain}
Experience Level: {experience}

Requirements:

- Use only these HTML tags:
  <h2>, <h3>, <ul>, <li>, <p>, and <strong>.

- Organize the roadmap into clear learning phases.

For each phase include:

- Topics
- Important subtopics
- Recommended projects
- Estimated timeline

Also include:

- Interview preparation
- Resume suggestions
- Portfolio suggestions
- A realistic overall learning timeline

Make the roadmap practical and beginner-friendly.

Do not use:
- CSS
- JavaScript
- Tables
- Markdown

Return only HTML.
"""

    try:
        roadmap_data = generate_ai_content(contents=prompt)
    except Exception as e:
        roadmap_data = f"""
        <div class="ai-error-box glass">
            <div class="error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3>AI Service Temporarily Busy</h3>
            <p>Our AI engines are currently experiencing a brief spike in demand. Please try again.</p>
            <button onclick="window.location.reload()" class="btn btn-primary" style="margin-top: 15px;">
                <i class="fa-solid fa-rotate-right"></i> Retry Generation
            </button>
        </div>
        """

    return render_template(
        "roadmap.html",
        roadmap=roadmap_data,
        name=session.get("name"),
        career=career,
        domain=domain,
        experience=experience
    )


# =====================================================
# AI RESOURCES
# =====================================================

@app.route("/resources")
def resources():
    if "name" not in session:
        return redirect(url_for("user_info"))

    career = session.get("career")
    domain = session.get("domain")
    experience = session.get("experience")

    prompt = f"""
You are an expert career mentor.

Generate the best FREE learning resources in clean HTML format.

Career: {career}
Domain: {domain}
Experience Level: {experience}

Requirements:

- Use only these HTML tags:
  <h2>, <h3>, <ul>, <li>, <a>, and <p>.

- Provide real clickable links.
- Organize resources into clear categories.

Include:

1. Official Documentation
2. YouTube Playlists
3. Free Online Courses
4. GitHub Repositories
5. Coding Practice Platforms
6. Blogs and Articles
7. Interview Preparation Resources

For each resource provide:

- Resource name
- Short description
- Direct URL

Make the resources useful for the user's career,
domain, and experience level.

Do not use Markdown.

Return only HTML.
"""

    try:
        resources_data = generate_ai_content(contents=prompt)
    except Exception as e:
        resources_data = f"""
        <div class="ai-error-box glass">
            <div class="error-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3>AI Service Temporarily Busy</h3>
            <p>Our AI engines are currently handling heavy traffic. Please try again.</p>
            <button onclick="window.location.reload()" class="btn btn-primary" style="margin-top: 15px;">
                <i class="fa-solid fa-rotate-right"></i> Retry Loading Resources
            </button>
        </div>
        """

    return render_template(
        "resource.html",
        resources=resources_data,
        name=session.get("name"),
        career=career,
        domain=domain,
        experience=experience
    )


# =====================================================
# MOCK INTERVIEW
# =====================================================

@app.route("/mock-interview")
def mock_interview():
    if "name" not in session:
        return redirect(url_for("user_info"))
    return render_template(
        "mock_interview.html",
        name=session.get("name"),
        career=session.get("career"),
        domain=session.get("domain"),
        experience=session.get("experience")
    )


@app.route("/api/interview/start", methods=["POST"])
def interview_start():
    if "name" not in session:
        return jsonify({"error": "User session not found"}), 401
    career = session.get("career")
    domain = session.get("domain")
    experience = session.get("experience")

    prompt = f"""
You are an expert technical interviewer. Generate 5 interview questions tailored for:
Career: {career}
Domain: {domain}
Experience Level: {experience}

Return a strict JSON array of objects, with NO markdown surrounding it, containing exactly 5 questions.
Each object must have:
- "id": integer (1 to 5)
- "question": string (the interview question)
- "category": string (e.g. "Technical Core", "System / Practical Concept", "Behavioral / Problem Solving")

Return ONLY valid JSON array.
"""
    try:
        raw_text = generate_ai_content(contents=prompt).strip()
        cleaned_json = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
        questions = json.loads(cleaned_json)
        return jsonify({"questions": questions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/interview/evaluate", methods=["POST"])
def interview_evaluate():
    data = request.get_json() or {}
    question = data.get("question")
    user_answer = data.get("answer")
    career = session.get("career", "Professional")
    domain = session.get("domain", "General")
    experience = session.get("experience", "Intermediate")

    prompt = f"""
You are an AI Interviewer evaluating a candidate's response.
Career: {career} | Domain: {domain} | Experience: {experience}
Question: {question}
Candidate's Answer: {user_answer}

Evaluate the candidate's answer and return ONLY a valid JSON object with:
- "score": integer between 1 and 10
- "strengths": string summarizing what the candidate did well
- "improvements": string summarizing missing points or areas to improve
- "model_answer": string providing a clear, ideal sample response (2-4 sentences)

Return ONLY valid JSON object.
"""
    try:
        raw_text = generate_ai_content(contents=prompt).strip()
        cleaned_json = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
        evaluation = json.loads(cleaned_json)
        return jsonify(evaluation)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/interview/summary", methods=["POST"])
def interview_summary():
    data = request.get_json() or {}
    history = data.get("history", [])
    career = session.get("career", "Professional")
    domain = session.get("domain", "General")

    prompt = f"""
You are an expert interview coach. Below is a candidate's full mock interview performance history:
Career: {career} | Domain: {domain}
Q&A History: {json.dumps(history)}

Generate a summary report as a JSON object containing:
- "overall_score": float/int (average score out of 10)
- "grade": string (e.g. "Exceptional Readiness", "Solid Candidate", "Needs Practice")
- "summary_message": string (encouraging overview)
- "strengths": list of strings (3 key strengths observed)
- "recommendations": list of strings (3 key improvement recommendations)

Return ONLY clean JSON object.
"""
    try:
        raw_text = generate_ai_content(contents=prompt).strip()
        cleaned_json = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
        summary = json.loads(cleaned_json)
        return jsonify(summary)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================
# RESUME & LINKEDIN OPTIMIZER
# =====================================================

@app.route("/optimize")
def optimize():
    if "name" not in session:
        return redirect(url_for("user_info"))
    return render_template(
        "optimize.html",
        name=session.get("name"),
        career=session.get("career"),
        domain=session.get("domain"),
        experience=session.get("experience")
    )


@app.route("/api/resume/analyze", methods=["POST"])
def resume_analyze():
    if "resume_file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files["resume_file"]
    resume_text = extract_text_from_file(file)

    if not resume_text or len(resume_text) < 30:
        return jsonify({"error": "Could not extract text from file or file is empty."}), 400

    career = session.get("career", "Professional")
    domain = session.get("domain", "General")
    experience = session.get("experience", "Intermediate")

    prompt = f"""
You are an ATS (Applicant Tracking System) & Resume Optimization Expert.
Analyze this resume for a candidate targeting:
Career: {career} | Domain: {domain} | Level: {experience}

Resume Text:
{resume_text[:4000]}

Return a strict JSON object with:
- "ats_score": integer (0 to 100)
- "verdict": string (e.g. "Strong Match", "Needs Optimization", "High ATS Risk")
- "keywords_present": list of strings (found relevant domain keywords)
- "keywords_missing": list of strings (important domain keywords missing)
- "formatting_feedback": list of strings (3 feedback bullet points on structure, sections, readability)
- "content_suggestions": list of strings (3 actionable recommendations for bullet points & impact)

Return ONLY valid JSON.
"""
    try:
        raw_text = generate_ai_content(contents=prompt).strip()
        cleaned_json = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
        analysis = json.loads(cleaned_json)
        return jsonify(analysis)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/linkedin/optimize", methods=["POST"])
def linkedin_optimize():
    data = request.get_json() or {}
    headline = data.get("headline", "")
    about = data.get("about", "")
    skills = data.get("skills", "")
    profile_url = data.get("profile_url", "")
    career = session.get("career", "Professional")
    domain = session.get("domain", "General")

    prompt = f"""
You are a LinkedIn Profile Branding Specialist.
Optimize LinkedIn profile details for:
Target Career: {career} | Target Domain: {domain}
Current Headline: {headline}
Current About: {about}
Current Skills/Notes: {skills}
Profile Link: {profile_url}

Return a strict JSON object with:
- "headline_options": list of 3 strings (1: Keyword-Rich, 2: Value-Driven, 3: Creative / Punchy)
- "optimized_about": string (an engaging, structured About section with hook, skills, and call to action)
- "recommended_skills": list of 6-8 top in-demand skills to add to LinkedIn
- "profile_picture_tips": list of 4 practical tips for profile photo & background banner styling (lighting, framing, expression, background)

Return ONLY valid JSON.
"""
    try:
        raw_text = generate_ai_content(contents=prompt).strip()
        cleaned_json = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
        result = json.loads(cleaned_json)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================
# PROGRESS TRACKER
# =====================================================

@app.route("/progress")
def progress():
    if "name" not in session:
        return redirect(url_for("user_info"))
    return render_template(
        "progress.html",
        name=session.get("name"),
        career=session.get("career"),
        domain=session.get("domain"),
        experience=session.get("experience")
    )


@app.route("/api/progress/save", methods=["POST"])
def save_progress():
    data = request.get_json() or {}
    completed_topics = data.get("completed_topics", [])
    session["completed_topics"] = completed_topics
    return jsonify({"status": "success", "count": len(completed_topics)})


# =====================================================
# JOB & INTERNSHIP FEED
# =====================================================

@app.route("/jobs")
def jobs():
    if "name" not in session:
        return redirect(url_for("user_info"))
    return render_template(
        "jobs.html",
        name=session.get("name"),
        career=session.get("career"),
        domain=session.get("domain"),
        experience=session.get("experience")
    )


@app.route("/api/jobs/fetch", methods=["POST"])
def jobs_fetch():
    career = session.get("career", "Software Engineer")
    domain = session.get("domain", "Technology")
    experience = session.get("experience", "Entry Level")

    prompt = f"""
You are a career portal engine. Generate 6 realistic, highly relevant job & internship listings for:
Target Career: {career}
Domain: {domain}
Experience Level: {experience}

Return a strict JSON array of objects, each containing:
- "id": integer (1 to 6)
- "title": string (job title)
- "company": string (reputable company name)
- "location": string (e.g. "Remote", "New York, NY", "San Francisco, CA / Hybrid")
- "job_type": string ("Full-Time" or "Internship")
- "match_score": integer (e.g. 94)
- "salary": string (e.g. "$70,000 - $90,000 / year" or "$35 - $45 / hr Internship")
- "description": string (short 2-sentence role overview)
- "tags": list of 3-4 skill strings
- "apply_url": string (search link like "https://www.linkedin.com/jobs/search/?keywords=...")

Return ONLY clean JSON array.
"""
    try:
        raw_text = generate_ai_content(contents=prompt).strip()
        cleaned_json = re.sub(r"^```json\s*|^```\s*|\s*```$", "", raw_text, flags=re.MULTILINE).strip()
        jobs_data = json.loads(cleaned_json)
        return jsonify({"jobs": jobs_data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# =====================================================
# FEEDBACK SYSTEM
# =====================================================

FEEDBACK_FILE = Path(__file__).resolve().parent / "data" / "feedbacks.json"


def load_feedbacks():
    if not FEEDBACK_FILE.exists():
        return []
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("Error loading feedbacks:", e)
        return []


def save_feedbacks_data(feedbacks):
    try:
        FEEDBACK_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump(feedbacks, f, indent=2)
        return True
    except Exception as e:
        print("Error saving feedbacks:", e)
        return False


def calculate_feedback_stats(feedbacks):
    if not feedbacks:
        return {
            "average_rating": 5.0,
            "total_reviews": 0,
            "recommend_percent": 100,
            "stars_count": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
            "stars_percent": {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        }
    total = len(feedbacks)
    avg = sum(f.get("rating", 5) for f in feedbacks) / total
    recommends = sum(1 for f in feedbacks if f.get("recommend", True))
    rec_pct = round((recommends / total) * 100)

    stars_count = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    for f in feedbacks:
        r = int(f.get("rating", 5))
        if 1 <= r <= 5:
            stars_count[r] = stars_count.get(r, 0) + 1

    stars_pct = {k: round((v / total) * 100) for k, v in stars_count.items()}

    return {
        "average_rating": round(avg, 1),
        "total_reviews": total,
        "recommend_percent": rec_pct,
        "stars_count": stars_count,
        "stars_percent": stars_pct
    }


@app.route("/feedback")
def feedback():
    feedbacks = load_feedbacks()
    stats = calculate_feedback_stats(feedbacks)
    return render_template(
        "feedback.html",
        feedbacks=feedbacks,
        stats=stats,
        name=session.get("name", ""),
        career=session.get("career", ""),
        domain=session.get("domain", "")
    )


@app.route("/api/feedback/submit", methods=["POST"])
def feedback_submit():
    data = request.get_json() or {}
    name = (data.get("name") or session.get("name") or "Anonymous").strip()
    career = (data.get("career") or session.get("career") or "Aspiring Professional").strip()
    category = data.get("category", "General Platform")
    message = (data.get("message") or "").strip()

    try:
        rating = int(data.get("rating", 5))
        if rating < 1 or rating > 5:
            rating = 5
    except (ValueError, TypeError):
        rating = 5

    recommend = bool(data.get("recommend", True))

    if not message:
        return jsonify({"error": "Please provide a feedback message."}), 400

    new_entry = {
        "id": int(datetime.now().timestamp() * 1000),
        "name": name,
        "career": career,
        "rating": rating,
        "category": category,
        "message": message,
        "recommend": recommend,
        "date": datetime.now().strftime("%Y-%m-%d")
    }

    feedbacks = load_feedbacks()
    feedbacks.insert(0, new_entry)
    save_feedbacks_data(feedbacks)
    stats = calculate_feedback_stats(feedbacks)

    return jsonify({
        "status": "success",
        "message": "Thank you for sharing your feedback!",
        "feedback": new_entry,
        "stats": stats
    })


@app.route("/api/feedback/list", methods=["GET"])
def feedback_list():
    feedbacks = load_feedbacks()
    stats = calculate_feedback_stats(feedbacks)
    return jsonify({
        "feedbacks": feedbacks,
        "stats": stats
    })


# =====================================================
# RESET SESSION
# =====================================================

@app.route("/reset")
def reset():
    session.clear()
    return redirect(url_for("home"))


# =====================================================
# RUN APPLICATION
# =====================================================

if __name__ == "__main__":
    app.run(debug=True)