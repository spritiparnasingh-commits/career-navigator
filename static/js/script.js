/*====================================================
    CAREER NAVIGATOR
    SCRIPT.JS
======================================================*/

// ===============================
// PAGE LOAD
// ===============================

document.addEventListener("DOMContentLoaded", function () {

    console.log("Career Navigator Loaded Successfully");

});


// ===============================
// USER INFORMATION FORM VALIDATION
// ===============================

const userForm = document.querySelector("form");

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

            alert("Please fill in all the required fields.");

            return;

        }

        // Loading effect for submit button

        const submitButton = userForm.querySelector("button[type='submit']");

        if (submitButton) {

            submitButton.disabled = true;

            submitButton.innerHTML = "Generating...";

        }

    });

}


// ===============================
// AI LOADING PLACEHOLDER
// ===============================

function showAILoading(elementId) {

    const element = document.getElementById(elementId);

    if (!element) return;

    element.innerHTML = `
        <div class="ai-loading">
            <div class="loader"></div>
            <h3>Generating AI Content...</h3>
            <p>Please wait while AI creates your personalized roadmap and resources.</p>
        </div>
    `;

}


// ===============================
// SMOOTH SCROLL (OPTIONAL)
// ===============================

document.querySelectorAll("a[href^='#']").forEach(function (link) {

    link.addEventListener("click", function (event) {

        const target = document.querySelector(this.getAttribute("href"));

        if (target) {

            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth"
            });

        }

    });

});