import concurrent.futures
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

import httpx
from pydantic import TypeAdapter, ValidationError

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

TOPIC_LIST_ADAPTER = TypeAdapter(List[TopicItem])
QUESTION_LIST_ADAPTER = TypeAdapter(List[InternalQuestion])


class MockAIEngine:
    """
    Ultra-reliable offline fallback engine.
    Always provides instant responses even with zero internet or exhausted quotas.
    """

    @staticmethod
    def extract_topics(subject: str, text: str) -> List[TopicItem]:
        subj_lower = (subject or "").lower()
        if "operat" in subj_lower or "os" in subj_lower:
            return [
                TopicItem(topic_id="top_1", topic_name="Process Management & CPU Scheduling", subtopics=["Process States", "FCFS & Round Robin", "Context Switching"], summary="Fundamentals of operating system process lifecycles and CPU scheduling algorithms."),
                TopicItem(topic_id="top_2", topic_name="Deadlocks & Synchronization", subtopics=["Mutual Exclusion", "Semaphores", "Banker's Algorithm"], summary="Techniques for resource synchronization and preventing system deadlocks."),
                TopicItem(topic_id="top_3", topic_name="Memory Management & Paging", subtopics=["Virtual Memory", "Page Faults", "Paging vs Segmentation"], summary="Virtual memory architecture, demand paging, and page replacement policies."),
                TopicItem(topic_id="top_4", topic_name="File Systems & I/O", subtopics=["Inodes", "File Allocation Tables", "Disk Scheduling (SSTF/SCAN)"], summary="Structure of file systems and secondary storage scheduling."),
            ]
        elif "network" in subj_lower or "cn" in subj_lower:
            return [
                TopicItem(topic_id="top_1", topic_name="OSI & TCP/IP Protocol Layers", subtopics=["Physical Layer", "Network Layer", "Transport Layer"], summary="Hierarchical models of modern computer networking and packet transmission."),
                TopicItem(topic_id="top_2", topic_name="Transport Layer Protocols (TCP & UDP)", subtopics=["3-Way Handshake", "Flow & Congestion Control", "UDP Connectionless Model"], summary="Reliable stream transmission vs low-latency datagram delivery."),
                TopicItem(topic_id="top_3", topic_name="IP Addressing & Routing Algorithms", subtopics=["IPv4 Subnetting", "CIDR", "Dijkstra Link-State Routing"], summary="Logical addressing, routing tables, and shortest path algorithms."),
                TopicItem(topic_id="top_4", topic_name="Application Layer Protocols", subtopics=["DNS Resolution", "HTTP/HTTPS", "SMTP & FTP"], summary="End-user network protocols and domain name resolution systems."),
            ]
        elif "data" in subj_lower or "db" in subj_lower or "sql" in subj_lower:
            return [
                TopicItem(topic_id="top_1", topic_name="Relational Data Modeling & SQL", subtopics=["DDL & DML", "Primary & Foreign Keys", "Joins"], summary="Schema design, table constraints, and relational query structure."),
                TopicItem(topic_id="top_2", topic_name="Normalization & Integrity", subtopics=["1NF, 2NF, 3NF", "Boyce-Codd (BCNF)", "Anomalies"], summary="Eliminating redundant data and enforcing referential integrity."),
                TopicItem(topic_id="top_3", topic_name="ACID Properties & Transactions", subtopics=["Atomicity & Durability", "Isolation Levels", "Two-Phase Locking"], summary="Ensuring consistency and concurrency control in database transactions."),
                TopicItem(topic_id="top_4", topic_name="Indexing & Query Optimization", subtopics=["B-Trees & B+ Trees", "Hash Indexes", "Execution Plans"], summary="Storage structures and indexing methods for low-latency queries."),
            ]
        else:
            return [
                TopicItem(topic_id="top_1", topic_name=f"{subject or 'Core Concepts'} Fundamentals", subtopics=["Core Principles", "Foundations", "Architecture"], summary=f"Essential theoretical foundational principles of {subject or 'the curriculum'}."),
                TopicItem(topic_id="top_2", topic_name=f"Advanced {subject or 'Application'} Methods", subtopics=["Design Patterns", "Standard Practices", "Optimization"], summary=f"Detailed implementation methodologies and industry best practices for {subject or 'the field'}."),
                TopicItem(topic_id="top_3", topic_name=f"{subject or 'System'} Analysis & Verification", subtopics=["Performance Evaluation", "Diagnostics", "Quality Standards"], summary=f"Analysis frameworks, verification techniques, and quality metrics."),
            ]

    @staticmethod
    def generate_quiz(
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
    ) -> InternalQuizSession:

        combined = f"{subject} {topic}".lower()

        if "operat" in combined or "os" in combined or "process" in combined or "deadlock" in combined:
            pool = [
                {
                    "question": "Which of the following is NOT one of Coffman's four necessary conditions for a deadlock?",
                    "options": {"A": "Mutual Exclusion", "B": "Hold and Wait", "C": "Preemption Allowed", "D": "Circular Wait"},
                    "correct_option": "C",
                    "explanation": "No preemption is the required condition for deadlock. If preemption is allowed, deadlocks can be resolved or prevented.",
                },
                {
                    "question": "What is the primary purpose of the Translation Lookaside Buffer (TLB) in virtual memory?",
                    "options": {"A": "Cache frequently used disk blocks", "B": "Speed up virtual-to-physical address translation", "C": "Prevent buffer overflow attacks", "D": "Manage CPU register allocation"},
                    "correct_option": "B",
                    "explanation": "The TLB is a high-speed hardware cache that stores recent virtual-to-physical page table translations to reduce memory access latency.",
                },
                {
                    "question": "Which CPU scheduling algorithm can potentially lead to starvation for long processes?",
                    "options": {"A": "Shortest Job First (SJF)", "B": "First-Come, First-Served (FCFS)", "C": "Round Robin (RR)", "D": "FIFO"},
                    "correct_option": "A",
                    "explanation": "SJF gives priority to shorter jobs, meaning long processes can starve indefinitely if shorter processes arrive continuously.",
                },
                {
                    "question": "What happens when a CPU attempts to access a page marked as not present in physical RAM?",
                    "options": {"A": "Segmentation Fault", "B": "Page Fault Interrupt", "C": "System Reboot", "D": "Bus Error"},
                    "correct_option": "B",
                    "explanation": "A page fault interrupt triggers the OS kernel to load the requested page from swap/disk into an available physical memory frame.",
                },
                {
                    "question": "Which synchronization primitive uses an integer counter with atomic wait() and signal() operations?",
                    "options": {"A": "Spinlock", "B": "Counting Semaphore", "C": "Barrier", "D": "Condition Variable"},
                    "correct_option": "B",
                    "explanation": "A counting semaphore maintains an integer count and provides atomic P (wait) and V (signal) operations to coordinate resource sharing.",
                },
            ]
        elif "network" in combined or "cn" in combined or "tcp" in combined:
            pool = [
                {
                    "question": "Which flag sequence is exchanged during the standard TCP 3-way handshake?",
                    "options": {"A": "SYN -> SYN-ACK -> ACK", "B": "ACK -> SYN -> SYN-ACK", "C": "SYN -> ACK -> FIN", "D": "FIN -> FIN-ACK -> ACK"},
                    "correct_option": "A",
                    "explanation": "The client sends a SYN packet, the server responds with SYN-ACK, and the client confirms with an ACK to establish the connection.",
                },
                {
                    "question": "Which layer of the OSI model is responsible for end-to-end reliability and flow control?",
                    "options": {"A": "Network Layer", "B": "Transport Layer", "C": "Data Link Layer", "D": "Session Layer"},
                    "correct_option": "B",
                    "explanation": "The Transport Layer (Layer 4, e.g. TCP) provides end-to-end communication, segmentation, flow control, and error recovery.",
                },
                {
                    "question": "What is the standard subnet mask for a Class C network with prefix /24?",
                    "options": {"A": "255.0.0.0", "B": "255.255.0.0", "C": "255.255.255.0", "D": "255.255.255.128"},
                    "correct_option": "C",
                    "explanation": "A /24 network prefix has 24 network bits set to 1, which corresponds in dotted-decimal to 255.255.255.0.",
                },
                {
                    "question": "Which protocol translates human-readable domain names into numerical IP addresses?",
                    "options": {"A": "DHCP", "B": "DNS", "C": "ARP", "D": "NAT"},
                    "correct_option": "B",
                    "explanation": "The Domain Name System (DNS) maps human-readable domain names to routable IP addresses.",
                },
                {
                    "question": "What is the key difference between UDP and TCP?",
                    "options": {"A": "UDP is connection-oriented while TCP is connectionless", "B": "UDP is connectionless and does not guarantee packet delivery", "C": "UDP operates at the Application layer", "D": "TCP cannot transport data over IP"},
                    "correct_option": "B",
                    "explanation": "UDP prioritizes low latency and does not perform packet retransmission or handshaking, unlike reliable connection-oriented TCP.",
                },
            ]
        else:
            pool = [
                {
                    "question": "Which OOP principle restricts direct external access to an object's internal state?",
                    "options": {"A": "Inheritance", "B": "Encapsulation", "C": "Polymorphism", "D": "Abstraction"},
                    "correct_option": "B",
                    "explanation": "Encapsulation bundles data and methods while restricting direct external access to an object's internal representation.",
                },
                {
                    "question": "What allows different derived classes to implement the same method interface in different ways?",
                    "options": {"A": "Polymorphism", "B": "Encapsulation", "C": "Composition", "D": "Compilation"},
                    "correct_option": "A",
                    "explanation": "Polymorphism enables objects of different types to be treated through a common interface, each executing its own implementation.",
                },
                {
                    "question": "Which ACID property ensures a database transaction is completely processed or completely rolled back?",
                    "options": {"A": "Consistency", "B": "Isolation", "C": "Durability", "D": "Atomicity"},
                    "correct_option": "D",
                    "explanation": "Atomicity guarantees that all operations in a transaction succeed together or the database state is restored as if nothing ran.",
                },
                {
                    "question": "Which data structure operates on a strict Last-In, First-Out (LIFO) access pattern?",
                    "options": {"A": "Queue", "B": "Stack", "C": "Linked List", "D": "Binary Heap"},
                    "correct_option": "B",
                    "explanation": "A stack removes elements in the reverse order of their arrival (Last-In, First-Out).",
                },
                {
                    "question": "What is the average case search time complexity in a balanced Binary Search Tree (BST)?",
                    "options": {"A": "O(1)", "B": "O(n)", "C": "O(log n)", "D": "O(n log n)"},
                    "correct_option": "C",
                    "explanation": "A balanced BST halves the search space at each comparison, yielding logarithmic O(log n) search complexity.",
                },
            ]

        selected = pool[:min(count, len(pool))]
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
            "memory_tip": (
                f"Focus on the core keyword in the question. Remember Option {correct_option} "
                "directly satisfies the foundational constraint."
            ),
            "real_world_example": (
                "In enterprise software architectures, applying this exact principle prevents "
                "race conditions, memory leaks, and cascading failures."
            ),
        }


