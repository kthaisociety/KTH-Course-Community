/* ---------------------------------------------------------------------------
   Course Community — shared mock store.

   One normalized, schema-shaped store; every page derives its view models from
   it through the selectors below. Pages must not keep their own copy of a
   course name, credit figure or metric.

   Rules this file enforces:
   - `session` ("guest" | "member") is shared runtime state; it never lives in a
     scenario name.
   - `scenario` ("populated" | "empty" | "loading" | "error" | "edge-case") is a
     presentation override for review. It never mutates stored mock data.
   - Page-specific progress lives in its own substate (transcriptState,
     reviewState), never in the site-wide scenario.
   - Data holds no formatted strings: `credits` is numeric, `creditUnit` gives
     the suffix, terms and periods come from the selected course round.
   - Missing aggregates stay null. The frontend never invents zeros.
--------------------------------------------------------------------------- */

export const SESSIONS = ["guest", "member"];
export const SCENARIOS = ["populated", "empty", "loading", "error", "edge-case"];
export const TRANSCRIPT_STATES = ["idle", "parsing", "conflicts", "ready", "failed"];
export const REVIEW_STATES = ["idle", "editing", "saving", "saved", "failed"];

/* Examination categories are configuration, not data. Records carry the keys. */
export const EXAMINATION_KEYS = ["exam", "assignments", "labs", "projects", "other"];
export const EXAMINATION_LABELS = {
  en: { exam: "On-campus exam", assignments: "Assignments", labs: "Labs", projects: "Project", other: "Other" },
  sv: { exam: "Salstentamen", assignments: "Inlämningar", labs: "Laborationer", projects: "Projekt", other: "Övrigt" }
};
export const EXAMINATION_COLORS = {
  exam: "#1751a6", assignments: "#dfa53c", labs: "#2f9e8e", projects: "#6a4ea8", other: "#57646f"
};
export const EXAMINATION_INK = {
  exam: "#ffffff", assignments: "#3a2a06", labs: "#06251f", projects: "#ffffff", other: "#ffffff"
};

/* Which school a department belongs to. Configuration, not per-course data. */
export const DEPARTMENT_SCHOOL = {
  JJ: "EECS", DD: "EECS", EQ: "EECS", DH: "EECS",
  SF: "SCI", SK: "SCI", SA: "SCI", ME: "ITM", AK: "ABE"
};
export const schoolOf = (course) => (course ? DEPARTMENT_SCHOOL[course.departmentCode] || "KTH" : null);

const round = (code, startTerm, periodLabel, extra) => ({
  roundCode: code, startTerm, periodLabel,
  formattedPeriodsAndCredits: periodLabel,
  studyPace: 50, language: "English", tutoringForm: "Normal daytime",
  tutoringTimeOfDay: "Daytime", schemaUrl: "https://www.kth.se/schema",
  isPu: false, isVu: false,
  ...(extra || {})
});

