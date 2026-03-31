const EXAM_QUESTION_COUNT = 60;
const EXAM_DURATION_MINUTES = 30;
const ACCESS_CODE = "6642";

const startScreen = document.getElementById("start-screen");
const examScreen = document.getElementById("exam-screen");
const resultsScreen = document.getElementById("results-screen");

const accessForm = document.getElementById("access-form");
const studentNameInput = document.getElementById("student-name");
const accessCodeInput = document.getElementById("access-code");
const accessMessage = document.getElementById("access-message");

const bankSize = document.getElementById("bank-size");
const submitExamButton = document.getElementById("submit-exam-button");
const previousButton = document.getElementById("previous-button");
const nextButton = document.getElementById("next-button");
const restartButton = document.getElementById("restart-button");

const studentDisplay = document.getElementById("student-display");
const studentResultsName = document.getElementById("student-results-name");
const timerDisplay = document.getElementById("timer-display");
const mobileTimerDisplay = document.getElementById("mobile-timer-display");
const progressSummary = document.getElementById("progress-summary");
const progressBarFill = document.getElementById("progress-bar-fill");
const questionPalette = document.getElementById("question-palette");
const mobileProgressDisplay = document.getElementById("mobile-progress-display");
const questionPanel = document.querySelector(".question-panel");
const questionIndex = document.getElementById("question-index");
const questionStatus = document.getElementById("question-status");
const questionText = document.getElementById("question-text");
const optionsForm = document.getElementById("options-form");
const resultsSummary = document.getElementById("results-summary");
const scoreDisplay = document.getElementById("score-display");
const scorePercent = document.getElementById("score-percent");
const reviewList = document.getElementById("review-list");

const filterButtons = Array.from(document.querySelectorAll(".filter-button"));

const rawQuestionBank = Array.isArray(window.QUESTION_BANK) ? window.QUESTION_BANK : [];

const examState = {
    studentName: "",
    questions: [],
    answers: {},
    currentIndex: 0,
    timeRemaining: EXAM_DURATION_MINUTES * 60,
    timerId: null,
    submitted: false,
    lastResult: null
};

function shuffleArray(items) {
    const clone = [...items];
    for (let index = clone.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    }
    return clone;
}

function extractDependencyId(question) {
    const match = question.question.match(/\bquestion\s+(\d+)\b/i);
    if (!match) {
        return null;
    }

    const dependencyId = Number(match[1]);
    return Number.isFinite(dependencyId) && dependencyId < question.id ? dependencyId : null;
}

function rewriteDependentPrompt(text) {
    let updated = text;
    updated = updated.replace(/^For question \d+,\s*/i, "Using the data from the previous question, ");
    updated = updated.replace(/\bfor question \d+\b/gi, "for the previous question");
    updated = updated.replace(/\bin question \d+\b/gi, "from the previous question");
    updated = updated.replace(/\bquestion \d+\b/gi, "the previous question");
    return updated;
}

function prepareQuestionBank(bank) {
    const questionIds = new Set(bank.map((question) => question.id));

    return bank.map((question) => {
        const dependencyId = extractDependencyId(question);
        const hasDependency = dependencyId !== null && questionIds.has(dependencyId);

        return {
            id: question.id,
            originalQuestion: question.question,
            question: hasDependency ? rewriteDependentPrompt(question.question) : question.question,
            options: { ...question.options },
            answer: question.answer,
            explanation: question.explanation,
            dependencyId: hasDependency ? dependencyId : null
        };
    });
}

function appendDependents(parentId, childrenByParent, cluster, assignedIds) {
    const dependents = (childrenByParent.get(parentId) || []).sort((left, right) => left.id - right.id);

    dependents.forEach((dependent) => {
        if (assignedIds.has(dependent.id)) {
            return;
        }

        assignedIds.add(dependent.id);
        cluster.push(dependent);
        appendDependents(dependent.id, childrenByParent, cluster, assignedIds);
    });
}

