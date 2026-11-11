"""
Prompt templates for AI Assessment Engine.
Used for Topic Extraction, Tiered Distractor-Engineered Question Generation, and Pedagogical AI Tutoring.
"""

TOPIC_EXTRACTION_PROMPT = """
You are an expert curriculum analyzer.
Analyze the following syllabus text for the subject: '{subject}'.

{language_directive}

Extract 3 to 6 major topics. For each topic, provide:
- topic_id (e.g. 'top_1', 'top_2')
- topic_name (clear subject topic title)
- subtopics (list of 2-5 subtopic strings)
- summary (1 clear sentence summarizing the topic)

Return ONLY a valid JSON array matching this exact schema:
[
  {{
    "topic_id": "top_1",
    "topic_name": "...",
    "subtopics": ["...", "..."],
    "summary": "..."
  }}
]

Syllabus Text:
{text}
"""

DIFFICULTY_DIRECTIVES = {
    "Easy": """
COGNITIVE TIER: EASY (Foundational Recall & Core Vocabulary)
- Questions must test direct definitions, standard formulas, foundational terminology, and standard units.
- Focus on 1-step direct recall or simple recognition.
- DISTRACTOR RULES: Use common surface-level vocabulary mix-ups. Do not use tricky multi-step calculations, obscure exceptions, or confusing double-negative phrasing.
""",
    "Medium": """
COGNITIVE TIER: MEDIUM (Application & Procedural Competence)
- Questions must test 1-to-2 step formula execution, conceptual differentiation between closely related concepts, and applied scenarios.
- DISTRACTOR RULES: Distractors MUST reflect typical student procedural errors (e.g., sign inversion errors like +b instead of -b, unit conversion omissions, or confusing similar concepts like Encapsulation vs Abstraction).
- Explanations must clearly contrast why the right option succeeds where the procedural trap failed.
""",
    "Hard": """
COGNITIVE TIER: HARD (Critical Analysis, Synthesis & Edge-Case Traps)
- Questions must feature multi-step analytical reasoning, boundary conditions, hidden constraints, and complex applied word problems.
- DISTRACTOR RULES: Distractors MUST be 'Near-Miss Traps' — the exact numerical or logical result a student reaches if they solve 90% of the problem correctly but miss a critical final-step constraint (e.g., dividing by negative reversing inequalities, boundary condition checks, or discriminant equality).
- Provide a rigorous, diagnostic explanation exposing the exact reasoning trap that makes the distractors tempting.
""",
}

QUIZ_GENERATION_PROMPT = """
You are a master assessment creator and psychometrics expert.
Generate {count} multiple choice questions (MCQs) for:
Subject: {subject}
Topic: {topic}
Difficulty: {difficulty}

{language_directive}

{difficulty_directive}

DISTRACTOR ENGINEERING RULES:
1. Every question must have exactly 4 options labeled 'A', 'B', 'C', 'D'.
2. Exactly 1 option must be correct.
3. The 3 wrong options (distractors) MUST reflect genuine student misconceptions and plausible errors tailored specifically to the {difficulty} tier.
4. ABSOLUTELY FORBIDDEN: NEVER use 'All of the above', 'None of the above', or 'Both A and B'.
5. Provide a clear, educational explanation for why the correct option is right and why the distractors are incorrect.

Return ONLY a valid JSON array of objects with keys:
- id: "q_1", "q_2", etc.
- question: string
- options: {{"A": "...", "B": "...", "C": "...", "D": "..."}}
- correct_option: "A" or "B" or "C" or "D"
- explanation: string
"""

TUTOR_EXPLAIN_PROMPT = """
You are a friendly, encouraging AI Tutor. A student got this question wrong:
Question: {question}
Student's selected answer: {selected_option}
Correct answer: {correct_option}
Official explanation: {explanation}

{language_directive}

Provide helpful tutoring feedback structured into three parts:
1. simplified_explanation: Explain why their answer is wrong and the correct one is right without textbook jargon.
2. memory_tip: A short, memorable rhyme, catchphrase, or mnemonic rule of thumb to remember this concept forever.
3. real_world_example: An everyday real-world analogy that makes the concept instantly click.

Return ONLY a valid JSON object:
{{
  "simplified_explanation": "...",
  "memory_tip": "...",
  "real_world_example": "..."
}}
"""
