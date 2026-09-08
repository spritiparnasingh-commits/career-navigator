/*====================================================
    CAREER NAVIGATOR - MAIN SCRIPT.JS
======================================================*/

document.addEventListener("DOMContentLoaded", function () {
    console.log("Career Navigator Loaded Successfully");

    // Initialize Dashboard Widget if present
    initDashboardWidget();

    // Auto load jobs if on jobs page
    if (document.getElementById("jobs-grid")) {
        loadJobFeed();
    }

    // Auto init progress tracker if on progress page
    if (document.getElementById("progress-topics-container")) {
        initProgressTrackerPage();
    }
});


// =====================================================
// USER INFORMATION FORM VALIDATION
// =====================================================

const userForm = document.querySelector(".form-card form");

if (userForm) {
    userForm.addEventListener("submit", function (event) {
        const name = document.getElementById("name");
        const career = document.getElementById("career");
        const domain = document.getElementById("domain");
        const experience = document.getElementById("experience");

        if (
            !name.value.trim() ||
            !career.value.trim() ||
            !domain.value.trim() ||
            !experience.value
        ) {
            event.preventDefault();
            alert("Please fill in all required fields.");
            return;
        }

        const submitButton = userForm.querySelector("button[type='submit']");
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> Generating Setup...";
        }
    });
}


// =====================================================
// 1. MOCK INTERVIEW LOGIC (TEXT & VOICE)
// =====================================================

let interviewQuestions = [];
let currentQuestionIndex = 0;
let interviewHistory = [];
let recognition = null;
let isRecording = false;

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Web Speech API is not supported in this browser.");
        const micBtn = document.getElementById("btn-mic");
        if (micBtn) {
            micBtn.disabled = true;
            document.getElementById("mic-label").innerText = "Voice Unavailable";
        }
        return false;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = function (event) {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        const answerInput = document.getElementById("user-answer-input");
        if (answerInput) {
            answerInput.value = transcript;
        }
    };

    recognition.onerror = function (event) {
        console.error("Speech Recognition Error:", event.error);
        stopVoiceRecording();
        document.getElementById("speech-status").innerText = "Mic error: " + event.error;
    };

    recognition.onend = function () {
        if (isRecording) {
            stopVoiceRecording();
        }
    };
}

function toggleVoiceRecording() {
    if (!recognition) {
        initSpeechRecognition();
        if (!recognition) {
            alert("Speech recognition is not supported in your browser. Please type your answer.");
            return;
        }
    }

    if (isRecording) {
        stopVoiceRecording();
    } else {
        startVoiceRecording();
    }
}

function startVoiceRecording() {
    try {
        recognition.start();
        isRecording = true;
        const micBtn = document.getElementById("btn-mic");
        micBtn.classList.add("recording");
        document.getElementById("mic-label").innerText = "Listening... Click to Stop";
        document.getElementById("speech-status").innerText = "Recording active...";
    } catch (e) {
        console.error("Mic start failed", e);
    }
}

function stopVoiceRecording() {
    if (recognition && isRecording) {
        recognition.stop();
    }
    isRecording = false;
    const micBtn = document.getElementById("btn-mic");
    if (micBtn) {
        micBtn.classList.remove("recording");
        document.getElementById("mic-label").innerText = "Click to Speak";
    }
    const status = document.getElementById("speech-status");
    if (status) status.innerText = "";
}