export const courses = [
  /* Transcript-backed catalog fixtures. Names, credits and grade scales come
     from the supplied Swedish and English Ladok transcripts. Fields that the
     transcripts do not establish stay nullable, and offerings are not
     invented. */
  { code: "SK1105", nameSwedish: "Experimentell fysik", nameEnglish: "Experimental Physics",
    keywords: "experimental physics",
    credits: 4, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SK", department: "Physics", educationLevelCode: "BASIC", gradeScaleCode: "PF",
    goals: null, content: null, eligibility: null,
    rounds: [round("16762", 20261, "P4 (4,0 hp)", {
      studyPace: 25,
      schemaUrl: "https://www.kth.se/social/course/SK1105/subgroup/vt-2026-254/calendar/",
      language: "Svenska", tutoringForm: "NML", tutoringTimeOfDay: "DAG",
      isPu: true, isVu: false
    })] },
  { code: "SF1683", nameSwedish: "Differentialekvationer och transformmetoder",
    nameEnglish: "Differential Equations and Transforms",
    keywords: "differential equations, transforms",
    credits: 9, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: null, content: null, eligibility: null,
    rounds: [round("16262", 20252, "P1 (5,0 hp), P2 (4,0 hp)", {
      studyPace: 33,
      schemaUrl: "https://www.kth.se/social/course/SF1683/subgroup/ht-2025-873/calendar/",
      language: "Svenska", tutoringForm: "NML", tutoringTimeOfDay: "DAG",
      isPu: true, isVu: false
    })] },
  { code: "SF1544", nameSwedish: "Numeriska metoder, grundkurs IV",
    nameEnglish: "Numerical Methods, Basic Course IV",
    keywords: "numerical methods",
    credits: 6, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: null, content: null, eligibility: null,
    rounds: [round("17159", 20252, "P2 (1,0 hp)", {
      studyPace: 17,
      schemaUrl: "https://www.kth.se/social/course/SF1544/subgroup/ht-2025-ctfys2clgym/calendar/",
      language: "Svenska", tutoringForm: "NML", tutoringTimeOfDay: "DAG",
      isPu: true, isVu: false
    })] },
  { code: "DD1327", nameSwedish: "Grundläggande datalogi",
    nameEnglish: "Fundamentals of Computer Science",
    keywords: "computer science, algorithms, data structures",
    credits: 6, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "DD", department: "Computer Science", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: null, content: null, eligibility: null,
    rounds: [round("16197", 20261, "P4 (6,0 hp)", {
      studyPace: 33,
      schemaUrl: "https://www.kth.se/social/course/DD1327/subgroup/vt-2026-grudat26/calendar/",
      language: "Svenska", tutoringForm: "NML", tutoringTimeOfDay: "DAG",
      isPu: true, isVu: false
    })] },
  { code: "SA2001", nameSwedish: "Hållbar utveckling och forskningsmetodik inom matematik",
    nameEnglish: "Sustainable development and research methodology in mathematics",
    keywords: "sustainable development, research methodology, mathematics",
    credits: 3, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SA", department: "Mathematics", educationLevelCode: "ADVANCED", gradeScaleCode: "PF",
    goals: null, content: null, eligibility: null,
    rounds: [round("17337", 20261, "P3 (3,0 hp)", {
      studyPace: 25,
      schemaUrl: "https://www.kth.se/social/course/SA2001/subgroup/vt-2026-131/calendar/",
      language: "Engelska", tutoringForm: "NML", tutoringTimeOfDay: "DAG",
      isPu: true, isVu: false
    })] },
  { code: "SF2524", nameSwedish: "Matrisberäkningar för storskaliga system",
    nameEnglish: "Matrix Computations for Large-scale Systems",
    keywords: "matrix computations, large-scale systems",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: null, content: null, eligibility: null,
    rounds: [round("17235", 20252, "P2 (7,5 hp)", {
      studyPace: 50,
      schemaUrl: "https://www.kth.se/social/course/SF2524/subgroup/ht-2025-1036/calendar/",
      language: "Engelska", tutoringForm: "NML", tutoringTimeOfDay: "DAG",
      isPu: true, isVu: false
    })] },
  { code: "DD1337", nameSwedish: "Programmering", nameEnglish: "Programming",
    keywords: "types, control flow, testing, version control",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: "Write, read and debug small programs in a statically typed language.",
    content: "Values and types, control flow, data structures, files, testing and version control.",
    eligibility: "None",
    rounds: [round("1", "HT2024", "P1–P2"), round("1", "HT2025", "P1–P2")] },
  { code: "DD1338", nameSwedish: "Algoritmer och datastrukturer", nameEnglish: "Algorithms and Data Structures",
    keywords: "lists, trees, hashing, graphs, complexity",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: "Choose and analyse data structures and algorithms by asymptotic cost.",
    content: "Lists, trees, hashing, graphs, sorting, complexity analysis.",
    eligibility: "DD1337 or equivalent",
    rounds: [round("1", "VT2025", "P3–P4")] },
  { code: "DD2380", nameSwedish: "Artificiell intelligens", nameEnglish: "Artificial Intelligence",
    keywords: "search, agents, planning, uncertainty",
    credits: 6, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Model a problem as search, constraint satisfaction or probabilistic inference.",
    content: "Search, adversarial games, constraint satisfaction, probabilistic reasoning, three labs.",
    eligibility: "DD1337 and SF1626",
    rounds: [round("1", "HT2025", "P2")] },
  { code: "DD2421", nameSwedish: "Maskininlärning", nameEnglish: "Machine Learning",
    keywords: "supervised learning, kernels, ensembles",
    credits: 6, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Pick, train and evaluate a supervised model, and say why it generalises.",
    content: "Decision trees, SVMs, boosting, Bayesian learning, weekly assignments in Python.",
    eligibility: "SF1626 and SF1918",
    rounds: [round("1", "HT2025", "P2")] },
  { code: "DD2424", nameSwedish: "Djupinlärning i datavetenskap", nameEnglish: "Deep Learning in Data Science",
    keywords: "backpropagation, convnets, regularisation",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Implement and train deep networks from first principles.",
    content: "Four numpy assignments before any framework, then an open project.",
    eligibility: "DD2421 or equivalent",
    rounds: [round("1", "HT2025", "P2"), round("1", "VT2026", "P3")] },
  { code: "DD2437", nameSwedish: "Artificiella neuronnät och djupa arkitekturer",
    nameEnglish: "Artificial Neural Networks and Deep Architectures",
    keywords: "perceptrons, RBF networks, Hopfield nets",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Relate network architecture to the learning problem it suits.",
    content: "Perceptrons, RBF networks, Hopfield nets, deep architectures, lab series.",
    eligibility: "SF1624 and programming experience",
    rounds: [round("1", "HT2026", "P1–P2")] },
  { code: "DD2412", nameSwedish: "Djupinlärning, avancerad kurs", nameEnglish: "Deep Learning, Advanced Course",
    keywords: "paper seminars, reproduction, self-supervision",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Read, reproduce and criticise a recent deep learning paper.",
    content: "Paper seminars and a reproduction project.",
    eligibility: "DD2424",
    rounds: [round("1", "HT2026", "P2")] },
  { code: "SF1624", nameSwedish: "Algebra och geometri", nameEnglish: "Algebra and Geometry",
    keywords: "matrices, eigenvalues, quadratic forms",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: "Work with vectors, matrices and linear transformations.",
    content: "Linear systems, matrix algebra, eigenvalues, quadratic forms.",
    eligibility: "None",
    rounds: [round("1", "HT2024", "P1–P2")] },
  { code: "SF1626", nameSwedish: "Flervariabelanalys", nameEnglish: "Calculus in Several Variables",
    keywords: "partial derivatives, optimisation, multiple integrals",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: "Differentiate and integrate functions of several variables.",
    content: "Partial derivatives, optimisation, multiple integrals, vector fields.",
    eligibility: "One-variable calculus",
    rounds: [round("1", "VT2025", "P3–P4")] },
  { code: "SF1918", nameSwedish: "Sannolikhetsteori och statistik", nameEnglish: "Probability Theory and Statistics",
    keywords: "distributions, estimation, hypothesis testing",
    credits: 6, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: "Model uncertainty and draw conclusions from a sample.",
    content: "Distributions, estimation, confidence intervals, hypothesis testing, labs.",
    eligibility: "SF1626",
    rounds: [round("1", "HT2025", "P1")] },
  { code: "AK2030", nameSwedish: "Teori och metod i vetenskapsstudier",
    nameEnglish: "Theory and Method in Science Studies",
    keywords: "philosophy of science, method, essay writing",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "AK", department: "Philosophy and History", educationLevelCode: "ADVANCED", gradeScaleCode: "PF",
    goals: "Write a short study of a scientific practice.",
    content: "Seminars and one essay.",
    eligibility: "120 hp",
    rounds: [round("1", "VT2026", "P3")] },
  { code: "ME2053", nameSwedish: "Projektledning", nameEnglish: "Project Management",
    keywords: "planning, stakeholders, group work",
    credits: 6, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "ME", department: "Industrial Economics", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Plan and follow up a project with a real stakeholder.",
    content: "Group work and seminars.",
    eligibility: "None",
    rounds: [round("1", "VT2026", "P4")] },
  { code: "DD2434", nameSwedish: "Maskininlärning, avancerad kurs", nameEnglish: "Machine Learning, Advanced Course",
    keywords: "graphical models, variational inference",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "JJ", department: "Computer Science", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Build a probabilistic model and reason about its inference cost.",
    content: "Probabilistic modelling from the ground up: latent variable models, variational inference and sampling, assessed by exam and a paper-reproduction project.",
    eligibility: "DD2421",
    rounds: [round("1", "VT2026", "P3")] },
  { code: "SF2955", nameSwedish: "Datorintensiva metoder i matematisk statistik",
    nameEnglish: "Computer Intensive Methods in Statistics",
    keywords: "Monte Carlo, resampling, sequential methods",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Choose a simulation method for an inference problem and justify it.",
    content: "Simulation-based inference: Monte Carlo, resampling and sequential methods, taught entirely through three long home assignments.",
    eligibility: "SF1918",
    rounds: [round("1", "VT2026", "P3–P4")] },
  { code: "SF2942", nameSwedish: "Portföljteori och riskvärdering", nameEnglish: "Portfolio Theory and Risk Management",
    keywords: "mean-variance, utility, risk measures",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "SF", department: "Mathematics", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Build and criticise a portfolio under a stated risk measure.",
    content: "Mean-variance portfolios, utility and coherent risk measures, with hand-ins that use real return series.",
    eligibility: "SF1918",
    rounds: [round("1", "HT2025", "P2")] },
  { code: "DH2642", nameSwedish: "Interaktionsprogrammering och den dynamiska webben",
    nameEnglish: "Interaction Programming and the Dynamic Web",
    keywords: "MVC, state, peer review, group project",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "DH", department: "Human Centered Technology", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Build a web client in a group and defend its interaction design.",
    content: "Builds a real web client in a group of four, with seminars on interaction patterns and two rounds of peer evaluation.",
    eligibility: "DD1337",
    rounds: [round("1", "HT2025", "P1–P2")] },
  { code: "EQ2300", nameSwedish: "Digital signalbehandling", nameEnglish: "Digital Signal Processing",
    keywords: "discrete filters, sampling, spectral estimation",
    credits: 7.5, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "EQ", department: "Information Science", educationLevelCode: "ADVANCED", gradeScaleCode: "AF",
    goals: "Design and analyse discrete-time filters.",
    content: "Discrete-time filters, sampling theory and spectral estimation, with weekly hand-ins feeding a written exam.",
    eligibility: "SF1626",
    rounds: [round("1", "HT2025", "P2")] },
  { code: "EQ1110", nameSwedish: "Signaler och system", nameEnglish: "Signals and Systems",
    keywords: "convolution, Fourier, sampling",
    credits: 9, creditUnit: "hp", state: "ESTABLISHED",
    departmentCode: "EQ", department: "Information Science", educationLevelCode: "BASIC", gradeScaleCode: "AF",
    goals: "Analyse linear systems in time and frequency.",
    content: "Convolution, Fourier and Laplace transforms, sampling.",
    eligibility: "SF1626",
    rounds: [round("1", "VT2026", "P3–P4")] }
];

/* One row per (user, course) the student has taken. Attendance only: whether
   the student is happy they took it belongs to the published review. */
