# Engineering Valuation Examination Program

This is a browser-based examination app built from the 500-question Engineering Valuation bank.

## What it does

- Requires each student to enter their name and the access code `6642` before the exam can begin
- Randomly selects 60 questions from the 500-question bank each time an exam starts
- Gives students 30 minutes to complete the test
- Shows the score immediately after submission or when time runs out
- Lets students review wrong answers, correct answers, unanswered questions, or the full paper after the exam
- Keeps dependent calculation questions together and rewrites their prompt to reference the previous question more clearly
- Works as a simple local web app with no installation required

## How to use

1. Open [index.html](C:\Users\WE\OneDrive\Documents\Valuation Program\index.html) in your browser.
2. Enter the student's name and the access code `6642`.
3. Click **Start Examination**.
4. Answer the questions and submit before the timer reaches zero, or let it auto-submit.
5. Review results immediately after the exam.

## Files

- [index.html](C:\Users\WE\OneDrive\Documents\Valuation Program\index.html): main app page
- [styles.css](C:\Users\WE\OneDrive\Documents\Valuation Program\styles.css): exam styling
- [app.js](C:\Users\WE\OneDrive\Documents\Valuation Program\app.js): exam logic
- [questions.js](C:\Users\WE\OneDrive\Documents\Valuation Program\questions.js): generated question bank for browser use
- [questions.json](C:\Users\WE\OneDrive\Documents\Valuation Program\questions.json): raw question data
- [scripts\extract-questions.ps1](C:\Users\WE\OneDrive\Documents\Valuation Program\scripts\extract-questions.ps1): regenerates the question data from the `.docx` file

## Regenerating the question bank

If the Word document changes, run:

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\extract-questions.ps1"
```