function speakQuestion() {
    const qText = document.getElementById("question-text")?.innerText;
    if (!qText || !window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop any active speech
    const utterance = new SpeechSynthesisUtterance(qText);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

function startInterview() {
    document.getElementById("interview-start-card").classList.add("hidden");
    document.getElementById("interview-loading").classList.remove("hidden");

    fetch("/api/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("interview-loading").classList.add("hidden");
        if (data.error) {
            alert("Error starting interview: " + data.error);
            document.getElementById("interview-start-card").classList.remove("hidden");
            return;
        }

        interviewQuestions = data.questions || [];
        currentQuestionIndex = 0;
        interviewHistory = [];

        document.getElementById("total-q-count").innerText = interviewQuestions.length;
        document.getElementById("interview-qa-card").classList.remove("hidden");
        loadQuestion(0);
    })
    .catch(err => {
        console.error(err);
        alert("Failed to connect to AI server.");
        document.getElementById("interview-loading").classList.add("hidden");
        document.getElementById("interview-start-card").classList.remove("hidden");
    });
}

function loadQuestion(index) {
    if (index >= interviewQuestions.length) {
        finishInterview();
        return;
    }

    const q = interviewQuestions[index];
    document.getElementById("current-q-index").innerText = index + 1;
    document.getElementById("question-text").innerText = q.question;
    document.getElementById("question-category").innerText = q.category || "General";
    document.getElementById("user-answer-input").value = "";
    document.getElementById("feedback-result").classList.add("hidden");
    document.getElementById("btn-submit-answer").disabled = false;
    document.getElementById("btn-submit-answer").innerHTML = "<i class='fa-solid fa-paper-plane'></i> Submit Answer for AI Evaluation";

    // Update progress fill
    const fillPercent = ((index + 1) / interviewQuestions.length) * 100;
    document.getElementById("q-progress-fill").style.width = fillPercent + "%";

    // Auto speak question
    speakQuestion();
}

function submitAnswer() {
    stopVoiceRecording();
    const answerInput = document.getElementById("user-answer-input");
    const answer = answerInput.value.trim();

    if (!answer) {
        alert("Please speak or type an answer before submitting.");
        return;
    }

    const currentQ = interviewQuestions[currentQuestionIndex];
    const submitBtn = document.getElementById("btn-submit-answer");
    submitBtn.disabled = true;
    submitBtn.innerHTML = "<i class='fa-solid fa-spinner fa-spin'></i> AI is evaluating your answer...";

    fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            question: currentQ.question,
            answer: answer
        })
    })
    .then(res => res.json())
    .then(evalData => {
        if (evalData.error) {
            alert("Evaluation error: " + evalData.error);
            submitBtn.disabled = false;
            return;
        }

        // Save history
        interviewHistory.push({
            question: currentQ.question,
            user_answer: answer,
            score: evalData.score,
            strengths: evalData.strengths,
            improvements: evalData.improvements
        });

        // Update live score display
        const totalScore = interviewHistory.reduce((acc, curr) => acc + curr.score, 0);
        const avg = (totalScore / interviewHistory.length).toFixed(1);
        document.getElementById("live-avg-score").innerText = avg;

        // Render feedback
        document.getElementById("eval-score-badge").innerText = `Score: ${evalData.score}/10`;
        document.getElementById("eval-strengths").innerText = evalData.strengths;
        document.getElementById("eval-improvements").innerText = evalData.improvements;
        document.getElementById("eval-model-answer").innerText = evalData.model_answer;
        document.getElementById("feedback-result").classList.remove("hidden");
    })
    .catch(err => {
        console.error(err);
        alert("Failed to evaluate answer.");
        submitBtn.disabled = false;
    });
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < interviewQuestions.length) {
        loadQuestion(currentQuestionIndex);
    } else {
        finishInterview();
    }
}

