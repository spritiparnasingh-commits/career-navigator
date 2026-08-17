from flask import Flask, render_template, request, redirect, url_for, session
from google import genai
import os
from pathlib import Path
from dotenv import load_dotenv


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
# GEMINI CONFIGURATION
# =====================================================

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY not found in .env file"
    )

# New Google GenAI SDK
client = genai.Client(api_key=api_key)

# Current Gemini model
MODEL_NAME = "gemini-3.6-flash"


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

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )

        roadmap_data = response.text


    except Exception as e:

        roadmap_data = f"""
        <div class="placeholder">

            <h3>AI Error</h3>

            <p>{e}</p>

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

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )

        resources_data = response.text


    except Exception as e:

        resources_data = f"""
        <div class="placeholder">

            <h3>AI Error</h3>

            <p>{e}</p>

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