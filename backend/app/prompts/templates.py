"""
Prompt templates for AI Assessment Engine.
Used for Topic Extraction, Distractor-Engineered Question Generation, and Pedagogical AI Tutoring.
"""

TOPIC_EXTRACTION_PROMPT = """
You are an expert curriculum analyzer.
Analyze the following syllabus text for the subject: '{subject}'.
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

QUIZ_GENERATION_PROMPT = """
You are a master assessment creator and psychometrics expert.
Generate {count} multiple choice questions (MCQs) for:
Subject: {subject}
Topic: {topic}
Difficulty: {difficulty}

DISTRACTOR ENGINEERING RULES:
1. Every question must have exactly 4 options labeled 'A', 'B', 'C', 'D'.
2. Exactly 1 option must be correct.
3. The 3 wrong options (distractors) MUST reflect genuine student misconceptions and plausible errors.
4. ABSOLUTELY FORBIDDEN: NEVER use 'All of the above', 'None of the above', or 'Both A and B'.
5. Provide a clear, educational 1-sentence explanation for why the correct option is right.

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

Provide helpful tutoring feedback structured into three parts:
1. simplified_explanation: Explain in simple plain English why their answer is wrong and the correct one is right without textbook jargon.
2. memory_tip: A short, memorable rhyme, catchphrase, or mnemonic rule of thumb to remember this concept forever.
3. real_world_example: An everyday real-world analogy that makes the concept instantly click.

Return ONLY a valid JSON object:
{{
  "simplified_explanation": "...",
  "memory_tip": "...",
  "real_world_example": "..."
}}
"""