function finishInterview() {
    document.getElementById("interview-qa-card").classList.add("hidden");
    document.getElementById("interview-loading").classList.remove("hidden");
    document.getElementById("loading-title").innerText = "Generating Final Performance Report...";

    fetch("/api/interview/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: interviewHistory })
    })
    .then(res => res.json())
    .then(summary => {
        document.getElementById("interview-loading").classList.add("hidden");
        document.getElementById("interview-summary-card").classList.remove("hidden");

        const score = summary.overall_score || 0;
        document.getElementById("final-score-val").innerText = score;
        document.getElementById("final-performance-grade").innerText = summary.grade || "Completed";
        document.getElementById("final-score-message").innerText = summary.summary_message || "";

        // Render strengths list
        const sList = document.getElementById("summary-strengths-list");
        sList.innerHTML = (summary.strengths || []).map(s => `<li><i class="fa-solid fa-check text-success"></i> ${s}</li>`).join('');

        // Render recommendations list
        const rList = document.getElementById("summary-recommendations-list");
        rList.innerHTML = (summary.recommendations || []).map(r => `<li><i class="fa-solid fa-arrow-trend-up text-primary"></i> ${r}</li>`).join('');
    })
    .catch(err => {
        console.error(err);
        alert("Error generating summary.");
        document.getElementById("interview-loading").classList.add("hidden");
    });
}

function resetInterview() {
    document.getElementById("interview-summary-card").classList.add("hidden");
    document.getElementById("interview-start-card").classList.remove("hidden");
}


// =====================================================
// 2. RESUME & LINKEDIN OPTIMIZER LOGIC
// =====================================================

function switchTab(tabName) {
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(content => content.classList.add("hidden"));

    if (tabName === 'resume') {
        document.getElementById("tab-btn-resume").classList.add("active");
        document.getElementById("tab-content-resume").classList.remove("hidden");
    } else {
        document.getElementById("tab-btn-linkedin").classList.add("active");
        document.getElementById("tab-content-linkedin").classList.remove("hidden");
    }
}

function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        document.getElementById("selected-file-name").innerText = "Selected File: " + file.name;
    }
}

function analyzeResume(event) {
    event.preventDefault();
    const fileInput = document.getElementById("resume-file-input");
    if (!fileInput.files || !fileInput.files[0]) {
        alert("Please select a resume file first.");
        return;
    }

    const formData = new FormData();
    formData.append("resume_file", fileInput.files[0]);

    document.getElementById("resume-loading").classList.remove("hidden");
    document.getElementById("resume-results").classList.add("hidden");

    fetch("/api/resume/analyze", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("resume-loading").classList.add("hidden");
        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        document.getElementById("resume-results").classList.remove("hidden");
        document.getElementById("ats-score-number").innerText = data.ats_score || 0;
        document.getElementById("ats-status-badge").innerText = data.verdict || "ATS Compatibility";

        // Render keywords
        const keywordsContainer = document.getElementById("resume-keywords");
        let kwHTML = '<strong>Found Keywords:</strong><br>';
        (data.keywords_present || []).forEach(k => {
            kwHTML += `<span class="tag tag-present">✓ ${k}</span>`;
        });
        kwHTML += '<br><br><strong>Missing Keywords:</strong><br>';
        (data.keywords_missing || []).forEach(k => {
            kwHTML += `<span class="tag tag-missing">+ ${k}</span>`;
        });
        keywordsContainer.innerHTML = kwHTML;

        // Render formatting feedback
        const fmtList = document.getElementById("resume-formatting");
        fmtList.innerHTML = (data.formatting_feedback || []).map(f => `<li><i class="fa-solid fa-check"></i> ${f}</li>`).join('');

        // Render suggestions
        const sugList = document.getElementById("resume-suggestions");
        sugList.innerHTML = (data.content_suggestions || []).map(s => `<li><i class="fa-solid fa-lightbulb"></i> ${s}</li>`).join('');
    })
    .catch(err => {
        console.error(err);
        alert("Failed to analyze resume.");
        document.getElementById("resume-loading").classList.add("hidden");
    });
}

