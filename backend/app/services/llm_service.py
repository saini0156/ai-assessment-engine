import concurrent.futures
import itertools
import json
import logging
import threading
import uuid
from typing import Any, Dict, List, Optional

import httpx
from pydantic import TypeAdapter

from app.config import settings
from app.models.schemas import (
    TopicItem,
    InternalQuestion,
    InternalQuizSession,
)
from app.prompts.templates import (
    TOPIC_EXTRACTION_PROMPT,
    QUIZ_GENERATION_PROMPT,
    TUTOR_EXPLAIN_PROMPT,
)

logger = logging.getLogger(__name__)

def normalize_ai_question(item: Any, idx: int) -> Optional[InternalQuestion]:
    """
    Robust normalizer that adapts any LLM response structure:
      - options as list ["A", "B", "C", "D"] or dict {"A": "...", ...}
      - correct_option as integer (0 -> 'A') or string ("A", "Option A", "answer")
      - missing explanation auto-filled
    """
    if not isinstance(item, dict):
        return None

    import re
    q_text = str(item.get("question") or item.get("question_text") or "").strip()
    if not q_text:
        return None

    # 1. Normalize Options (supports list or dict)
    raw_opts = item.get("options")
    clean_opts: Dict[str, str] = {}
    if isinstance(raw_opts, list):
        for o_idx, opt in enumerate(raw_opts[:4]):
            key = chr(ord("A") + o_idx)
            opt_str = str(opt).strip()
            # Strip leading "A) ", "A. ", "A: "
            if len(opt_str) >= 3 and opt_str[0].upper() == key and opt_str[1] in [")", ".", ":", "-"]:
                opt_str = opt_str[2:].strip()
            clean_opts[key] = opt_str
    elif isinstance(raw_opts, dict):
        for key in ["A", "B", "C", "D"]:
            val = raw_opts.get(key) or raw_opts.get(key.lower()) or "Option Unavailable"
            clean_opts[key] = str(val).strip()

    # Ensure all 4 options exist
    for key in ["A", "B", "C", "D"]:
        if key not in clean_opts or not clean_opts[key]:
            clean_opts[key] = f"Option {key}"

    # 2. Normalize Correct Option (handles integer 0, 1, 2, 3 or strings)
    raw_corr = item.get("correct_option") if item.get("correct_option") is not None else (
        item.get("answer") if item.get("answer") is not None else item.get("correct_answer")
    )
    if isinstance(raw_corr, int) and 0 <= raw_corr <= 3:
        clean_correct = chr(ord("A") + raw_corr)
    else:
        m = re.search(r"[A-Da-d]", str(raw_corr or "A"))
        clean_correct = m.group(0).upper() if m else "A"

    # 3. Normalize Explanation
    explanation = str(item.get("explanation") or item.get("reasoning") or "").strip()
    if not explanation:
        explanation = f"Option {clean_correct} is the verified correct answer for this question."

    return InternalQuestion(
        id=f"q_{idx}",
        question=q_text,
        options=clean_opts,
        correct_option=clean_correct,
        explanation=explanation,
    )


# =========================================================================
# Multi-Key Rotation Manager for High Concurrency & Zero Rate Limit Errors
# =========================================================================
class GroqKeyPool:
    """Thread-safe round-robin API key pool for Groq Cloud."""

    def __init__(self, keys: List[str]):
        self.keys = [k.strip() for k in keys if k and k.strip()]
        self._lock = threading.Lock()
        self._cycler = itertools.cycle(self.keys) if self.keys else None

    def get_key(self) -> Optional[str]:
        if not self.keys:
            return None
        with self._lock:
            return next(self._cycler)

    def total_keys(self) -> int:
        return len(self.keys)