class LLMService:
    """
    Two-Tier Fast Multi-Provider AI Service:
      - Primary: Groq (Ultra-fast, ~1-2 seconds)
      - Secondary Fallback: Google Gemini Flash-Lite (~3.5 seconds)
      - Safety Net: Resilient Mock Engine (0.001s, 100% uptime)
    """

    def __init__(self):
        self.groq_api_key = getattr(settings, "GROQ_API_KEY", "")
        self.gemini_client = None
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)

        # Initialize Gemini client as standby fallback
        try:
            from google import genai
            self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            logger.info("Gemini fallback client initialized.")
        except Exception as e:
            logger.warning("Gemini client initialization failed: %s", e)

    # -------------------------------------------------------------
    # Groq API Caller (Primary)
    # -------------------------------------------------------------
    def _call_groq(self, prompt: str, system_message: str = "") -> Any:
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json",
        }
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": "openai/gpt-oss-20b",
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        with httpx.Client(timeout=6.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)

            # Unpack wrapped lists if nested under keys like {'questions': [...]} or {'topics': [...]}
            if isinstance(parsed, dict):
                for val in parsed.values():
                    if isinstance(val, list):
                        return val
            return parsed

    # -------------------------------------------------------------
    # Gemini API Caller (Secondary)
    # -------------------------------------------------------------
    def _call_gemini(self, prompt: str) -> Any:
        if not self.gemini_client:
            raise RuntimeError("Gemini client not initialized.")

        def _execute():
            return self.gemini_client.models.generate_content(
                model="gemini-3.1-flash-lite",
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )

        future = self._executor.submit(_execute)
        response = future.result(timeout=8.0)
        text = getattr(response, "text", "")
        if not text.strip():
            raise ValueError("Gemini returned empty text.")
        return json.loads(text)

    # -------------------------------------------------------------
    # Topic Extraction Cascade
    # -------------------------------------------------------------
    def extract_topics(self, subject: str, text: str) -> List[TopicItem]:
        prompt = TOPIC_EXTRACTION_PROMPT.format(subject=subject, text=text[:12000])

        # Tier 1: Groq (Primary)
        if self.groq_api_key:
            try:
                data = self._call_groq(
                    prompt,
                    system_message="You are a syllabus parser that strictly outputs a JSON object with a topics list.",
                )
                topics = TOPIC_LIST_ADAPTER.validate_python(data)
                if 3 <= len(topics) <= 6:
                    logger.info("Successfully extracted topics via Groq (Primary).")
                    return topics
            except Exception as e_groq:
                logger.warning("Groq topic extraction failed (%s). Falling back to Gemini...", e_groq)

        # Tier 2: Gemini (Secondary)
        try:
            data = self._call_gemini(prompt)
            topics = TOPIC_LIST_ADAPTER.validate_python(data)
            if 3 <= len(topics) <= 6:
                logger.info("Successfully extracted topics via Gemini (Fallback).")
                return topics
        except Exception as e_gem:
            logger.warning("Gemini topic extraction failed (%s). Falling back to Mock engine...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.extract_topics(subject, text)

    # -------------------------------------------------------------
    # Quiz Generation Cascade (Primary: Groq -> Fallback: Gemini)
    # -------------------------------------------------------------
    def generate_quiz(
        self,
        subject: str,
        topic: str,
        count: int,
        difficulty: str,
    ) -> InternalQuizSession:

        prompt = QUIZ_GENERATION_PROMPT.format(
            count=count,
            subject=subject,
            topic=topic,
            difficulty=difficulty,
        )

        # Tier 1: Groq (Primary - ~1.5s)
        if self.groq_api_key:
            try:
                data = self._call_groq(
                    prompt,
                    system_message="You are an assessment engine that strictly outputs a JSON object containing a questions array.",
                )
                generated = QUESTION_LIST_ADAPTER.validate_python(data)
                if len(generated) == count:
                    logger.info("Successfully generated %d questions via Groq (Primary).", count)
                    questions = {
                        f"q_{idx}": InternalQuestion(
                            id=f"q_{idx}",
                            question=q.question.strip(),
                            options=q.options,
                            correct_option=q.correct_option,
                            explanation=q.explanation.strip(),
                        )
                        for idx, q in enumerate(generated, start=1)
                    }
                    return InternalQuizSession(
                        quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
                        subject=subject,
                        topic=topic,
                        difficulty=difficulty,
                        questions=questions,
                    )
            except Exception as e_groq:
                logger.warning("Groq quiz generation failed (%s). Falling back to Gemini...", e_groq)

        # Tier 2: Gemini (Secondary - ~3.5s)
        try:
            data = self._call_gemini(prompt)
            generated = QUESTION_LIST_ADAPTER.validate_python(data)
            if len(generated) == count:
                logger.info("Successfully generated %d questions via Gemini (Fallback).", count)
                questions = {
                    f"q_{idx}": InternalQuestion(
                        id=f"q_{idx}",
                        question=q.question.strip(),
                        options=q.options,
                        correct_option=q.correct_option,
                        explanation=q.explanation.strip(),
                    )
                    for idx, q in enumerate(generated, start=1)
                }
                return InternalQuizSession(
                    quiz_session_id=f"quiz_{uuid.uuid4().hex[:10]}",
                    subject=subject,
                    topic=topic,
                    difficulty=difficulty,
                    questions=questions,
                )
        except Exception as e_gem:
            logger.warning("Gemini quiz generation failed (%s). Falling back to Mock engine...", e_gem)

        # Tier 3: Mock Fallback
        return MockAIEngine.generate_quiz(subject, topic, count, difficulty)

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
        if self.groq_api_key:
            try:
                data = self._call_groq(prompt)
                if all(k in data and isinstance(data[k], str) and data[k].strip() for k in required_keys):
                    logger.info("AI Tutor explanation generated via Groq (Primary).")
                    return {k: data[k].strip() for k in required_keys}
            except Exception as e_groq:
                logger.warning("Groq tutor explanation failed (%s). Falling back to Gemini...", e_groq)

        # Tier 2: Gemini
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