function optimizeLinkedIn(event) {
    event.preventDefault();
    const headline = document.getElementById("linkedin-headline").value;
    const about = document.getElementById("linkedin-about").value;
    const skills = document.getElementById("linkedin-skills").value;
    const profile_url = document.getElementById("linkedin-url").value;

    document.getElementById("linkedin-loading").classList.remove("hidden");
    document.getElementById("linkedin-results").classList.add("hidden");

    fetch("/api/linkedin/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, about, skills, profile_url })
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("linkedin-loading").classList.add("hidden");
        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        document.getElementById("linkedin-results").classList.remove("hidden");

        // Headlines
        const headlinesBox = document.getElementById("linkedin-headlines-container");
        headlinesBox.innerHTML = (data.headline_options || []).map((h, i) => `
            <div class="copy-box" style="margin-bottom: 12px;">
                <p><strong>Option ${i + 1}:</strong> ${h}</p>
            </div>
        `).join('');

        // About section
        document.getElementById("linkedin-about-output").innerText = data.optimized_about || "";

        // Skills
        const skillsBox = document.getElementById("linkedin-skills-output");
        skillsBox.innerHTML = (data.recommended_skills || []).map(s => `<span class="tag tag-present">${s}</span>`).join('');

        // Photo tips
        const photoList = document.getElementById("linkedin-photo-tips");
        photoList.innerHTML = (data.profile_picture_tips || []).map(t => `<li><i class="fa-solid fa-camera"></i> ${t}</li>`).join('');
    })
    .catch(err => {
        console.error(err);
        alert("Failed to optimize LinkedIn profile.");
        document.getElementById("linkedin-loading").classList.add("hidden");
    });
}

function copyToClipboard(elementId) {
    const text = document.getElementById(elementId)?.innerText;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        alert("Copied to clipboard!");
    });
}


// =====================================================
// 3. PROGRESS TRACKER LOGIC
// =====================================================

const defaultPhases = [
    {
        phase: "Phase 1: Foundations & Core Concepts",
        topics: [
            "Programming Fundamentals & Syntax",
            "Data Structures & Algorithms Basics",
            "Version Control with Git & GitHub",
            "Command Line & Operating System Basics"
        ]
    },
    {
        phase: "Phase 2: Domain Deep-Dive & Intermediate Skills",
        topics: [
            "Frameworks & Architecture Patterns",
            "Database Design & SQL / NoSQL Querying",
            "API Development & REST / GraphQL Integration",
            "Testing, Debugging & Quality Assurance"
        ]
    },
    {
        phase: "Phase 3: Advanced Portfolio & Career Readiness",
        topics: [
            "Full-Stack Capstone Project Deployment",
            "System Design & Scalability Concepts",
            "ATS Resume & Portfolio Optimization",
            "Mock Interviews & Behavioral Questions"
        ]
    }
];