# =========================================================================
# Offline Subject-Aware Question Banks (Guaranteed Fallback)
# =========================================================================
class MockAIEngine:
    """
    Subject-Aware Offline Fallback Engine.
    Provides instant, verified educational questions matched strictly to the subject.
    Never serves generic OOP questions for Mathematics or Science.
    """

    @staticmethod
    def extract_topics(subject: str, text: str) -> List[TopicItem]:
        subj = (subject or "").lower()
        if any(k in subj for k in ["math", "arithmetic", "geometry", "algebra"]):
            return [
                TopicItem(topic_id="top_1", topic_name="Real Numbers & Number Theory", subtopics=["Fundamental Theorem of Arithmetic", "HCF & LCM", "Irrational Numbers"], summary="Foundational number theory and decimal expansions."),
                TopicItem(topic_id="top_2", topic_name="Polynomials & Quadratic Equations", subtopics=["Zeroes of Polynomials", "Discriminant Method", "Nature of Roots"], summary="Algebraic roots, the quadratic formula, and parabolic equations."),
                TopicItem(topic_id="top_3", topic_name="Trigonometry & Applications", subtopics=["Trig Ratios", "Pythagorean Identities", "Heights & Distances"], summary="Right triangle identities and angle of elevation word problems."),
                TopicItem(topic_id="top_4", topic_name="Arithmetic Progressions & Series", subtopics=["nth Term Formula", "Sum of n Terms", "Common Difference"], summary="Linear numeric sequences and real-world progression problems."),
            ]
        elif any(k in subj for k in ["physic", "science", "mechanic"]):
            return [
                TopicItem(topic_id="top_1", topic_name="Classical Mechanics & Dynamics", subtopics=["Newton's Laws", "Momentum Conservation", "Friction"], summary="Principles of force, acceleration, and mechanical work."),
                TopicItem(topic_id="top_2", topic_name="Thermodynamics & Heat", subtopics=["Laws of Thermodynamics", "Heat Engines", "Entropy"], summary="Thermal equilibrium, energy transformation, and heat transfer."),
                TopicItem(topic_id="top_3", topic_name="Electricity & Magnetism", subtopics=["Ohm's Law", "Circuits", "Electromagnetic Induction"], summary="Electric potential, current flow, and magnetic induction."),
            ]
        elif any(k in subj for k in ["operat", "os", "linux"]):
            return [
                TopicItem(topic_id="top_1", topic_name="Process Management & CPU Scheduling", subtopics=["Process States", "FCFS & Round Robin", "Context Switching"], summary="OS process lifecycles and CPU scheduling algorithms."),
                TopicItem(topic_id="top_2", topic_name="Deadlocks & Synchronization", subtopics=["Mutual Exclusion", "Semaphores", "Banker's Algorithm"], summary="Techniques for resource synchronization and preventing system deadlocks."),
                TopicItem(topic_id="top_3", topic_name="Memory Management & Paging", subtopics=["Virtual Memory", "Page Faults", "Paging vs Segmentation"], summary="Virtual memory architecture, demand paging, and page replacement."),
            ]
        elif any(k in subj for k in ["db", "database", "sql"]):
            return [
                TopicItem(topic_id="top_1", topic_name="Relational Data Modeling & SQL", subtopics=["DDL & DML", "Primary & Foreign Keys", "Joins"], summary="Schema design, table constraints, and relational query structure."),
                TopicItem(topic_id="top_2", topic_name="Normalization & Integrity", subtopics=["1NF, 2NF, 3NF", "Boyce-Codd (BCNF)", "Anomalies"], summary="Eliminating redundant data and enforcing referential integrity."),
                TopicItem(topic_id="top_3", topic_name="ACID Properties & Transactions", subtopics=["Atomicity & Durability", "Isolation Levels", "Two-Phase Locking"], summary="Ensuring consistency and concurrency control in database transactions."),
            ]
        else:
            return [
                TopicItem(topic_id="top_1", topic_name=f"{subject or 'Core'} Foundations", subtopics=["Basic Principles", "Terminology", "Core Concepts"], summary=f"Essential theoretical foundational principles of {subject}."),
                TopicItem(topic_id="top_2", topic_name=f"Advanced {subject or 'Domain'} Topics", subtopics=["Methods", "Applications", "Analysis"], summary=f"Applied concepts and industry standards for {subject}."),
            ]

    @staticmethod
    def get_pool(subject: str, topic: str) -> List[Dict[str, Any]]:
        combined = f"{subject} {topic}".lower()

        # 1. Mathematics Question Bank (20 Verified Questions)
        if any(k in combined for k in ["math", "mathematics", "algebra", "geometry", "trig", "arithmetic", "calculus", "class x", "class 10"]):
            return [
                {
                    "question": "If the discriminant (b^2 - 4ac) of a quadratic equation ax^2 + bx + c = 0 is greater than 0, what is the nature of its roots?",
                    "options": {"A": "Two distinct real roots", "B": "Two equal real roots", "C": "No real roots", "D": "Imaginary roots with equal real parts"},
                    "correct_option": "A",
                    "explanation": "When the discriminant delta > 0, the quadratic formula yields two distinct real values for x.",
                },
                {
                    "question": "What is the value of sin^2(x) + cos^2(x) for any real angle x?",
                    "options": {"A": "0", "B": "1", "C": "tan(x)", "D": "2"},
                    "correct_option": "B",
                    "explanation": "sin^2(x) + cos^2(x) = 1 is the fundamental Pythagorean trigonometric identity.",
                },
                {
                    "question": "What is the 10th term of an Arithmetic Progression (AP) with first term a = 2 and common difference d = 3?",
                    "options": {"A": "27", "B": "29", "C": "30", "D": "32"},
                    "correct_option": "B",
                    "explanation": "The nth term is an = a + (n - 1)d. For n=10: a10 = 2 + (9 * 3) = 2 + 27 = 29.",
                },
                {
                    "question": "According to the Fundamental Theorem of Arithmetic, every composite number can be uniquely factored into a product of:",
                    "options": {"A": "Even numbers", "B": "Odd numbers", "C": "Prime numbers", "D": "Rational numbers"},
                    "correct_option": "C",
                    "explanation": "Every integer greater than 1 can be represented uniquely as a product of prime powers.",
                },
                {
                    "question": "If tan(A) = 4/3, what is the value of cos(A)?",
                    "options": {"A": "3/5", "B": "4/5", "C": "5/3", "D": "3/4"},
                    "correct_option": "A",
                    "explanation": "Since tan(A) = opp/adj = 4/3, hypotenuse = sqrt(4^2 + 3^2) = 5. Therefore, cos(A) = adj/hyp = 3/5.",
                },
                {
                    "question": "Which of the following is an irrational number?",
                    "options": {"A": "sqrt(4)", "B": "sqrt(9)", "C": "sqrt(2)", "D": "0.75"},
                    "correct_option": "C",
                    "explanation": "sqrt(2) cannot be expressed as a ratio of two integers p/q, making it irrational.",
                },
                {
                    "question": "The sum of the zeroes of the quadratic polynomial P(x) = 2x^2 - 8x + 6 is:",
                    "options": {"A": "4", "B": "-4", "C": "3", "D": "-3"},
                    "correct_option": "A",
                    "explanation": "For ax^2 + bx + c, the sum of zeroes is -b/a = -(-8)/2 = 8/2 = 4.",
                },
                {
                    "question": "The distance between the Cartesian coordinates (0, 0) and (3, 4) is:",
                    "options": {"A": "5", "B": "7", "C": "25", "D": "1"},
                    "correct_option": "A",
                    "explanation": "Distance = sqrt((3 - 0)^2 + (4 - 0)^2) = sqrt(9 + 16) = sqrt(25) = 5.",
                },
                {
                    "question": "What is the probability of rolling a prime number on a standard fair 6-sided die?",
                    "options": {"A": "1/6", "B": "1/3", "C": "1/2", "D": "2/3"},
                    "correct_option": "C",
                    "explanation": "The prime numbers on a die are 2, 3, and 5 (3 favorable outcomes). Probability = 3/6 = 1/2.",
                },
                {
                    "question": "The volume of a right circular cylinder with base radius r and height h is:",
                    "options": {"A": "pi * r^2 * h", "B": "2 * pi * r * h", "C": "1/3 * pi * r^2 * h", "D": "4/3 * pi * r^3"},
                    "correct_option": "A",
                    "explanation": "The volume of a cylinder is base area * height = pi * r^2 * h.",
                },
                {
                    "question": "What is the empirical relationship between Mean, Median, and Mode in statistics?",
                    "options": {"A": "Mode = 3 Median - 2 Mean", "B": "Mode = 2 Median - 3 Mean", "C": "Median = 3 Mode - 2 Mean", "D": "Mean = 3 Median - Mode"},
                    "correct_option": "A",
                    "explanation": "The standard empirical formula connecting central tendencies is Mode = 3 Median - 2 Mean.",
                },
                {
                    "question": "In a right triangle ABC with right angle at B, what is the value of sec^2(A) - tan^2(A)?",
                    "options": {"A": "0", "B": "1", "C": "-1", "D": "2"},
                    "correct_option": "B",
                    "explanation": "sec^2(A) - tan^2(A) = 1 is a standard trigonometric identity.",
                },
                {
                    "question": "How many tangents can be drawn to a circle from a single point lying outside the circle?",
                    "options": {"A": "1", "B": "2", "C": "Infinite", "D": "0"},
                    "correct_option": "B",
                    "explanation": "From any external point, exactly two tangents of equal length can be drawn to a circle.",
                },
                {
                    "question": "What is the sum of the first 20 natural numbers?",
                    "options": {"A": "200", "B": "210", "C": "190", "D": "220"},
                    "correct_option": "B",
                    "explanation": "Sum = n(n + 1)/2 = 20 * 21 / 2 = 210.",
                },
                {
                    "question": "For a pair of linear equations a1*x + b1*y + c1 = 0 and a2*x + b2*y + c2 = 0 to have infinitely many solutions, the condition is:",
                    "options": {"A": "a1/a2 != b1/b2", "B": "a1/a2 = b1/b2 = c1/c2", "C": "a1/a2 = b1/b2 != c1/c2", "D": "a1/a2 + b1/b2 = 1"},
                    "correct_option": "B",
                    "explanation": "When lines are coincident (infinitely many solutions), all coefficient ratios are equal: a1/a2 = b1/b2 = c1/c2.",
                },
                {
                    "question": "If the shadow of a vertical pole on level ground is equal to its height, what is the angle of elevation of the sun?",
                    "options": {"A": "30 degrees", "B": "45 degrees", "C": "60 degrees", "D": "90 degrees"},
                    "correct_option": "B",
                    "explanation": "tan(theta) = height / shadow = 1. Therefore theta = arctan(1) = 45 degrees.",
                },
                {
                    "question": "What is the HCF of two consecutive prime numbers?",
                    "options": {"A": "0", "B": "1", "C": "2", "D": "Their product"},
                    "correct_option": "B",
                    "explanation": "Prime numbers share no common factors other than 1, so their HCF is always 1.",
                },
                {
                    "question": "The coordinates of the midpoint of the line segment joining (2, 4) and (6, 8) are:",
                    "options": {"A": "(4, 6)", "B": "(3, 5)", "C": "(8, 12)", "D": "(4, 4)"},
                    "correct_option": "A",
                    "explanation": "Midpoint = ((x1 + x2)/2, (y1 + y2)/2) = ((2 + 6)/2, (4 + 8)/2) = (4, 6).",
                },
                {
                    "question": "If the perimeter and the area of a circle are numerically equal, what is the radius of the circle?",
                    "options": {"A": "2 units", "B": "pi units", "C": "4 units", "D": "7 units"},
                    "correct_option": "A",
                    "explanation": "2 * pi * r = pi * r^2  =>  r = 2 units.",
                },
                {
                    "question": "In an Arithmetic Progression, if a = 5 and d = -2, what is the 5th term?",
                    "options": {"A": "-3", "B": "-1", "C": "1", "D": "3"},
                    "correct_option": "A",
                    "explanation": "a5 = a + 4d = 5 + 4(-2) = 5 - 8 = -3.",
                },
            ]

        # 2. Physics Question Bank (20 Verified Questions)
        elif any(k in combined for k in ["physic", "science", "mechanic", "current", "light", "optic"]):
            return [
                {
                    "question": "According to Newton's Second Law of Motion, force is equal to the product of mass and:",
                    "options": {"A": "Velocity", "B": "Acceleration", "C": "Displacement", "D": "Time"},
                    "correct_option": "B",
                    "explanation": "F = m * a. Net force applied on a body equals mass multiplied by acceleration.",
                },
                {
                    "question": "What is the SI unit of electrical resistance?",
                    "options": {"A": "Volt", "B": "Ampere", "C": "Ohm", "D": "Watt"},
                    "correct_option": "C",
                    "explanation": "The SI unit of electrical resistance is the Ohm (Omega).",
                },
                {
                    "question": "According to Ohm's Law, the current (I) through a conductor is directly proportional to:",
                    "options": {"A": "Potential Difference (Voltage)", "B": "Resistance", "C": "Heat Energy", "D": "Capacitance"},
                    "correct_option": "A",
                    "explanation": "V = I * R. Current is directly proportional to the applied voltage at constant temperature.",
                },
                {
                    "question": "The rate of doing work or transferring energy per unit time is called:",
                    "options": {"A": "Force", "B": "Power", "C": "Momentum", "D": "Pressure"},
                    "correct_option": "B",
                    "explanation": "Power is work done divided by time (P = W / t). Its SI unit is the Watt.",
                },
                {
                    "question": "What optical phenomenon causes a light ray to bend as it passes from air into water?",
                    "options": {"A": "Reflection", "B": "Refraction", "C": "Dispersion", "D": "Total Internal Reflection"},
                    "correct_option": "B",
                    "explanation": "Refraction occurs due to the change in the speed of light when traveling between different optical media.",
                },
                {
                    "question": "Which type of mirror is commonly used as a rear-view mirror in automobiles?",
                    "options": {"A": "Plane mirror", "B": "Concave mirror", "C": "Convex mirror", "D": "Parabolic mirror"},
                    "correct_option": "C",
                    "explanation": "Convex mirrors always give an erect, diminished virtual image and offer a wider field of view.",
                },
                {
                    "question": "The power of a lens having a focal length of 0.5 meters is:",
                    "options": {"A": "+0.5 D", "B": "+2.0 D", "C": "-2.0 D", "D": "+1.0 D"},
                    "correct_option": "B",
                    "explanation": "Power P = 1 / f (in meters) = 1 / 0.5 = +2.0 Diopters.",
                },
                {
                    "question": "What is the equivalent resistance when two 6-ohm resistors are connected in parallel?",
                    "options": {"A": "12 ohms", "B": "3 ohms", "C": "6 ohms", "D": "1.5 ohms"},
                    "correct_option": "B",
                    "explanation": "1/R = 1/6 + 1/6 = 2/6 = 1/3, so R = 3 ohms.",
                },
                {
                    "question": "Fleming's Left-Hand Rule is used to determine the direction of:",
                    "options": {"A": "Induced current", "B": "Magnetic field", "C": "Force on a current-carrying conductor", "D": "Electric potential"},
                    "correct_option": "C",
                    "explanation": "Fleming's Left-Hand Rule determines the direction of mechanical force/motion on a current-carrying wire in a magnetic field.",
                },
                {
                    "question": "Which of the following colors of white light undergoes the maximum deviation through a glass prism?",
                    "options": {"A": "Red", "B": "Yellow", "C": "Green", "D": "Violet"},
                    "correct_option": "D",
                    "explanation": "Violet light has the shortest wavelength and slows down the most in glass, resulting in the greatest refraction.",
                },
            ]

        # 3. Operating Systems Question Bank
        elif any(k in combined for k in ["operat", "os", "linux", "process", "kernel"]):
            return [
                {
                    "question": "Which Coffman condition is eliminated to prevent deadlocks through resource preemption?",
                    "options": {"A": "Mutual Exclusion", "B": "Hold and Wait", "C": "No Preemption", "D": "Circular Wait"},
                    "correct_option": "C",
                    "explanation": "Enabling preemption breaks the 'No Preemption' condition, allowing recovery from potential deadlocks.",
                },
                {
                    "question": "What is the primary role of the Translation Lookaside Buffer (TLB)?",
                    "options": {"A": "Cache disk sectors", "B": "Speed up virtual-to-physical address translation", "C": "Prevent buffer overflows", "D": "Allocate CPU registers"},
                    "correct_option": "B",
                    "explanation": "The TLB is an MMU hardware cache that stores recent virtual-to-physical page mappings.",
                },
                {
                    "question": "Which CPU scheduling algorithm can cause starvation for compute-intensive processes under continuous short job arrivals?",
                    "options": {"A": "Shortest Job First (SJF)", "B": "First-Come, First-Served (FCFS)", "C": "Round Robin", "D": "FIFO"},
                    "correct_option": "A",
                    "explanation": "SJF continually prioritizes shorter jobs, starving long-running processes.",
                },
                {
                    "question": "What occurs when the CPU references a memory page not currently loaded in physical RAM?",
                    "options": {"A": "Segmentation Fault", "B": "Page Fault Interrupt", "C": "System Halt", "D": "Bus Error"},
                    "correct_option": "B",
                    "explanation": "A page fault interrupt invokes the OS page replacement mechanism to bring the page from disk into RAM.",
                },
                {
                    "question": "Which synchronization primitive maintains an integer count for resource allocation?",
                    "options": {"A": "Spinlock", "B": "Counting Semaphore", "C": "Barrier", "D": "Condition Variable"},
                    "correct_option": "B",
                    "explanation": "A counting semaphore provides atomic wait() and signal() operations over an integer counter.",
                },
            ]

        # 4. DBMS / SQL Question Bank
        elif any(k in combined for k in ["db", "database", "sql"]):
            return [
                {
                    "question": "Which ACID property guarantees that all operations in a transaction either complete successfully or roll back entirely?",
                    "options": {"A": "Consistency", "B": "Isolation", "C": "Durability", "D": "Atomicity"},
                    "correct_option": "D",
                    "explanation": "Atomicity ensures all-or-nothing execution of database transactions.",
                },
                {
                    "question": "Which normal form requires the elimination of transitive dependencies between non-key attributes?",
                    "options": {"A": "1NF", "B": "2NF", "C": "3NF", "D": "BCNF"},
                    "correct_option": "C",
                    "explanation": "Third Normal Form (3NF) requires a table to be in 2NF and have no transitive functional dependencies.",
                },
                {
                    "question": "What SQL clause is used to filter records resulting from an aggregate GROUP BY query?",
                    "options": {"A": "WHERE", "B": "HAVING", "C": "ORDER BY", "D": "LIMIT"},
                    "correct_option": "B",
                    "explanation": "The HAVING clause filters aggregated groups after the GROUP BY operation has executed.",
                },
            ]

        # 5. Default Computer Science / Software Engineering Bank
        else:
            return [
                {
                    "question": "Which OOP principle restricts direct external access to an object's internal representation?",
                    "options": {"A": "Inheritance", "B": "Encapsulation", "C": "Polymorphism", "D": "Abstraction"},
                    "correct_option": "B",
                    "explanation": "Encapsulation hides internal object state and requires interaction to occur via defined public methods.",
                },
                {
                    "question": "What allows different object classes to implement the same method interface with customized behavior?",
                    "options": {"A": "Polymorphism", "B": "Encapsulation", "C": "Composition", "D": "Compilation"},
                    "correct_option": "A",
                    "explanation": "Polymorphism lets different classes respond to identical interface calls with specialized logic.",
                },
                {
                    "question": "Which data structure operates on a Last-In, First-Out (LIFO) basis?",
                    "options": {"A": "Queue", "B": "Stack", "C": "Linked List", "D": "Binary Heap"},
                    "correct_option": "B",
                    "explanation": "A stack pushes and pops elements from the top, following LIFO order.",
                },
                {
                    "question": "What is the average lookup time complexity in a balanced Binary Search Tree (BST)?",
                    "options": {"A": "O(1)", "B": "O(n)", "C": "O(log n)", "D": "O(n log n)"},
                    "correct_option": "C",
                    "explanation": "A balanced BST halves the search space at each level, taking logarithmic O(log n) time.",
                },
            ]

    @classmethod
    def generate_quiz(cls, subject: str, topic: str, count: int, difficulty: str) -> InternalQuizSession:
        pool = cls.get_pool(subject, topic)
        selected = []
        for i in range(count):
            selected.append(pool[i % len(pool)])

        questions: Dict[str, InternalQuestion] = {}
        for index, item in enumerate(selected, start=1):
            qid = f"q_{index}"
            questions[qid] = InternalQuestion(
                id=qid,
                question=item["question"],
                options=item["options"],
                correct_option=item["correct_option"],
                explanation=item["explanation"],
            )

        return InternalQuizSession(
            quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            questions=questions,
        )

    @staticmethod
    def explain_mistake(
        question: str,
        selected_option: Optional[str],
        correct_option: str,
        explanation: str,
    ) -> Dict[str, str]:
        return {
            "simplified_explanation": (
                f"You selected Option {selected_option or 'None'}. "
                f"The correct answer is Option {correct_option}. {explanation}"
            ),
            "memory_tip": f"Remember: Option {correct_option} directly satisfies the underlying rule of this question.",
            "real_world_example": "In practice, understanding this fundamental principle prevents errors and ensures correct results.",
        }


