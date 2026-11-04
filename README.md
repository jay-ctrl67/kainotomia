# Kainotomia (standalone)

A small website built from the Six Thinking Hats report: a policies front page with a trial-then-grow plan (Plan A) and a fallback (Plan B), hint-first AI Q&A, adaptive quizzes, a home screen that records each student's progress, branch tabs with their own syllabus, a workshop page on using AI as a tool, anonymous student feedback for the feedback committee, and a teacher view. The look is Roman and Greek (Aegean blue, gold, olive, and a Greek key border) on the report's cream.

## Choose the AI: Gemini (no Claude account needed) or Claude
Visitors never need an account with any AI company. Only the server holds an API key. If you set `GEMINI_API_KEY` (a key from Google AI Studio, aistudio.google.com), the site uses Google Gemini automatically. If you set `ANTHROPIC_API_KEY` instead, it uses Claude. To force one, set `AI_PROVIDER=gemini` or `AI_PROVIDER=claude`. Optionally set `GEMINI_MODEL` (default `gemini-2.5-flash`). Model names and free-tier limits change, so check AI Studio, and if you see a 429 error with `limit: 0`, pick a model that has a free tier. Free Gemini keys have tight daily limits, and Google may use free-tier data to improve its products, so mention this in your policies or use a paid key. The server prints which AI it is using when it starts.

## What you need
- Node.js 18 or newer (check with `node -v`)
- An API key: Google Gemini (aistudio.google.com, has a free tier) or Anthropic (console.anthropic.com, billed to that key).

## Run it on your laptop
    GEMINI_API_KEY=your-key TEACHER_PASSWORD=pick-a-password node server.js
(On Windows PowerShell: `$env:GEMINI_API_KEY="your-key"; $env:TEACHER_PASSWORD="pick-a-password"; node server.js`)
Open http://localhost:3000. Phones on the same Wi-Fi can open http://YOUR-LAPTOP-IP:3000.

## Put it online (so a QR code works anywhere)
Use any Node host, for example Render or Railway:
1. Upload these files to a GitHub repository.
2. Create a new Web Service from that repo. Start command: `node server.js`
3. Add the environment variables GEMINI_API_KEY and TEACHER_PASSWORD in the host's settings.
4. Open the URL the host gives you, then turn that URL into a QR code.

## Syllabus
`syllabus.json` holds the branch tabs. Each branch has subjects, and each subject has a list of units. The lists are starters I wrote, not the official syllabus, so edit them to match each branch (the same data is also built into index.html, so change both). Quizzes can only be made from these lists.

## Open teacher view (demo days only)
By default the Teacher tab shows the example students to everyone, and real students' results need `TEACHER_PASSWORD`. Set `OPEN_TEACHER=1` to let anyone see all results without a password. Only use this while presenting with fake names, because it makes every student's name and scores public, which breaks your own privacy policies.

## Example students and privacy choices
The Teacher tab shows two example students per branch with generic Indian names (for example Aarav Sharma and Diya Patel in CSE), each with quiz results in every subject, so you can see the sorting, filters and graph before real students use it. One is on track and one needs support, and which one is shuffled each time the page loads, with a fixed mix of boys and girls, so no gender is shown as the one who struggles. They are marked EXAMPLE and are built into index.html. Students can pick private mode (nothing recorded, shared or personalized) and can delete their data any time from the Home screen.

## Notes
- Never put your API key inside index.html. It stays on the server only.
- The server limits each visitor to 40 AI requests per 10 minutes so the QR code can't run up your bill.
- Anonymous feedback is saved in feedback.json (no name or roll number). The Teacher tab shows it, protected by the same password as results.
- Shared results are saved in results.json. Free hosts may erase this file when they restart.
- Students enter their name and roll number, and every quiz result (score, subject, unit, weak areas) is sent to the teacher automatically. Chats are never shared. This is stated on the policies page.
- Optional: set MODEL to use a different Claude model (default claude-sonnet-5-5).
- The Teacher tab can be filtered by status and subject and sorted, and each student opens as a dropdown with a per-subject breakdown. The student Home screen groups subjects into dropdowns too.