function buildExamClusters(bank) {
    const childrenByParent = new Map();
    const assignedIds = new Set();
    const clusters = [];

    bank.forEach((question) => {
        if (question.dependencyId === null) {
            return;
        }

        if (!childrenByParent.has(question.dependencyId)) {
            childrenByParent.set(question.dependencyId, []);
        }

        childrenByParent.get(question.dependencyId).push(question);
    });

    bank.forEach((question) => {
        if (question.dependencyId !== null || assignedIds.has(question.id)) {
            return;
        }

        const cluster = [question];
        assignedIds.add(question.id);
        appendDependents(question.id, childrenByParent, cluster, assignedIds);
        clusters.push(cluster);
    });

    bank.forEach((question) => {
        if (!assignedIds.has(question.id)) {
            clusters.push([question]);
            assignedIds.add(question.id);
        }
    });

    return clusters;
}

const preparedQuestionBank = prepareQuestionBank(rawQuestionBank);
const examClusters = buildExamClusters(preparedQuestionBank);
bankSize.textContent = String(preparedQuestionBank.length);

function chooseRandomClusterSubset(targetCount) {
    const randomizedClusters = shuffleArray(examClusters);
    const memo = new Map();

    function solve(index, remaining) {
        const key = `${index}:${remaining}`;
        if (memo.has(key)) {
            return memo.get(key);
        }

        if (remaining === 0) {
            return [];
        }

        if (index >= randomizedClusters.length || remaining < 0) {
            return null;
        }

        const currentCluster = randomizedClusters[index];
        const branchOrder = Math.random() > 0.5 ? ["include", "skip"] : ["skip", "include"];

        for (const branch of branchOrder) {
            if (branch === "include" && currentCluster.length <= remaining) {
                const includeResult = solve(index + 1, remaining - currentCluster.length);
                if (includeResult !== null) {
                    const result = [currentCluster, ...includeResult];
                    memo.set(key, result);
                    return result;
                }
            }

            if (branch === "skip") {
                const skipResult = solve(index + 1, remaining);
                if (skipResult !== null) {
                    memo.set(key, skipResult);
                    return skipResult;
                }
            }
        }

        memo.set(key, null);
        return null;
    }

    return solve(0, targetCount);
}

function pickRandomQuestions() {
    const selectedClusters = chooseRandomClusterSubset(EXAM_QUESTION_COUNT);

    if (!selectedClusters) {
        throw new Error("Unable to generate an exam with the requested question count.");
    }

    return selectedClusters.flat().map((question) => ({
        ...question,
        options: { ...question.options }
    }));
}

function formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
    const seconds = String(safeSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function getAnsweredCount() {
    return Object.keys(examState.answers).length;
}

function getCurrentQuestion() {
    return examState.questions[examState.currentIndex];
}

function showAccessMessage(message) {
    accessMessage.textContent = message;
    accessMessage.classList.remove("hidden");
}

function scrollToQuestionPanel() {
    if (window.innerWidth <= 980 && questionPanel) {
        questionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function clearAccessMessage() {
    accessMessage.textContent = "";
    accessMessage.classList.add("hidden");
}

function updateProgress() {
    const answeredCount = getAnsweredCount();
    progressSummary.textContent = `${answeredCount} of ${EXAM_QUESTION_COUNT} answered`;
    progressBarFill.style.width = `${(answeredCount / EXAM_QUESTION_COUNT) * 100}%`;
    mobileProgressDisplay.textContent = `${answeredCount} / ${EXAM_QUESTION_COUNT}`;
}

function updateTimer() {
    const formattedTime = formatTime(examState.timeRemaining);
    const timerColor = examState.timeRemaining <= 300 ? "var(--danger)" : "var(--accent-dark)";
    timerDisplay.textContent = formattedTime;
    timerDisplay.style.color = timerColor;
    mobileTimerDisplay.textContent = formattedTime;
    mobileTimerDisplay.style.color = timerColor;
}

function renderPalette() {
    questionPalette.innerHTML = "";

    examState.questions.forEach((question, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "palette-button";
        button.textContent = String(index + 1);

        if (examState.answers[question.id]) {
            button.classList.add("answered");
        }

        if (index === examState.currentIndex) {
            button.classList.add("current");
        }

        button.addEventListener("click", () => {
            examState.currentIndex = index;
            renderQuestion();
            scrollToQuestionPanel();
        });

        questionPalette.appendChild(button);
    });
}

function renderQuestion() {
    const question = getCurrentQuestion();
    const chosenAnswer = examState.answers[question.id] || "";

    questionIndex.textContent = `Question ${examState.currentIndex + 1} of ${EXAM_QUESTION_COUNT}`;
    questionStatus.textContent = chosenAnswer ? "Answered" : "Not answered";
    questionStatus.classList.toggle("answered", Boolean(chosenAnswer));
    questionText.textContent = question.question;
    optionsForm.innerHTML = "";

    Object.entries(question.options).forEach(([key, value]) => {
        const label = document.createElement("label");
        label.className = "option-card";
        if (chosenAnswer === key) {
            label.classList.add("selected");
        }

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "question-option";
        input.value = key;
        input.checked = chosenAnswer === key;
        input.addEventListener("change", () => {
            examState.answers[question.id] = key;
            renderQuestion();
            updateProgress();
            renderPalette();
        });

        const choiceKey = document.createElement("span");
        choiceKey.className = "choice-key";
        choiceKey.textContent = key;

        const choiceText = document.createElement("div");
        choiceText.innerHTML = `<strong class="choice-label">${key}.</strong> ${value}`;

        label.appendChild(input);
        label.appendChild(choiceKey);
        label.appendChild(choiceText);
        optionsForm.appendChild(label);
    });

    previousButton.disabled = examState.currentIndex === 0;
    nextButton.textContent = examState.currentIndex === EXAM_QUESTION_COUNT - 1 ? "Finish" : "Next";

    updateProgress();
    renderPalette();
}

function stopTimer() {
    if (examState.timerId) {
        window.clearInterval(examState.timerId);
        examState.timerId = null;
    }
}

function goToStartScreen(clearIdentity = false) {
    stopTimer();
    startScreen.classList.remove("hidden");
    examScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");

    if (clearIdentity) {
        examState.studentName = "";
        studentNameInput.value = "";
        accessCodeInput.value = "";
        clearAccessMessage();
    }

    studentNameInput.focus();
}

function calculateResults() {
    let score = 0;

    const review = examState.questions.map((question, index) => {
        const selected = examState.answers[question.id] || "";
        const isCorrect = selected === question.answer;
        if (isCorrect) {
            score += 1;
        }

        const status = selected ? (isCorrect ? "correct" : "wrong") : "unanswered";

        return {
            index: index + 1,
            question,
            selected,
            isCorrect,
            status
        };
    });

    return {
        score,
        total: examState.questions.length,
        percentage: Math.round((score / examState.questions.length) * 100),
        answered: getAnsweredCount(),
        review
    };
}

function renderReview(filter = "wrong") {
    if (!examState.lastResult) {
        return;
    }

    const items = examState.lastResult.review.filter((entry) => {
        if (filter === "all") {
            return true;
        }
        if (filter === "correct") {
            return entry.status === "correct";
        }
        if (filter === "unanswered") {
            return entry.status === "unanswered";
        }
        return entry.status === "wrong";
    });

    reviewList.innerHTML = "";

    if (items.length === 0) {
        const emptyState = document.createElement("article");
        emptyState.className = "review-card";
        emptyState.innerHTML = `<p class="results-summary">No questions match this filter.</p>`;
        reviewList.appendChild(emptyState);
        return;
    }

    items.forEach((entry) => {
        const { question, selected, status, index } = entry;
        const card = document.createElement("details");
        card.className = `review-card ${status}`;
        card.open = window.innerWidth > 720;

        const heading = document.createElement("summary");
        heading.className = "review-summary";
        heading.innerHTML = `
            <div class="review-summary-text">
                <strong>Question ${index}</strong>
                <div class="review-meta">
                    Your answer: ${selected || "Not answered"} | Correct answer: ${question.answer}
                </div>
            </div>
        `;

        const body = document.createElement("div");
        body.className = "review-body";

        const prompt = document.createElement("p");
        prompt.className = "review-question";
        prompt.textContent = question.question;

        const optionList = document.createElement("div");
        optionList.className = "review-options";

        Object.entries(question.options).forEach(([key, value]) => {
            const option = document.createElement("div");
            option.className = "review-option";

            if (key === question.answer) {
                option.classList.add("correct-option");
            }

            if (key === selected) {
                option.classList.add("selected-option");
            }

            option.innerHTML = `<strong>${key}.</strong> ${value}`;
            optionList.appendChild(option);
        });

        const note = document.createElement("p");
        note.className = "review-note";
        note.textContent = question.explanation || `Correct answer: ${question.answer}`;

        body.appendChild(prompt);
        body.appendChild(optionList);
        body.appendChild(note);

        card.appendChild(heading);
        card.appendChild(body);
        reviewList.appendChild(card);
    });
}

function finishExam(reason = "submitted") {
    if (examState.submitted) {
        return;
    }

    examState.submitted = true;
    stopTimer();
    examState.lastResult = calculateResults();

    startScreen.classList.add("hidden");
    examScreen.classList.add("hidden");
    resultsScreen.classList.remove("hidden");

    const { score, total, percentage, answered } = examState.lastResult;
    studentResultsName.textContent = `Student: ${examState.studentName}`;
    scoreDisplay.textContent = `${score} / ${total}`;
    scorePercent.textContent = `${percentage}%`;
    resultsSummary.textContent =
        reason === "timeout"
            ? `Time is up. You answered ${answered} of ${total} questions before auto-submission.`
            : `You answered ${answered} of ${total} questions and your result is ready immediately below.`;

    filterButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.filter === "wrong");
    });

    renderReview("wrong");
}

