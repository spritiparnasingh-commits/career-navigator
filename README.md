# 🚀 Career Navigator

**Career Navigator** is an AI-powered web application built with **Flask** and powered by **Google Gemini 3.6 Flash**. It provides personalized, step-by-step career learning roadmaps and curated free learning resources tailored to an individual's target role, domain, and experience level.

---

## ✨ Features

- 🎯 **Tailored Career Profiling**: Collects user-specific career goals, target domains, and current experience levels.
- 🗺️ **AI-Generated Roadmaps**: Produces comprehensive learning roadmaps with structured phases, subtopics, recommended projects, estimated timelines, resume advice, and interview preparation steps.
- 📚 **Curated Learning Resources**: Generates real, clickable links to official documentation, YouTube playlists, free online courses, GitHub repositories, and coding practice platforms.
- 📊 **Interactive Dashboard**: Clean user portal allowing seamless switching between personalized roadmaps and resources.
- 🔄 **Session Reset**: Easily clear current profile data and start a new career assessment.

---

## 🛠️ Tech Stack

- **Backend**: Python, [Flask](https://flask.palletsprojects.com/)
- **AI Engine**: [Google GenAI SDK](https://pypi.org/project/google-genai/) (`google-genai`), model: `gemini-3.6-flash`
- **Frontend**: HTML5, Jinja2 Templates, Custom CSS3, JavaScript
- **Environment Management**: `python-dotenv`

---

## 📁 Project Structure

```
Career Navigator/
├── app.py              # Main Flask application & Gemini API integration
├── requirements.txt    # Python dependencies
├── .env                # Environment variables (API Key & Secret Key)
├── static/
│   ├── css/
│   │   └── style.css   # Main stylesheet
│   ├── images/         # Image assets
│   └── js/             # Client-side JavaScript
└── templates/
    ├── base.html       # Base HTML template layout
    ├── index.html      # Landing / Home page
    ├── user_info.html  # Profile input form
    ├── dashboard.html # User dashboard
    ├── roadmap.html   # AI Learning Roadmap view
    └── resource.html  # AI Curated Resources view
```

---

## 🚀 Getting Started

Follow these instructions to get a local copy of Career Navigator up and running.

### 📋 Prerequisites

- **Python 3.9+** installed on your system.
- A **Google Gemini API Key**. You can obtain one from the [Google AI Studio](https://aistudio.google.com/).

### 💻 Installation & Setup

1. **Clone the repository** (or download the project source):
   ```bash
   git clone https://github.com/your-username/career-navigator.git
   cd career-navigator
   ```

2. **Create and activate a virtual environment**:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Install the dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**:
   Create a `.env` file in the root directory (or edit the existing one) with the following content:
   ```env
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   SECRET_KEY=your_optional_flask_secret_key
   ```

5. **Run the Application**:
   ```bash
   python app.py
   ```

6. **Access the App**:
   Open your browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```

---

## 📖 How It Works

1. **Get Started**: Visit the homepage (`/`) and click on **Get Started**.
2. **Fill Profile**: Input your Name, Target Career (e.g., *Full Stack Developer*), Domain (e.g., *Web Development*), and Experience Level (e.g., *Beginner*).
3. **Explore Dashboard**: View your personalized dashboard summarizing your selections.
4. **Generate Roadmap**: Click **View Roadmap** to have Gemini generate a structured HTML roadmap.
5. **Discover Resources**: Click **View Resources** to receive hand-picked links to courses, documentation, repositories, and interview practice tools.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