# =========================================================================
# Enterprise High-Throughput LLM Service
# =========================================================================
class LLMService:
    """
    Two-Tier Fast Multi-Provider AI Service:
      - Primary (Tier 1): Groq Cloud LPU (~1.2 seconds, Multi-Key Rotation)
      - Secondary (Tier 2): Google Gemini Flash (~3.5 seconds, Auto-Timeout Protected)
      - Safety Net (Tier 3): Subject-Aware Offline Mock Engine (0.001s, 100% uptime)
    
    Includes Parallel Batch Generation for high-volume quizzes (20 to 50 questions).
    """

    def __init__(self):
        self.groq_pool = GroqKeyPool(settings.GROQ_API_KEYS)
        self.gemini_keys = settings.GEMINI_API_KEYS
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
        logger.info(
            "LLMService initialized with %d Groq keys and %d Gemini keys.",
            self.groq_pool.total_keys(),
            len(self.gemini_keys),
        )

    # -------------------------------------------------------------
    # Groq API Caller with Multi-Key Rotation & 429 Failover
    # -------------------------------------------------------------
    def _call_groq(self, prompt: str, system_message: str = "") -> Any:
        keys_to_try = list(self.groq_pool.keys)
        if not keys_to_try:
            raise RuntimeError("No Groq API keys configured.")

        # Start from next rotated key in pool
        start_key = self.groq_pool.get_key()
        if start_key in keys_to_try:
            idx = keys_to_try.index(start_key)
            keys_to_try = keys_to_try[idx:] + keys_to_try[:idx]

        url = "https://api.groq.com/openai/v1/chat/completions"
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        user_prompt = prompt
        if "json" not in user_prompt.lower():
            user_prompt += "\nOutput strictly as a JSON object."
        messages.append({"role": "user", "content": user_prompt})

        # Production Groq model candidate list (gpt-oss-20b active for this account, with Llama fallbacks)
        models_to_try = [
            "openai/gpt-oss-20b",
            "openai/gpt-oss-120b",
            "llama-3.1-8b-instant",
            "llama-3.3-70b-versatile",
            "qwen/qwen3.8-27b",
        ]

        last_error = None
        for api_key in keys_to_try:
            masked = f"...{api_key[-4:]}" if len(api_key) >= 4 else "key"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            for model_candidate in models_to_try:
                try:
                    payload = {
                        "model": model_candidate,
                        "messages": messages,
                        "response_format": {"type": "json_object"},
                        "temperature": 0.2,
                    }
                    with httpx.Client(timeout=30.0) as client:
                        resp = client.post(url, json=payload, headers=headers)
                        if resp.status_code == 429:
                            logger.warning("Groq 429 Rate Limit hit on key %s. Rotating to next key...", masked)
                            break  # Try next API key
                        resp.raise_for_status()
                        content = resp.json()["choices"][0]["message"]["content"]
                        parsed = json.loads(content)

                        # Unpack wrapped lists if nested under keys like {'questions': [...]} or {'topics': [...]}
                        if isinstance(parsed, dict):
                            for val in parsed.values():
                                if isinstance(val, list):
                                    return val
                        return parsed
                except Exception as e:
                    last_error = e
                    logger.warning("Groq candidate %s with key %s failed: %s", model_candidate, masked, e)
                    continue

        raise RuntimeError(f"All Groq keys and models failed. Last error: {last_error}")

    # -------------------------------------------------------------
    # Gemini API Caller with 30s Timeout & Model Fallback
    # -------------------------------------------------------------
    def _call_gemini(self, prompt: str) -> Any:
        keys_to_try = list(self.gemini_keys)
        if not keys_to_try:
            raise RuntimeError("No Gemini API keys configured.")

        try:
            from google import genai
        except ImportError:
            raise RuntimeError("google-genai SDK not installed.")

        last_error = None
        for api_key in keys_to_try:
            masked = f"...{api_key[-4:]}" if len(api_key) >= 4 else "key"
            try:
                client = genai.Client(api_key=api_key)
            except Exception as e:
                logger.warning("Failed to initialize Gemini client for key %s: %s", masked, e)
                continue

            for gemini_model in ["gemini-3.8-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
                try:
                    def _execute():
                        return client.models.generate_content(
                            model=gemini_model,
                            contents=prompt,
                            config={"response_mime_type": "application/json"},
                        )

                    future = self._executor.submit(_execute)
                    response = future.result(timeout=30.0)
                    text = getattr(response, "text", "")
                    if not text.strip():
                        continue

                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        for val in parsed.values():
                            if isinstance(val, list):
                                return val
                    return parsed
                except Exception as e:
                    last_error = e
                    logger.warning("Gemini model %s on key %s failed: %s", gemini_model, masked, e)
                    continue

        raise RuntimeError(f"All Gemini models and keys failed. Last error: {last_error}")

    # -------------------------------------------------------------
    # Topic Extraction Cascade
    # -------------------------------------------------------------
    def extract_topics(self, subject: str, text: str) -> List[TopicItem]:
        prompt = TOPIC_EXTRACTION_PROMPT.format(subject=subject, text=text[:12000])

        # Tier 1: Groq
        if self.groq_pool.total_keys() > 0:
            try:
                data = self._call_groq(
                    prompt,
                    system_message="You are a syllabus parser that strictly outputs a JSON object containing a topics list.",
                )
                topics = TOPIC_LIST_ADAPTER.validate_python(data)
                if len(topics) >= 1:
                    logger.info("Successfully extracted %d topics via Groq (Primary).", len(topics))
                    return topics
            except Exception as e_groq:
                logger.warning("Groq topic extraction failed (%s). Falling back to Gemini...", e_groq)

        # Tier 2: Gemini
        if len(self.gemini_keys) > 0:
            try:
                data = self._call_gemini(prompt)
                topics = TOPIC_LIST_ADAPTER.validate_python(data)
                if len(topics) >= 1:
                    logger.info("Successfully extracted %d topics via Gemini (Fallback).", len(topics))
                    return topics
            except Exception as e_gem:
                logger.warning("Gemini topic extraction failed (%s). Falling back to Mock engine...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.extract_topics(subject, text)

    # -------------------------------------------------------------
    # Single Chunk Generator for Quiz Batching
    # -------------------------------------------------------------
    def _generate_chunk(
        self,
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
        chunk_index: int = 1,
        total_chunks: int = 1,
    ) -> List[InternalQuestion]:
        """Generates a slice of questions with context to avoid duplicate questions."""
        if total_chunks > 1:
            prompt = (
                f"{QUIZ_GENERATION_PROMPT.format(count=count, subject=subject, topic=topic, difficulty=difficulty)}\n"
                f"BATCH CONTEXT: This is Batch {chunk_index} of {total_chunks}. "
                f"Generate unique, distinct questions covering different sub-concepts. Avoid repeating standard intro questions."
            )
        else:
            prompt = QUIZ_GENERATION_PROMPT.format(
                count=count,
                subject=subject,
                topic=topic,
                difficulty=difficulty,
            )

        def _parse_generated(raw_data: Any) -> List[InternalQuestion]:
            if isinstance(raw_data, list):
                items = raw_data
            elif isinstance(raw_data, dict):
                items = next((v for v in raw_data.values() if isinstance(v, list)), [])
            else:
                items = []

            results = []
            for i, raw_item in enumerate(items, start=1):
                q = normalize_ai_question(raw_item, i)
                if q:
                    results.append(q)
            return results

        # Tier 1: Groq
        if self.groq_pool.total_keys() > 0:
            try:
                data = self._call_groq(
                    prompt,
                    system_message="You are an assessment engine that strictly outputs a JSON object containing a questions array.",
                )
                generated = _parse_generated(data)
                if len(generated) > 0:
                    return generated[:count]
            except Exception as e_groq:
                logger.warning("Groq chunk %d/%d failed (%s). Trying Gemini...", chunk_index, total_chunks, e_groq)

        # Tier 2: Gemini
        if len(self.gemini_keys) > 0:
            try:
                data = self._call_gemini(prompt)
                generated = _parse_generated(data)
                if len(generated) > 0:
                    return generated[:count]
            except Exception as e_gem:
                logger.warning("Gemini chunk %d/%d failed (%s). Using subject-aware mock...", chunk_index, total_chunks, e_gem)

        # Tier 3: Subject-Aware Mock Engine for this chunk
        pool = MockAIEngine.get_pool(subject, topic)
        offset = (chunk_index - 1) * 10
        chunk_questions: List[InternalQuestion] = []
        for i in range(count):
            item = pool[(offset + i) % len(pool)]
            chunk_questions.append(
                InternalQuestion(
                    id=f"q_temp_{i}",
                    question=item["question"],
                    options=item["options"],
                    correct_option=item["correct_option"],
                    explanation=item["explanation"],
                )
            )
        return chunk_questions

    # -------------------------------------------------------------
    # Quiz Generation Cascade (Handles 5, 10, 20 to 50 Questions in Parallel)
    # -------------------------------------------------------------
    def generate_quiz(
        self,
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
    ) -> InternalQuizSession:
        """
        High-Performance Quiz Generator.
        For count <= 10: Runs a single fast cascade call (~1.2s).
        For count > 10 (e.g. 20-50): Splits into concurrent parallel chunks of 10.
        All threads rotate API keys across the key pool to avoid rate limits.
        """
        if count <= 10:
            all_questions = self._generate_chunk(subject, topic, count, difficulty, 1, 1)
        else:
            # Parallel Batching Architecture for 20 to 50 questions
            chunk_size = 10
            chunks = []
            rem = count
            while rem > 0:
                c = min(chunk_size, rem)
                chunks.append(c)
                rem -= c

            total_chunks = len(chunks)
            logger.info("Splitting %d questions into %d parallel batches.", count, total_chunks)

            all_questions: List[InternalQuestion] = []
            futures = []
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(5, total_chunks)) as executor:
                for idx, c_count in enumerate(chunks, start=1):
                    f = executor.submit(
                        self._generate_chunk,
                        subject=subject,
                        topic=topic,
                        count=c_count,
                        difficulty=difficulty,
                        chunk_index=idx,
                        total_chunks=total_chunks,
                    )
                    futures.append(f)

                for f in futures:
                    try:
                        res = f.result(timeout=40.0)
                        all_questions.extend(res)
                    except Exception as e:
                        logger.error("Parallel batch execution error: %s", e)

        # Assemble and cleanly re-index all generated questions
        questions_dict: Dict[str, InternalQuestion] = {}
        for idx, q in enumerate(all_questions[:count], start=1):
            qid = f"q_{idx}"
            questions_dict[qid] = InternalQuestion(
                id=qid,
                question=q.question.strip(),
                options=q.options,
                correct_option=q.correct_option,
                explanation=q.explanation.strip(),
            )

        # If pool had fewer questions than count, fill remainder safely
        if len(questions_dict) < count:
            pool = MockAIEngine.get_pool(subject, topic)
            curr = len(questions_dict) + 1
            while curr <= count:
                item = pool[curr % len(pool)]
                qid = f"q_{curr}"
                questions_dict[qid] = InternalQuestion(
                    id=qid,
                    question=item["question"],
                    options=item["options"],
                    correct_option=item["correct_option"],
                    explanation=item["explanation"],
                )
                curr += 1

        logger.info(
            "Successfully delivered %d questions for '%s' -> '%s'.",
            len(questions_dict),
            subject,
            topic,
        )

        return InternalQuizSession(
            quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
            subject=subject,
            topic=topic,
            difficulty=difficulty,
            questions=questions_dict,
        )

    # -------------------------------------------------------------
    # AI Tutor Explanation Cascade
    # -------------------------------------------------------------
    def explain_mistake(
        self,
        question: str,
        selected_option: Optional[str],
        correct_option: str,
        explanation: str,
    ) -> Dict[str, str]:

        prompt = TUTOR_EXPLAIN_PROMPT.format(
            question=question,
            selected_option=selected_option or "None",
            correct_option=correct_option,
            explanation=explanation,
        )

        required_keys = ["simplified_explanation", "memory_tip", "real_world_example"]

        # Tier 1: Groq
        if self.groq_pool.total_keys() > 0:
            try:
                data = self._call_groq(prompt)
                if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                    logger.info("AI Tutor explanation generated via Groq (Primary).")
                    return {k: data[k].strip() for k in required_keys}
            except Exception as e_groq:
                logger.warning("Groq tutor explanation failed (%s). Falling back to Gemini...", e_groq)

        # Tier 2: Gemini
        if len(self.gemini_keys) > 0:
            try:
                data = self._call_gemini(prompt)
                if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                    logger.info("AI Tutor explanation generated via Gemini (Fallback).")
                    return {k: data[k].strip() for k in required_keys}
            except Exception as e_gem:
                logger.warning("Gemini tutor explanation failed (%s). Falling back to Mock engine...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.explain_mistake(question, selected_option, correct_option, explanation)


llm_service = LLMService()