function startTimer() {
    stopTimer();
    updateTimer();

    examState.timerId = window.setInterval(() => {
        examState.timeRemaining -= 1;
        updateTimer();

        if (examState.timeRemaining <= 0) {
            finishExam("timeout");
        }
    }, 1000);
}

function startExam() {
    const studentName = studentNameInput.value.trim();
    const accessCode = accessCodeInput.value.trim();

    if (!studentName) {
        showAccessMessage("Enter the student's name before starting the examination.");
        studentNameInput.focus();
        return;
    }

    if (accessCode !== ACCESS_CODE) {
        showAccessMessage("The access code is incorrect.");
        accessCodeInput.focus();
        return;
    }

    if (preparedQuestionBank.length < EXAM_QUESTION_COUNT) {
        window.alert("The question bank does not contain enough questions to start the exam.");
        return;
    }

    clearAccessMessage();
    examState.studentName = studentName;
    examState.questions = pickRandomQuestions();
    examState.answers = {};
    examState.currentIndex = 0;
    examState.timeRemaining = EXAM_DURATION_MINUTES * 60;
    examState.submitted = false;
    examState.lastResult = null;

    studentDisplay.textContent = studentName;

    startScreen.classList.add("hidden");
    resultsScreen.classList.add("hidden");
    examScreen.classList.remove("hidden");

    renderQuestion();
    updateTimer();
    startTimer();
    scrollToQuestionPanel();
}

accessForm.addEventListener("submit", (event) => {
    event.preventDefault();
    startExam();
});

submitExamButton.addEventListener("click", () => finishExam("submitted"));

previousButton.addEventListener("click", () => {
    if (examState.currentIndex > 0) {
        examState.currentIndex -= 1;
        renderQuestion();
        scrollToQuestionPanel();
    }
});

nextButton.addEventListener("click", () => {
    if (examState.currentIndex < EXAM_QUESTION_COUNT - 1) {
        examState.currentIndex += 1;
        renderQuestion();
        scrollToQuestionPanel();
        return;
    }

    finishExam("submitted");
});

restartButton.addEventListener("click", () => goToStartScreen(true));

filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
        filterButtons.forEach((item) => item.classList.remove("active"));
        button.classList.add("active");
        renderReview(button.dataset.filter);
    });
});

goToStartScreen(true);