function initProgressTrackerPage() {
    const container = document.getElementById("progress-topics-container");
    if (!container) return;

    const savedCompleted = JSON.parse(localStorage.getItem("completed_topics") || "[]");
    let html = '';
    let topicIdCounter = 0;

    defaultPhases.forEach((p, pIndex) => {
        html += `
            <div class="phase-card">
                <div class="phase-header">
                    <h3>${p.phase}</h3>
                    <span class="phase-progress-badge" id="phase-badge-${pIndex}">Phase Progress</span>
                </div>
                <div class="phase-topics-list">
        `;

        p.topics.forEach(topic => {
            topicIdCounter++;
            const isChecked = savedCompleted.includes(topic);
            html += `
                <div class="topic-item ${isChecked ? 'completed' : ''}" onclick="toggleTopicCheck('${topic}', this)">
                    <input type="checkbox" class="topic-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleTopicCheck('${topic}', this.parentElement)">
                    <span class="topic-label">${topic}</span>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    updateProgressMetrics();
}

function toggleTopicCheck(topicName, itemElement) {
    const checkbox = itemElement.querySelector("input[type='checkbox']");
    checkbox.checked = !checkbox.checked;
    itemElement.classList.toggle("completed", checkbox.checked);

    let savedCompleted = JSON.parse(localStorage.getItem("completed_topics") || "[]");
    if (checkbox.checked) {
        if (!savedCompleted.includes(topicName)) savedCompleted.push(topicName);
    } else {
        savedCompleted = savedCompleted.filter(t => t !== topicName);
    }

    localStorage.setItem("completed_topics", JSON.stringify(savedCompleted));
    updateProgressMetrics();

    // Sync backend
    fetch("/api/progress/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed_topics: savedCompleted })
    });
}

function markAllTopics(shouldComplete) {
    let allTopics = [];
    defaultPhases.forEach(p => p.topics.forEach(t => allTopics.push(t)));

    const savedCompleted = shouldComplete ? allTopics : [];
    localStorage.setItem("completed_topics", JSON.stringify(savedCompleted));

    initProgressTrackerPage();
}

function updateProgressMetrics() {
    let totalTopics = 0;
    defaultPhases.forEach(p => totalTopics += p.topics.length);

    const savedCompleted = JSON.parse(localStorage.getItem("completed_topics") || "[]");
    const count = savedCompleted.length;
    const percent = Math.round((count / (totalTopics || 1)) * 100);

    const overallElem = document.getElementById("overall-percentage");
    if (overallElem) overallElem.innerText = percent + "%";

    const countElem = document.getElementById("completed-count");
    if (countElem) countElem.innerText = count;

    const totalElem = document.getElementById("total-count");
    if (totalElem) totalElem.innerText = totalTopics;

    const fillElem = document.getElementById("main-progress-fill");
    if (fillElem) fillElem.style.width = percent + "%";

    const readinessElem = document.getElementById("readiness-level");
    if (readinessElem) {
        if (percent === 100) readinessElem.innerText = "Job Ready! 🚀";
        else if (percent >= 70) readinessElem.innerText = "Advanced";
        else if (percent >= 30) readinessElem.innerText = "Intermediate";
        else readinessElem.innerText = "Getting Started";
    }

    // Update Dashboard Widget if on dashboard page
    initDashboardWidget();
}

function initDashboardWidget() {
    const fill = document.getElementById("dashboard-progress-fill");
    const text = document.getElementById("dashboard-progress-text");
    const topicsText = document.getElementById("dashboard-topics-text");
    if (!fill || !text) return;

    let totalTopics = 0;
    defaultPhases.forEach(p => totalTopics += p.topics.length);

    const savedCompleted = JSON.parse(localStorage.getItem("completed_topics") || "[]");
    const count = savedCompleted.length;
    const percent = Math.round((count / (totalTopics || 1)) * 100);

    fill.style.width = percent + "%";
    text.innerText = percent + "% Completed";
    if (topicsText) topicsText.innerText = `${count} of ${totalTopics} Topics Completed`;
}


// =====================================================
// 4. PERSONALIZED JOB FEED LOGIC
// =====================================================

let allJobsList = [];
let currentJobTypeFilter = 'all';

function loadJobFeed() {
    const loader = document.getElementById("jobs-loading");
    const grid = document.getElementById("jobs-grid");
    if (!grid) return;

    fetch("/api/jobs/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    })
    .then(res => res.json())
    .then(data => {
        loader.classList.add("hidden");
        grid.classList.remove("hidden");
        allJobsList = data.jobs || [];
        renderJobs(allJobsList);
    })
    .catch(err => {
        console.error(err);
        loader.classList.add("hidden");
        grid.innerHTML = "<p>Failed to load personalized jobs.</p>";
        grid.classList.remove("hidden");
    });
}

function renderJobs(jobs) {
    const grid = document.getElementById("jobs-grid");
    if (!grid) return;

    if (!jobs || jobs.length === 0) {
        grid.innerHTML = `
            <div class="glass card-center" style="grid-column: 1 / -1;">
                <h3>No jobs found matching filter</h3>
                <p>Try clearing your search or filter pills.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = jobs.map(j => `
        <div class="job-card">
            <div>
                <div class="job-card-header">
                    <div>
                        <h3 class="job-title">${j.title}</h3>
                        <span class="job-company">${j.company}</span>
                    </div>
                    <span class="match-badge">🎯 ${j.match_score}% Match</span>
                </div>
                <div class="job-meta-row">
                    <span><i class="fa-solid fa-location-dot"></i> ${j.location}</span>
                    <span><i class="fa-solid fa-briefcase"></i> ${j.job_type}</span>
                </div>
                <p class="job-desc">${j.description}</p>
                <div class="job-tags">
                    ${(j.tags || []).map(t => `<span class="job-tag">${t}</span>`).join('')}
                </div>
            </div>
            <div class="job-actions">
                <span class="job-salary">${j.salary}</span>
                <a href="${j.apply_url}" target="_blank" class="btn btn-sm">
                    Apply Now <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
            </div>
        </div>
    `).join('');
}

function filterJobs() {
    const query = document.getElementById("job-search-input")?.value.toLowerCase().trim() || "";

    const filtered = allJobsList.filter(job => {
        const matchesQuery = !query ||
            job.title.toLowerCase().includes(query) ||
            job.company.toLowerCase().includes(query) ||
            (job.tags || []).some(t => t.toLowerCase().includes(query));

        const matchesType = (currentJobTypeFilter === 'all') ||
            (currentJobTypeFilter === 'Remote' && job.location.toLowerCase().includes('remote')) ||
            (job.job_type.toLowerCase() === currentJobTypeFilter.toLowerCase());

        return matchesQuery && matchesType;
    });

    renderJobs(filtered);
}

function setJobTypeFilter(type, pillBtn) {
    document.querySelectorAll(".filter-pills .pill").forEach(p => p.classList.remove("active"));
    pillBtn.classList.add("active");
    currentJobTypeFilter = type;
    filterJobs();
}

// =====================================================
// FEEDBACK & REVIEWS SYSTEM
// =====================================================

const ratingDescriptions = {
    1: "1.0 - Poor. Did not meet expectations",
    2: "2.0 - Fair. Needs significant improvements",
    3: "3.0 - Good. Met basic expectations",
    4: "4.0 - Very Good. Highly practical & helpful",
    5: "5.0 - Excellent! Exceeded expectations"
};

document.addEventListener("DOMContentLoaded", function () {
    // Initialize interactive star rating picker
    const starContainer = document.getElementById("star-rating-picker");
    if (starContainer) {
        const stars = starContainer.querySelectorAll(".star-item");
        const ratingInput = document.getElementById("feedback-rating");
        const ratingLabel = document.getElementById("rating-label");

        stars.forEach(star => {
            star.addEventListener("mouseenter", function () {
                const val = parseInt(this.getAttribute("data-value"));
                highlightStars(val);
                if (ratingLabel) ratingLabel.innerText = ratingDescriptions[val] || `${val}.0`;
            });

            star.addEventListener("click", function () {
                const val = parseInt(this.getAttribute("data-value"));
                if (ratingInput) ratingInput.value = val;
                highlightStars(val);
                if (ratingLabel) ratingLabel.innerText = ratingDescriptions[val] || `${val}.0`;
            });
        });

        starContainer.addEventListener("mouseleave", function () {
            const currentVal = parseInt(ratingInput?.value || 5);
            highlightStars(currentVal);
            if (ratingLabel) ratingLabel.innerText = ratingDescriptions[currentVal] || `${currentVal}.0`;
        });

        function highlightStars(count) {
            stars.forEach(s => {
                const val = parseInt(s.getAttribute("data-value"));
                if (val <= count) {
                    s.classList.add("active");
                } else {
                    s.classList.remove("active");
                }
            });
        }
    }

    // Initialize category pill buttons
    const pillButtons = document.querySelectorAll("#category-pills .pill-btn");
    const categoryInput = document.getElementById("feedback-category");
    pillButtons.forEach(btn => {
        btn.addEventListener("click", function () {
            pillButtons.forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            if (categoryInput) {
                categoryInput.value = this.getAttribute("data-category");
            }
        });
    });
});

function submitFeedback(event) {
    event.preventDefault();
    const btn = document.getElementById("btn-submit-feedback");
    const alertBox = document.getElementById("feedback-alert");
    const name = document.getElementById("feedback-name")?.value.trim();
    const career = document.getElementById("feedback-career")?.value.trim();
    const rating = parseInt(document.getElementById("feedback-rating")?.value || 5);
    const category = document.getElementById("feedback-category")?.value || "General Platform";
    const message = document.getElementById("feedback-message")?.value.trim();
    const recommend = document.getElementById("feedback-recommend")?.checked ?? true;

    if (!message) {
        if (alertBox) {
            alertBox.className = "feedback-status-msg error";
            alertBox.innerText = "Please write a feedback message before submitting.";
            alertBox.classList.remove("hidden");
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
    }

    fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, career, rating, category, message, recommend })
    })
    .then(res => res.json())
    .then(data => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Feedback';
        }

        if (data.error) {
            if (alertBox) {
                alertBox.className = "feedback-status-msg error";
                alertBox.innerText = data.error;
                alertBox.classList.remove("hidden");
            }
            return;
        }

        // Show success alert
        if (alertBox) {
            alertBox.className = "feedback-status-msg success";
            alertBox.innerHTML = '<i class="fa-solid fa-circle-check"></i> Thank you! Your feedback has been published.';
            alertBox.classList.remove("hidden");
        }

        // Clear textarea
        const msgField = document.getElementById("feedback-message");
        if (msgField) msgField.value = "";

        // Prepend new review card to reviews list
        const reviewsContainer = document.getElementById("reviews-list-container");
        if (reviewsContainer && data.feedback) {
            const fb = data.feedback;
            let starsHTML = "";
            for (let i = 1; i <= 5; i++) {
                starsHTML += i <= fb.rating ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
            }

            const newCard = document.createElement("div");
            newCard.className = "review-card glass";
            newCard.setAttribute("data-category", fb.category);
            newCard.innerHTML = `
                <div class="review-top">
                    <div class="review-author-meta">
                        <div class="author-avatar">${(fb.name || "A")[0].toUpperCase()}</div>
                        <div>
                            <h4 class="author-name">${fb.name}</h4>
                            <span class="author-role">${fb.career || "Student / Learner"}</span>
                        </div>
                    </div>
                    <div class="review-rating-stars">${starsHTML}</div>
                </div>
                <div class="review-category-badge">
                    <span class="badge-tag"><i class="fa-solid fa-tag"></i> ${fb.category}</span>
                    ${fb.recommend ? '<span class="badge-recommend"><i class="fa-solid fa-circle-check"></i> Recommends</span>' : ''}
                    <span class="badge-date">${fb.date}</span>
                </div>
                <p class="review-text">"${fb.message}"</p>
            `;
            reviewsContainer.insertBefore(newCard, reviewsContainer.firstChild);

            // Update reviews count in header
            const countHeader = document.getElementById("reviews-count-header");
            if (countHeader) {
                const currentCount = parseInt(countHeader.innerText) || 0;
                countHeader.innerText = currentCount + 1;
            }
        }
    })
    .catch(err => {
        console.error("Feedback submit error:", err);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Feedback';
        }
        if (alertBox) {
            alertBox.className = "feedback-status-msg error";
            alertBox.innerText = "Failed to submit feedback. Please try again.";
            alertBox.classList.remove("hidden");
        }
    });
}

function filterReviewsByCategory(category) {
    const cards = document.querySelectorAll("#reviews-list-container .review-card");
    cards.forEach(card => {
        const cardCat = card.getAttribute("data-category");
        if (category === "ALL" || cardCat === category) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}