export const userTakenCourses = [
  { userId: "u1", courseCode: "DD1337", attendancePeriods: ["P1", "P2"], attendanceYear: "HT2024",
    grade: "A", earnedCredits: 7.5, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "SF1624", attendancePeriods: ["P1", "P2"], attendanceYear: "HT2024",
    grade: "C", earnedCredits: 7.5, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "DD1338", attendancePeriods: ["P3", "P4"], attendanceYear: "VT2025",
    grade: "B", earnedCredits: 7.5, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "SF1626", attendancePeriods: ["P3", "P4"], attendanceYear: "VT2025",
    grade: "D", earnedCredits: 7.5, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "SF1918", attendancePeriods: ["P1"], attendanceYear: "HT2025",
    grade: "B", earnedCredits: 6, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "DD2421", attendancePeriods: ["P2"], attendanceYear: "HT2025",
    grade: "A", earnedCredits: 6, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "DD2380", attendancePeriods: ["P2"], attendanceYear: "HT2025",
    grade: "B", earnedCredits: 6, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "DD2424", attendancePeriods: ["P2"], attendanceYear: "HT2025",
    grade: null, earnedCredits: 7.5, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "AK2030", attendancePeriods: ["P3"], attendanceYear: "VT2026",
    grade: "P", earnedCredits: 7.5, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" },
  { userId: "u1", courseCode: "ME2053", attendancePeriods: ["P4"], attendanceYear: "VT2026",
    grade: "C", earnedCredits: 6, transcriptImportedAt: "2026-08-24T09:12:00Z",
    createdAt: "2026-08-24T09:12:00Z", updatedAt: "2026-08-24T09:12:00Z" }
];

/* A review is text plus scores. Workload and learning are always 1–10.
   "I don't remember" is null, never a zero. */
export const reviews = [
  { id: "r1", helpfulCount: 24, userId: "u1", courseCode: "DD2421",
    examinationDistribution: { exam: 50, assignments: 30, labs: 20, projects: 0, other: 0 },
    approachTheoryPercent: 65, workloadScore: 8, learningScore: 9,
    happyTook: true,
    message: "Do the assignments the week they open. The exam leans on the same derivations you meet there, so an assignment you rushed is an exam question you cannot answer.",
    createdAt: "2026-01-12T10:00:00Z", updatedAt: "2026-01-12T10:00:00Z" },
  { id: "r2", helpfulCount: 11, userId: "u1", courseCode: "DD2380",
    examinationDistribution: { exam: 40, assignments: 0, labs: 0, projects: 60, other: 0 },
    approachTheoryPercent: 45, workloadScore: 6, learningScore: 7,
    happyTook: true,
    message: "The project carries the course, so pick a group early. Search and planning are covered well; the probabilistic parts go fast.",
    createdAt: "2026-01-08T10:00:00Z", updatedAt: "2026-01-08T10:00:00Z" },
  { id: "r3", helpfulCount: 37, userId: "u1", courseCode: "SF1626",
    examinationDistribution: { exam: 100, assignments: 0, labs: 0, projects: 0, other: 0 },
    approachTheoryPercent: 90, workloadScore: 9, learningScore: 5,
    happyTook: false,
    message: "One exam, nothing else, and the practice exams are the only real preparation. Work old exams from week one rather than the textbook problems.",
    createdAt: "2025-06-03T10:00:00Z", updatedAt: "2025-06-03T10:00:00Z" },
  { id: "r4", helpfulCount: 8, userId: "u1", courseCode: "ME2053",
    examinationDistribution: null, approachTheoryPercent: null, workloadScore: 3, learningScore: 6,
    happyTook: true,
    message: "Light on hours and genuinely useful if you have never run a project. Take it in a term where your other courses are heavy.",
    createdAt: "2026-05-21T10:00:00Z", updatedAt: "2026-05-21T10:00:00Z" },
  { id: "r5", helpfulCount: 5, userId: "u1", courseCode: "AK2030",
    examinationDistribution: { exam: 0, assignments: 0, labs: 0, projects: 0, other: 100 },
    approachTheoryPercent: 80, workloadScore: 4, learningScore: 4,
    happyTook: false,
    message: "Pass or fail, and the essay is the whole thing. Write about something from your own field or the reading becomes a slog.",
    createdAt: "2026-04-14T10:00:00Z", updatedAt: "2026-04-14T10:00:00Z" },
  { id: "r6", helpfulCount: 63, userId: "u7", courseCode: "DD2424",
    examinationDistribution: { exam: 0, assignments: 60, labs: 0, projects: 40, other: 0 },
    approachTheoryPercent: 55, workloadScore: 9, learningScore: 10,
    happyTook: true,
    message: "Four assignments in plain numpy before any framework shows up, and that is why the course works. Budget a full weekend per assignment.",
    createdAt: "2026-02-02T10:00:00Z", updatedAt: "2026-02-02T10:00:00Z" },
  { id: "r7", helpfulCount: 41, userId: "u9", courseCode: "SF1918",
    examinationDistribution: { exam: 80, assignments: 0, labs: 20, projects: 0, other: 0 },
    approachTheoryPercent: 75, workloadScore: 5, learningScore: 7,
    happyTook: true,
    message: "Straightforward and well organised. Take it before machine learning if you can choose the order.",
    createdAt: "2025-12-18T10:00:00Z", updatedAt: "2025-12-18T10:00:00Z" },
  { id: "r8", helpfulCount: 58, userId: "u4", courseCode: "DD1338",
    examinationDistribution: { exam: 50, assignments: 50, labs: 0, projects: 0, other: 0 },
    approachTheoryPercent: 60, workloadScore: 7, learningScore: 9,
    happyTook: true,
    message: "Assignments are graded on complexity, not on whether it runs, so read the requirements twice before writing anything.",
    createdAt: "2025-06-09T10:00:00Z", updatedAt: "2025-06-09T10:00:00Z" },
  { id: "r9", helpfulCount: 19, userId: "u5", courseCode: "EQ1110",
    examinationDistribution: { exam: 100, assignments: 0, labs: 0, projects: 0, other: 0 },
    approachTheoryPercent: 85, workloadScore: 8, learningScore: 6,
    happyTook: false,
    message: "Heavy maths and a fast pace. Doable, but only if calculus is fresh.",
    createdAt: "2026-05-27T10:00:00Z", updatedAt: "2026-05-27T10:00:00Z" }
];

/* Who signs a review. `users.name` is required, so a review always carries a
   name; there is no anonymity column in the target schema. */
export const users = {
  u1: { id: "u1", name: "Elsa Lindqvist", email: "elsa@kth.se", emailVerified: true,
        image: null, personalizationTierEarned: 2 },
  u4: { id: "u4", name: "Oskar Ahlin", personalizationTierEarned: 0 },
  u5: { id: "u5", name: "Maja Ek", personalizationTierEarned: 0 },
  u7: { id: "u7", name: "Nils Berg", personalizationTierEarned: 3 },
  u9: { id: "u9", name: "Jonas Wall", personalizationTierEarned: 1 }
};

/* Aggregates a backend would compute. Never derived per page, never zero-filled. */
export const courseMetrics = {
  DD2380: { reviewCount: 214, writtenReviewCount: 154, enrolledCount: 1180, happyAnswerCount: 38,
    themeLine: "Start the labs early; rewarding", missingNote: null, averageWorkloadScore: 7.4, averageLearningScore: 8.1, happyTookPercent: 82,
    averageTheoryPercent: 58, examinationDistribution: { exam: 34, assignments: 29, labs: 37, projects: 0, other: 0 } },
  DD2421: { reviewCount: 341, writtenReviewCount: 246, enrolledCount: 1640, happyAnswerCount: 57,
    themeLine: "Lab 2 is the whole course", missingNote: null, averageWorkloadScore: 6.8, averageLearningScore: 8.8, happyTookPercent: 91,
    averageTheoryPercent: 46, examinationDistribution: { exam: 22, assignments: 60, labs: 18, projects: 0, other: 0 } },
  DD2424: { reviewCount: 96, writtenReviewCount: 69, enrolledCount: 940, happyAnswerCount: 44,
    themeLine: "The hardest course I took, but worth it", missingNote: null, averageWorkloadScore: 9.0, averageLearningScore: 9.6, happyTookPercent: 88,
    averageTheoryPercent: 55, examinationDistribution: { exam: 0, assignments: 60, labs: 0, projects: 40, other: 0 } },
  DD1337: { reviewCount: 402, writtenReviewCount: 289, enrolledCount: 2450, happyAnswerCount: 96,
    themeLine: "Start the assignments the week they open", missingNote: null, averageWorkloadScore: 6.2, averageLearningScore: 8.0, happyTookPercent: 86,
    averageTheoryPercent: 35, examinationDistribution: { exam: 40, assignments: 40, labs: 20, projects: 0, other: 0 } },
  DD1338: { reviewCount: 288, writtenReviewCount: 207, enrolledCount: 1720, happyAnswerCount: 74,
    themeLine: "Complexity, not correctness, is graded", missingNote: null, averageWorkloadScore: 7.8, averageLearningScore: 9.0, happyTookPercent: 84,
    averageTheoryPercent: 60, examinationDistribution: { exam: 50, assignments: 50, labs: 0, projects: 0, other: 0 } },
  SF1624: { reviewCount: 356, writtenReviewCount: 256, enrolledCount: 2600, happyAnswerCount: 91,
    themeLine: "Old exams are the preparation", missingNote: null, averageWorkloadScore: 7.0, averageLearningScore: 7.2, happyTookPercent: 71,
    averageTheoryPercent: 88, examinationDistribution: { exam: 90, assignments: 10, labs: 0, projects: 0, other: 0 } },
  SF1626: { reviewCount: 331, writtenReviewCount: 238, enrolledCount: 2380, happyAnswerCount: 84,
    themeLine: "One exam and nothing else", missingNote: null, averageWorkloadScore: 8.6, averageLearningScore: 6.4, happyTookPercent: 54,
    averageTheoryPercent: 90, examinationDistribution: { exam: 100, assignments: 0, labs: 0, projects: 0, other: 0 } },
  SF1918: { reviewCount: 274, writtenReviewCount: 197, enrolledCount: 2310, happyAnswerCount: 88,
    themeLine: "The lectures help, but old exams are essential", missingNote: null, averageWorkloadScore: 6.0, averageLearningScore: 7.6, happyTookPercent: 79,
    averageTheoryPercent: 75, examinationDistribution: { exam: 80, assignments: 0, labs: 20, projects: 0, other: 0 } },
  AK2030: { reviewCount: 118, writtenReviewCount: 85, enrolledCount: 690, happyAnswerCount: 28,
    themeLine: "The seminars are the better half", missingNote: null, averageWorkloadScore: 4.4, averageLearningScore: 4.8, happyTookPercent: 41,
    averageTheoryPercent: 80, examinationDistribution: { exam: 0, assignments: 0, labs: 0, projects: 0, other: 100 } },
  ME2053: { reviewCount: 143, writtenReviewCount: 103, enrolledCount: 880, happyAnswerCount: 33,
    themeLine: "Light load, useful in practice", missingNote: null, averageWorkloadScore: 4.0, averageLearningScore: 6.2, happyTookPercent: 77,
    averageTheoryPercent: 25, examinationDistribution: { exam: 0, assignments: 0, labs: 0, projects: 70, other: 30 } },
  EQ1110: { reviewCount: 87, writtenReviewCount: 63, enrolledCount: 520, happyAnswerCount: 19,
    themeLine: "Only worth it with fresh calculus", missingNote: null, averageWorkloadScore: 8.4, averageLearningScore: 6.6, happyTookPercent: 58,
    averageTheoryPercent: 85, examinationDistribution: { exam: 100, assignments: 0, labs: 0, projects: 0, other: 0 } },
  DD2434: { reviewCount: 96, writtenReviewCount: 69, enrolledCount: 410, happyAnswerCount: 17,
    themeLine: "Maths-first; read ahead", missingNote: null, averageWorkloadScore: 8.8, averageLearningScore: 7.9, happyTookPercent: 68,
    averageTheoryPercent: 82, examinationDistribution: { exam: 58, assignments: 0, labs: 0, projects: 42, other: 0 } },
  SF2955: { reviewCount: 87, writtenReviewCount: 63, enrolledCount: 330, happyAnswerCount: 14,
    themeLine: "Do the hand-ins with someone", missingNote: "No examination breakdown yet", averageWorkloadScore: 7.6, averageLearningScore: 8.1, happyTookPercent: 79,
    averageTheoryPercent: 64, examinationDistribution: null },
  SF2942: { reviewCount: 118, writtenReviewCount: 85, enrolledCount: 470, happyAnswerCount: 21,
    themeLine: "Clear lectures, light load", missingNote: null, averageWorkloadScore: 4.6, averageLearningScore: 7.0, happyTookPercent: 81,
    averageTheoryPercent: 68, examinationDistribution: { exam: 64, assignments: 0, labs: 0, projects: 36, other: 0 } },
  DH2642: { reviewCount: 176, writtenReviewCount: 127, enrolledCount: 820, happyAnswerCount: 31,
    themeLine: "Pick your group in week one", missingNote: null, averageWorkloadScore: 6.4, averageLearningScore: 7.4, happyTookPercent: 84,
    averageTheoryPercent: 28, examinationDistribution: { exam: 0, assignments: 0, labs: 0, projects: 100, other: 0 } },
  EQ2300: { reviewCount: 143, writtenReviewCount: 103, enrolledCount: 610, happyAnswerCount: 26,
    themeLine: "Do the hand-ins with someone", missingNote: null, averageWorkloadScore: 8.2, averageLearningScore: 7.3, happyTookPercent: 71,
    averageTheoryPercent: 76, examinationDistribution: { exam: 70, assignments: 30, labs: 0, projects: 0, other: 0 } },
  DD2437: { reviewCount: 0, writtenReviewCount: 0, enrolledCount: 560, happyAnswerCount: 0,
    themeLine: "No themes yet", missingNote: "No reviews yet", averageWorkloadScore: null, averageLearningScore: null, happyTookPercent: null,
    averageTheoryPercent: null, examinationDistribution: null },
  DD2412: { reviewCount: 4, writtenReviewCount: 3, enrolledCount: 120, happyAnswerCount: 4,
    themeLine: "Reading-heavy, small cohort", missingNote: "Not enough reviews for an examination split", averageWorkloadScore: 8.0, averageLearningScore: 9.0, happyTookPercent: null,
    averageTheoryPercent: null, examinationDistribution: null }
};

/* A correction made on Taken courses is an edit to this user_taken_courses
   row — persisted locally and reapplied on load, so credits, grade and term
   read the same everywhere the course is taken from, not just on that page. */
const TAKEN_OVERRIDES_KEY = "cc:takenOverrides";
const overrideKey = (userId, code) => userId + ":" + code;

/* Helpfulness and "liked" are joins between a user and a review, not fields
   on the review itself — no dedicated table in the target schema, so the
   pick rides in storage the same way personalization does. */
const LIKED_REVIEWS_KEY = "cc:likedReviews";
const DEFAULT_LIKED = { u1: ["r6", "r7", "r8", "r9"] };
function loadLikedReviews() {
  try {
    const raw = window.localStorage.getItem(LIKED_REVIEWS_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_LIKED;
  } catch (e) { return DEFAULT_LIKED; }
}
export const likedReviewIds = (userId) => (loadLikedReviews()[userId] || []).slice();
export function setLikedReviewIds(userId, ids) {
  const all = loadLikedReviews();
  all[userId] = ids.slice();
  try { window.localStorage.setItem(LIKED_REVIEWS_KEY, JSON.stringify(all)); } catch (e) {}
}

function loadTakenOverrides() {
  try { return JSON.parse(window.localStorage.getItem(TAKEN_OVERRIDES_KEY) || "{}"); }
  catch (e) { return {}; }
}

/** patch: any of { earnedCredits, grade, attendanceYear }. */
export function setTakenOverride(userId, code, patch) {
  const overrides = loadTakenOverrides();
  const key = overrideKey(userId, code);
  overrides[key] = { ...(overrides[key] || {}), ...patch };
  try { window.localStorage.setItem(TAKEN_OVERRIDES_KEY, JSON.stringify(overrides)); } catch (e) { /* storage off */ }
  const row = userTakenCourses.find((r) => r.userId === userId && r.courseCode === code);
  if (row) Object.assign(row, patch, { updatedAt: new Date().toISOString() });
}

(function applyTakenOverrides() {
  const overrides = loadTakenOverrides();
  userTakenCourses.forEach((row) => {
    const patch = overrides[overrideKey(row.userId, row.courseCode)];
    if (patch) Object.assign(row, patch);
  });
})();

/* Rows a transcript import produces, in userTakenCourse shape. A row whose code
   is absent from `courses` is a genuine conflict, not a probability. */
export const transcriptImports = {
  first: {
    fileName: "resultatintyg-2026-08-24.pdf", fileSize: "412 KB", pageCount: 3, readAt: "2026-08-24",
    rows: userTakenCourses.map((r) => ({ ...r })).concat([
      { userId: "u1", courseCode: "MJ2426", courseName: "Sustainable Energy Utilisation",
        attendancePeriods: ["P3"], attendanceYear: "VT2026", grade: "B", earnedCredits: 7.5,
        conflict: "unknown-course" },
      { userId: "u1", courseCode: null, courseName: "Machine Perception (exchange, KU Leuven)",
        attendancePeriods: ["P4"], attendanceYear: "VT2026", grade: "P", earnedCredits: 6,
        conflict: "free-form" }
    ])
  },
  second: {
    fileName: "resultatintyg-2027-01-18.pdf", fileSize: "438 KB", pageCount: 3, readAt: "2027-01-18",
    rows: [
      { userId: "u1", courseCode: "DD2437", attendancePeriods: ["P1", "P2"], attendanceYear: "HT2026",
        grade: "B", earnedCredits: 7.5 },
      { userId: "u1", courseCode: "DD2412", attendancePeriods: ["P2"], attendanceYear: "HT2026",
        grade: "A", earnedCredits: 7.5 },
      { userId: "u1", courseCode: "DD2424", attendancePeriods: ["P2"], attendanceYear: "HT2025",
        grade: "A", earnedCredits: 7.5 }
    ]
  }
};

/* Grade points are configuration, not data — the scale KTH publishes (A-E, with
   F/P/FX carrying no grade point and excluded from the average). One named
   function computes the GPA everywhere it is shown, rather than each page
   re-deriving it from userTakenCourses inline. */
export const GRADE_POINTS = { A: 5, B: 4, C: 3, D: 2, E: 1 };

/** Credit-weighted average over graded courses only; ungraded rows (F/P/no
    grade yet) are excluded from both the numerator and the denominator. */
export function gpaFor(userId) {
  let points = 0, gradedCredits = 0;
  takenCourses(userId).forEach((t) => {
    const p = GRADE_POINTS[t.grade];
    if (p == null) return;
    gradedCredits += t.earnedCredits || 0;
    points += p * (t.earnedCredits || 0);
  });
  return { average: gradedCredits ? points / gradedCredits : null, gradedCredits: gradedCredits };
}

/** Every review draft assembles the same nullable-json shape: the five
    EXAMINATION_KEYS, each a 0-100 share. Only the draft's own picked methods
    get a value; every other key is explicitly 0, never omitted — so the
    object this returns is always "full" (all 5 keys) even though a stored
    review's examinationDistribution may also legitimately be null ("I don't
    remember"). One constructor, called from every page that posts a review,
    instead of three copies of the same literal. */
export function examinationDistributionFrom(items, pcts) {
  const out = {};
  EXAMINATION_KEYS.forEach((k) => { out[k] = 0; });
  items.forEach((m, i) => { out[m.key] = pcts[i] || 0; });
  return out;
}

/* One row per contact-form submission — feedback_form: id, name, email,
   message, created_at. Mirrors reviews: pages push straight onto this array
   rather than keeping their own copy. */
export const feedbackForm = [];
export function submitFeedback(entry) {
  const row = { id: "f" + Date.now(), name: entry.name, email: entry.email, message: entry.message, createdAt: new Date().toISOString() };
  feedbackForm.push(row);
  return row;
}

/* Shared page-content cap. Every top-level page shell reads this instead of
   hardcoding its own 1216px literal, so the width stays one source of truth
   across Explore/Saved/My Page. Side padding stays per-page (it already
   varies with each page's own edge spacing) — only the cap itself is shared. */
export const PAGE_MAX_WIDTH = "1216px";
export const PAGE_SIDE_PADDING = "20px";

export const savedCourses = {
  local: ["DD2421", "DD2437"],
  account: ["DD2380", "DD2424", "SF1918", "DD2412"]
};

export const collections = [
  { id: "c1", name: "Autumn electives", codes: ["DD2424", "DD2412", "DD2437"], updated: "2 days ago" },
  { id: "c2", name: "Might swap for ML", codes: ["DD2421", "DD2380"], updated: "1 week ago" },
  { id: "c3", name: "Statistics electives", codes: ["SF1918", "DD2421"], updated: "3 weeks ago" }
];

/* Collection CRUD lives here, not in each page's own state — mutating this one
   array in place, the same way STORE.reviews.push() is the single write path
   for a review. Any page holding `collections` is just reading this array. */
export function createCollection(name, codes) {
  const col = { id: "c" + Date.now(), name: name, codes: (codes || []).slice(), updated: "just now" };
  collections.unshift(col);
  return col;
}
export function renameCollection(id, name) {
  const c = collections.find((x) => x.id === id);
  if (c && name && name.trim()) { c.name = name.trim(); c.updated = "just now"; }
  return c || null;
}
export function deleteCollection(id) {
  const i = collections.findIndex((x) => x.id === id);
  if (i >= 0) collections.splice(i, 1);
}
export function addCourseToCollection(id, code) {
  const c = collections.find((x) => x.id === id);
  if (c && c.codes.indexOf(code) < 0) { c.codes.push(code); c.updated = "just now"; }
  return c || null;
}
export function removeCourseFromCollection(id, code) {
  const c = collections.find((x) => x.id === id);
  if (c) { c.codes = c.codes.filter((k) => k !== code); c.updated = "just now"; }
  return c || null;
}

/* ---------------------- course_explore (derived search) ----------------------
   `courses` carries no keyword column in the target schema. The terms that fed
   the search vector live here, one row per course, and the cards read tags from
   this table rather than from the course record. */
export const courseExplore = {};
courses.forEach((c) => {
  const terms = (c.keywords || "").trim();
  courseExplore[c.code] = {
    courseCode: c.code,
    searchTerms: terms,
    sourceHash: "h" + c.code,
    embeddingModel: terms ? "text-embedding-3-small" : null,
    embeddedAt: terms ? "2026-08-24T09:00:00Z" : null
  };
  delete c.keywords;
});

export const exploreTags = (code) => {
  const row = courseExplore[code];
  if (!row || !row.searchTerms) return [];
  return row.searchTerms.split(",").map((s) => s.trim()).filter(Boolean);
};

/** Stand-in for `search_vector`: the text full-text search would match on. */
export function searchDocument(code, locale) {
  const c = getCourse(code);
  if (!c) return "";
  return [c.code, c.nameSwedish, c.nameEnglish, exploreTags(code).join(" "), c.content || ""]
    .join(" ").toLowerCase();
}

/** Full-text-style match: every term in the query must appear in the document. */
export function matchesQuery(code, query, locale) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const doc = searchDocument(code, locale);
  return q.split(/\s+/).every((term) => doc.indexOf(term) >= 0);
}

/* ------------------------- course_prerequisites -------------------------
   Directed pairs of course codes. `courses.eligibility` keeps the source prose;
   these are the extracted relationships the UI links. */
export const coursePrerequisites = [
  { courseCode: "DD2380", prerequisiteCourseCode: "DD1337" },
  { courseCode: "DD2380", prerequisiteCourseCode: "SF1918" },
  { courseCode: "DD2421", prerequisiteCourseCode: "DD1337" },
  { courseCode: "DD2421", prerequisiteCourseCode: "SF1918" },
  { courseCode: "DD2424", prerequisiteCourseCode: "DD2421" },
  { courseCode: "DD2424", prerequisiteCourseCode: "SF1624" },
  { courseCode: "DD2434", prerequisiteCourseCode: "DD2421" },
  { courseCode: "DD2412", prerequisiteCourseCode: "DD2424" },
  { courseCode: "DD2437", prerequisiteCourseCode: "DD2421" },
  { courseCode: "DD1338", prerequisiteCourseCode: "DD1337" },
  { courseCode: "SF1626", prerequisiteCourseCode: "SF1624" },
  { courseCode: "SF1918", prerequisiteCourseCode: "SF1624" },
  { courseCode: "SF2955", prerequisiteCourseCode: "SF1918" },
  { courseCode: "SF2942", prerequisiteCourseCode: "SF1918" },
  { courseCode: "EQ2300", prerequisiteCourseCode: "SF1683" },
  { courseCode: "EQ1110", prerequisiteCourseCode: "SF1624" },
  { courseCode: "DH2642", prerequisiteCourseCode: "DD1337" }
];

/** The prerequisites of a course, each resolvable to a course page. */
export const prerequisitesOf = (code, locale) =>
  coursePrerequisites
    .filter((p) => p.courseCode === code)
    .map((p) => {
      const c = getCourse(p.prerequisiteCourseCode);
      return { code: p.prerequisiteCourseCode, name: c ? courseName(c, locale) : null, inCatalog: Boolean(c) };
    });

/* ------------------------------ term labels ------------------------------
   `attendance_year` and `course_rounds.start_term` are integers: the suffix 1
   is spring, 2 is autumn. Every surface writes them as HT25 / VT26. */
export function termLabel(value) {
  if (value == null) return null;
  const s = String(value);
  const m = /^(HT|VT)(\d{2})(\d{2})?$/i.exec(s);
  if (m) return m[1].toUpperCase() + (m[3] || m[2]);
  const n = /^(\d{4})([12])$/.exec(s);
  if (!n) return s;
  return (n[2] === "2" ? "HT" : "VT") + n[1].slice(2);
}

/** The academic-year integer a term label belongs to, for sorting. */
export const termOrder = (value) => {
  const l = termLabel(value);
  if (!l) return 0;
  const y = parseInt(l.slice(2), 10) + 2000;
  return y * 10 + (l.slice(0, 2) === "HT" ? 2 : 1);
};

/** The 4-digit calendar year out of any of the formats a term has been
    stored in — "HT2024", "HT24", "2024", or the raw "20242" round code. */
export function yearOf(value) {
  if (value == null) return null;
  const s = String(value);
  let m = /^(?:HT|VT)(\d{4})$/i.exec(s);
  if (m) return parseInt(m[1], 10);
  m = /^(?:HT|VT)(\d{2})$/i.exec(s);
  if (m) return 2000 + parseInt(m[1], 10);
  m = /^(\d{4})[12]?$/.exec(s);
  if (m) return parseInt(m[1], 10);
  return null;
}

/** P1/P2 fall in the autumn term, P3/P4 in the spring — the season is never
    stored on its own, it is always derivable from the periods. */
export function seasonFromPeriods(periods) {
  if (!periods || !periods.length) return "HT";
  return periods.some((p) => p === "P1" || p === "P2") ? "HT" : "VT";
}

/** The season+year label a stored attendance_year/attendance_periods pair
    reads as — the only representation termLabel() and every display need. */
export function termFromPeriodsYear(periods, year) {
  if (year == null) return null;
  return seasonFromPeriods(periods) + String(year).slice(-2);
}

/* ------------------------------- graph tables -------------------------------
   The community is a persistent global graph in world coordinates. Positions,
   anchors and node appearance are stored; screen coordinates are derived. */
const rnd = (i, salt) => {
  const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const NODE_STYLES = ["solid", "ring", "diamond"];
export const NODE_SIGNAL_STYLES = ["fade", "comet", "dashed"];
export const NODE_COLORS = ["#1751a6", "#2f9e8e", "#dfa53c", "#6a4ea8", "#c96a4a"];

export const usersGraphNodes = [];
export const usersNodeProfiles = {};
export const usersGraphBackboneEdges = [];

/* 60 accounts spread over a world box; the viewer's own node is u1 near the
   middle, so a bounded viewport always has neighbours to show. */
(function seedGraph() {
  const ids = ["u1", "u4", "u5", "u7", "u9"];
  for (let i = ids.length; i < 60; i++) ids.push("kth-" + (1000 + i));
  ids.forEach((id, i) => {
    const angle = rnd(i, 3) * Math.PI * 2;
    const radius = i === 0 ? 0 : 120 + Math.sqrt(rnd(i, 5)) * 900;
    usersGraphNodes.push({
      userId: id,
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
      createdAt: "2026-08-24T09:00:00Z",
      updatedAt: "2026-08-24T09:00:00Z"
    });
  });
  // Tier 0 accounts keep the default look; only personalized nodes carry a row.
  usersNodeProfiles.u1 = { userId: "u1", color: "#2f9e8e", style: "ring", signalStyle: "comet" };
  usersNodeProfiles.u9 = { userId: "u9", color: "#dfa53c", style: "solid", signalStyle: "fade" };
  usersNodeProfiles.u7 = { userId: "u7", color: "#6a4ea8", style: "diamond", signalStyle: "dashed" };
  // On joining, a node anchors to 3–5 established nodes near it.
  usersGraphNodes.forEach((n, i) => {
    if (i === 0) return;
    const older = usersGraphNodes.slice(0, i)
      .map((o) => ({ o, d: Math.hypot(o.x - n.x, o.y - n.y) }))
      .sort((a, b) => a.d - b.d);
    const want = 3 + Math.floor(rnd(i, 7) * 3);
    older.slice(0, Math.min(want, older.length)).forEach((c) => {
      usersGraphBackboneEdges.push({
        nodeUserId: n.userId, anchorUserId: c.o.userId, createdAt: "2026-08-24T09:00:00Z"
      });
    });
  });
})();

export const graphNode = (userId) => usersGraphNodes.find((n) => n.userId === userId) || null;
export const nodeProfile = (userId) => usersNodeProfiles[userId] || null;

/** The bounded neighbourhood the landing page renders: nearest nodes to the
    viewer's persisted position, plus only the edges inside that set. */
export function graphNeighborhood(userId, max) {
  const me = graphNode(userId) || usersGraphNodes[0];
  const limit = max || 48;
  const near = usersGraphNodes
    .map((n) => ({ n, d: Math.hypot(n.x - me.x, n.y - me.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.n);
  const inSet = {};
  near.forEach((n) => { inSet[n.userId] = true; });
  const edges = usersGraphBackboneEdges.filter((e) => inSet[e.nodeUserId] && inSet[e.anchorUserId]);
  return {
    origin: { x: me.x, y: me.y },
    me: me.userId,
    nodes: near.map((n) => ({
      userId: n.userId, x: n.x, y: n.y,
      profile: nodeProfile(n.userId)
    })),
    edges: edges.map((e) => ({ from: e.nodeUserId, to: e.anchorUserId }))
  };
}

/* --------------------------- personalization tier ---------------------------
   Tier 1 unlocks colour, 2 the signal trail, 3 the node shape. It is earned by
   importing a transcript and reviewing every catalog course in it; free-form
   rows are excluded. The effective tier may decay one step per six months
   without a qualifying review, and never rewrites the earned value. */
export const TIER_AXES = { 1: "color", 2: "signalStyle", 3: "style" };

export const earnedTier = (userId) => {
  const u = users[userId];
  return u && u.personalizationTierEarned != null ? u.personalizationTierEarned : 0;
};

/* Personalization picks (dot color/style/signal) persist locally, the same
   way taken-course edits do — no dedicated table in the target schema beyond
   users.personalization_tier_unlocked, so the pick itself rides in storage. */
const PERSONALIZATION_KEY = "cc:personalization";
function loadPersonalization() {
  try { return JSON.parse(window.localStorage.getItem(PERSONALIZATION_KEY) || "{}"); }
  catch (e) { return {}; }
}
export function setPersonalization(userId, patch) {
  const all = loadPersonalization();
  all[userId] = { ...(all[userId] || {}), ...patch };
  try { window.localStorage.setItem(PERSONALIZATION_KEY, JSON.stringify(all)); } catch (e) {}
}

export const DOT_COLORS = ["#1751a6", "#1c6b60", "#8a4fae", "#b3541e", "#57646f"];
export const DOT_STYLES = ["solid", "ring", "diamond"];
export const DOT_SIGNALS = ["ripple", "pulse", "spark"];

/** Currently-picked value on one axis, falling back to the first option. */
export function personalizationPicks(userId) {
  return loadPersonalization()[userId] || {};
}

export function effectiveTier(userId, now) {
  const earned = earnedTier(userId);
  if (!earned) return 0;
  const mine = reviewsByUser(userId);
  if (!mine.length) return earned;
  const latest = mine.map((r) => new Date(r.createdAt).getTime()).sort((a, b) => b - a)[0];
  const months = (( (now ? new Date(now) : new Date()).getTime() - latest) / 2592000000);
  const steps = Math.floor(months / 6);
  return Math.max(0, earned - Math.max(0, steps));
}

/** Which axes a user may currently edit, and which have decayed away. */
export function tierAxes(userId, now) {
  const eff = effectiveTier(userId, now);
  const earned = earnedTier(userId);
  return {
    earned, effective: eff,
    unlocked: [1, 2, 3].filter((t) => t <= eff).map((t) => TIER_AXES[t]),
    // Values stay stored while an axis is dormant; reviewing again restores them.
    dormant: [1, 2, 3].filter((t) => t > eff && t <= earned).map((t) => TIER_AXES[t])
  };
}

/* ------------------------------- selectors ------------------------------- */

/* A course shows its summary line only past this many written reviews. */
export const WRITTEN_THEME_THRESHOLD = 10;

/** Initials for an avatar fallback; `users.image` holds the real one. */
export const userInitials = (userId) => {
  const u = users[userId];
  if (!u || !u.name) return "?";
  return u.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
};

export const userName = (userId) => (users[userId] && users[userId].name) || null;

/** The review a user published for a course, if any. */
export const reviewFor = (userId, code) =>
  reviews.find((r) => r.userId === userId && r.courseCode === code) || null;

/** Whether the student said they were happy they took it — a review answer. */
export const happyTookFor = (userId, code) => {
  const r = reviewFor(userId, code);
  return r ? r.happyTook : null;
};
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Dates are stored ISO and formatted in the view. */
export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
}


const byCode = {};
courses.forEach((c) => { byCode[c.code] = c; });

export const getCourse = (code) => byCode[code] || null;

/** The one resolved localized name every component should read. */
export const courseName = (course, locale) =>
  !course ? null : locale === "sv" ? course.nameSwedish : course.nameEnglish;

/** Formatting lives in the view, never in the record. */
/* One decimal, the way KTH writes credits: 7.5 hp, 6.0 hp. */
export const creditsLabel = (course) =>
  !course ? null : Number(course.credits).toFixed(1) + " " + course.creditUnit;

export const courseRound = (course, startTerm) => {
  if (!course || !course.rounds.length) return null;
  if (!startTerm) return course.rounds[course.rounds.length - 1];
  return course.rounds.find((r) => r.startTerm === startTerm) || course.rounds[course.rounds.length - 1];
};

/** Presentation model for a course anywhere it is listed. */
export function courseView(code, opts) {
  const o = opts || {};
  const course = getCourse(code);
  if (!course) return null;
  const r = courseRound(course, o.startTerm);
  return {
    code: course.code,
    name: courseName(course, o.locale),
    credits: course.credits,
    creditsLabel: creditsLabel(course),
    department: course.department,
    departmentCode: course.departmentCode,
    level: course.educationLevelCode,
    gradeScaleCode: course.gradeScaleCode,
    summary: course.content,
    goals: course.goals,
    eligibility: course.eligibility,
    startTerm: r ? r.startTerm : null,
    startTermLabel: r ? String(yearOf(r.startTerm) || "") : null,
    periodLabel: r ? r.periodLabel : null,
    language: r ? r.language : null,
    rounds: course.rounds
  };
}

export const getMetrics = (code) => courseMetrics[code] || null;

/** Aggregate view. Nulls stay null so the UI can say "not enough reviews". */
export function metricsView(code) {
  // Derived live from the reviews table — not a separate stored aggregate —
  // so a course with zero reviews can never show a workload, learning, or
  // happy-percent number, and the review count always matches what a card's
  // own "Read all N reviews" link actually opens.
  const rows = reviews.filter((r) => r.courseCode === code);
  if (!rows.length) return null;
  const avg = (key) => {
    const vals = rows.map((r) => r[key]).filter((v) => v != null);
    return vals.length ? vals.reduce((a, v) => a + v, 0) / vals.length : null;
  };
  const happyRows = rows.filter((r) => r.happyTook != null);
  const written = rows.filter((r) => r.message && r.message.trim()).length;
  const examKeys = ["exam", "assignments", "labs", "projects", "other"];
  const examRows = rows.filter((r) => r.examinationDistribution);
  const examination = examRows.length
    ? examKeys.reduce((acc, k) => {
        acc[k] = Math.round(examRows.reduce((a, r) => a + (r.examinationDistribution[k] || 0), 0) / examRows.length);
        return acc;
      }, {})
    : null;
  return {
    reviewCount: rows.length,
    writtenReviewCount: written,
    hasThemeLine: written >= WRITTEN_THEME_THRESHOLD,
    workload: avg("workloadScore"),
    learning: avg("learningScore"),
    happyTookPercent: happyRows.length ? Math.round(100 * happyRows.filter((r) => r.happyTook).length / happyRows.length) : null,
    theoryPercent: avg("approachTheoryPercent"),
    examination,
    hasScores: avg("workloadScore") != null && avg("learningScore") != null,
    hasExamination: examination != null
  };
}

/** Examination split as ordered segments, labels from configuration. */
export function examinationSegments(distribution, locale) {
  if (!distribution) return [];
  const labels = EXAMINATION_LABELS[locale === "sv" ? "sv" : "en"];
  return EXAMINATION_KEYS
    .filter((k) => (distribution[k] || 0) > 0)
    .map((k) => ({
      key: k, label: labels[k], percent: distribution[k],
      color: EXAMINATION_COLORS[k], ink: EXAMINATION_INK[k]
    }));
}

/* "Exam + labs" style summary, derived from the distribution, never stored. */
export function assessmentLabel(distribution, locale) {
  const segs = examinationSegments(distribution, locale);
  if (!segs.length) return null;
  const top = segs.slice().sort((a, b) => b.percent - a.percent).slice(0, 2);
  return top.map((x) => x.label).join(" + ");
}

/* The card model both Explore and Saved render. One place, one shape: pages
   pass course codes and read this. */
export function catalogCardView(code, opts) {
  const o = opts || {};
  const course = getCourse(code);
  if (!course) return null;
  const view = courseView(code, o);
  const m = metricsView(code);
  const raw = getMetrics(code) || {};
  const segs = m ? examinationSegments(m.examination, o.locale) : [];
  return {
    code: course.code,
    title: view.name,
    hp: view.creditsLabel,
    school: schoolOf(course),
    period: view.periodLabel,
    startTerm: view.startTerm,
    meta: view.creditsLabel + " · " + course.code + " · " + schoolOf(course),
    // Tags come from course_explore; the course record has no keyword column.
    keywords: exploreTags(code).join(", "),
    keywordTags: exploreTags(code),
    // Extracted code pairs; `eligibility` keeps the source prose.
    prereqCourses: prerequisitesOf(code, o.locale),
    prereq: prerequisitesOf(code, o.locale).map((p) => p.code).join(", "),
    eligibility: course.eligibility,
    summary: course.content,
    content: course.content,
    assessment: assessmentLabel(m ? m.examination : null, o.locale) || "—",
    // The one-line summary only appears once a course has 10 written reviews.
    themes: m && m.hasThemeLine ? raw.themeLine || null : null,
    missing: raw.missingNote || null,
    // Percentage shares, in the fixed category order the cards draw.
    ex: segs.map((x) => x.percent),
    exSegments: segs,
    th: m ? m.theoryPercent : null,
    // 1–10 scores, rendered as a 0–100 bar width by the cards.
    workloadScore: m ? m.workload : null,
    learningScore: m ? m.learning : null,
    wl: m && m.workload != null ? Math.round(m.workload * 10) : null,
    le: m && m.learning != null ? Math.round(m.learning * 10) : null,
    happy: m ? m.happyTookPercent : null,
    reviewCount: m ? m.reviewCount : 0,
    enrolledCount: raw.enrolledCount != null ? raw.enrolledCount : null,
    happyAnswerCount: raw.happyAnswerCount != null ? raw.happyAnswerCount : null,
    stats: [
      String(m ? m.reviewCount : 0),
      raw.enrolledCount == null ? "—" : String(raw.enrolledCount),
      m ? String(m.reviewCount) : "0"
    ]
  };
}

export const catalogCards = (opts) => courses.map((c) => catalogCardView(c.code, opts)).filter(Boolean);

export const takenCourses = (userId) =>
  userTakenCourses.filter((r) => r.userId === (userId || "u1"));

/** A taken course joined with its course record. */
export function takenView(row, opts) {
  const o = opts || {};
  const view = row.courseCode ? courseView(row.courseCode, { locale: o.locale, startTerm: row.attendanceYear }) : null;
  return {
    courseCode: row.courseCode,
    name: view ? view.name : row.courseName || null,
    // Earned credits are the student's own record, not the catalog's fixed
    // value — self-reported and editable, so it wins when present.
    credits: row.earnedCredits != null ? row.earnedCredits : (view ? view.credits : null),
    creditsLabel: (row.earnedCredits != null ? row.earnedCredits : (view ? view.credits : "—")) + " hp",
    attendanceYear: row.attendanceYear,
    attendancePeriods: row.attendancePeriods,
    periodLabel: row.attendancePeriods ? row.attendancePeriods.join("–") : null,
    grade: row.grade,
    attendanceTerm: row.attendanceYear != null ? String(yearOf(row.attendanceYear) || "") : null,
    // `happy_took` belongs to the published review, never to attendance.
    happyTook: happyTookFor(row.userId || "u1", row.courseCode),
    reviewed: Boolean(reviewFor(row.userId || "u1", row.courseCode)),
    inCatalog: Boolean(view),
    conflict: row.conflict || (row.courseCode && !view ? "unknown-course" : null)
  };
}

export const reviewsByUser = (userId) => reviews.filter((r) => r.userId === userId);
export const reviewsByCourse = (code) => reviews.filter((r) => r.courseCode === code);

export const takenRecord = (userId, code) =>
  userTakenCourses.find((r) => r.userId === userId && r.courseCode === code) || null;

/** A single review joined with its course and the attendance it belongs to. */
export function reviewView(review, opts) {
  const o = opts || {};
  const course = courseView(review.courseCode, { locale: o.locale });
  const taken = takenRecord(review.userId, review.courseCode);
  // A reviewer outside the mock student's own records still has a round to name.
  const fallbackTerm = course ? course.startTerm : null;
  // `users.name` is required and there is no anonymity column, so a review is
  // always signed with the account name.
  const signedName = userName(review.userId) || "KTH student";
  return {
    id: review.id,
    courseCode: review.courseCode,
    name: course ? course.name : review.courseCode,
    credits: course ? course.credits : null,
    startTerm: taken ? taken.attendanceYear : fallbackTerm,
    startTermLabel: String(yearOf(taken ? taken.attendanceYear : fallbackTerm) || ""),
    // A review with no message is counted but never listed.
    isWritten: Boolean(review.message && review.message.trim()),
    workloadScore: review.workloadScore,   // 1–10
    learningScore: review.learningScore,   // 1–10
    theoryPercent: review.approachTheoryPercent,
    examination: review.examinationDistribution,
    happyTook: review.happyTook,
    message: review.message,
    createdAt: review.createdAt,
    createdAtLabel: formatDate(review.createdAt),
    helpfulCount: review.helpfulCount || 0,
    isOwn: review.userId === (o.userId || "u1"),
    author: signedName
  };
}

/* ------------------------- session & scenario stores ------------------------- */

const SESSION_KEY = "cc:session";
const SCENARIO_KEY = "cc:scenario";

/** Shared runtime session. Logging out anywhere means guest everywhere. */
export const sessionStore = {
  read() {
    try {
      const v = window.localStorage.getItem(SESSION_KEY);
      return v === "member" ? "member" : "guest";
    } catch (e) { return "guest"; }
  },
  write(session) {
    try { window.localStorage.setItem(SESSION_KEY, session === "member" ? "member" : "guest"); } catch (e) { /* no storage */ }
    return session;
  }
};

/** Review-harness override. Travels between pages, never touches mock data. */
export const scenarioStore = {
  read() {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("scenario");
      if (q && SCENARIOS.indexOf(q) >= 0) return q;
      const v = window.localStorage.getItem(SCENARIO_KEY);
      return SCENARIOS.indexOf(v) >= 0 ? v : "populated";
    } catch (e) { return "populated"; }
  },
  write(scenario) {
    try {
      if (SCENARIOS.indexOf(scenario) >= 0) window.localStorage.setItem(SCENARIO_KEY, scenario);
    } catch (e) { /* no storage */ }
    return scenario;
  }
};

/** Resolve the two shared axes, props winning over stored values. */
export function resolveHarness(props) {
  const p = props || {};
  const session = p.session === "member" || p.session === "guest" ? p.session : sessionStore.read();
  const scenario = SCENARIOS.indexOf(p.scenario) >= 0 ? p.scenario : scenarioStore.read();
  return {
    session, scenario,
    isMember: session === "member",
    isGuest: session === "guest",
    isPopulated: scenario === "populated",
    isEmpty: scenario === "empty",
    isLoading: scenario === "loading",
    isError: scenario === "error",
    isEdgeCase: scenario === "edge-case"
  };
}
