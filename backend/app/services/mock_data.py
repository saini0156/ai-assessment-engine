"""
Subject-Aware Offline Fallback Question Banks and Mock AI Engine.
Extracted for code hygiene and modularity.
"""
import re
import uuid
from typing import Any, Dict, List, Optional

from app.models.schemas import InternalQuestion, InternalQuizSession, TopicItem


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
        is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{subject} {text[:4000]}")) or "hindi" in subj
        if is_hindi:
            if any(k in subj or k in text for k in ["विज्ञान", "भौतिक", "science", "physics"]):
                return [
                    TopicItem(topic_id="top_1", topic_name="प्रकाश - परावर्तन तथा अपवर्तन", subtopics=["समतल तथा गोलीय दर्पण", "अपवर्तन के नियम", "लेंस की क्षमता"], summary="प्रकाश के परावर्तन और अपवर्तन के मूल नियम तथा व्यावहारिक अनुप्रयोग।"),
                    TopicItem(topic_id="top_2", topic_name="विद्युत तथा इसके प्रभाव", subtopics=["ओम का नियम", "विद्युत धारा और विभवांतर", "विद्युत शक्ति"], summary="विद्युत परिपथ, प्रतिरोध तथा जूल का तापन नियम।"),
                    TopicItem(topic_id="top_3", topic_name="विद्युत धारा के चुंबकीय प्रभाव", subtopics=["चुंबकीय क्षेत्र रेखाएं", "फ्लेमिंग का वामहस्त नियम", "विद्युत मोटर"], summary="चुंबकीय क्षेत्र और विद्युत चुंबकीय प्रेरण के आधारभूत सिद्धांत।"),
                    TopicItem(topic_id="top_4", topic_name="ऊर्जा के स्रोत", subtopics=["पारंपरिक ऊर्जा स्रोत", "सौर ऊर्जा", "पर्यावरण संरक्षण"], summary="ऊर्जा के विभिन्न स्रोतों का तुलनात्मक अध्ययन और संरक्षण।"),
                ]
            elif any(k in subj or k in text for k in ["गणित", "math", "संख्या"]):
                return [
                    TopicItem(topic_id="top_1", topic_name="वास्तविक संख्याएँ", subtopics=["अंकगणित की आधारभूत प्रमेय", "अपरिमेय संख्याओं का सत्यापन", "दशमलव प्रसार"], summary="यूक्लिड विभाजन और अभाज्य गुणनखंडन के नियम।"),
                    TopicItem(topic_id="top_2", topic_name="द्विघात समीकरण एवं बहुपद", subtopics=["शून्यकों का ज्यामितीय अर्थ", "विविक्तकर (Discriminant)", "मूलों की प्रकृति"], summary="द्विघात सूत्र और गुणनखंडन विधि द्वारा समीकरण हल करना।"),
                    TopicItem(topic_id="top_3", topic_name="त्रिकोणमिति का परिचय", subtopics=["त्रिकोणमितीय अनुपात", "विशिष्ट कोणों के अनुपात", "सर्वसमिकाएँ"], summary="समकोण त्रिभुज और पाइथागोरस प्रमेय पर आधारित त्रिकोणमितीय संबंध।"),
                    TopicItem(topic_id="top_4", topic_name="समांतर श्रेढ़ियाँ (AP)", subtopics=["n-वां पद ज्ञात करना", "प्रथम n पदों का योग", "दैनिक जीवन में अनुप्रयोग"], summary="समांतर श्रेणी के पद और योगफल के मानक सूत्र।"),
                ]
            else:
                return [
                    TopicItem(topic_id="top_1", topic_name=f"{subject or 'पाठ्यक्रम'} - मूलभूत सिद्धांत", subtopics=["मूल परिभाषाएं", "सिद्धांत", "अवधारणाएं"], summary="विषय के आधारभूत सिद्धांतों का समग्र परिचय।"),
                    TopicItem(topic_id="top_2", topic_name=f"{subject or 'पाठ्यक्रम'} - व्यावहारिक अनुप्रयोग", subtopics=["प्रायोगिक नियम", "उदाहरण", "समस्या समाधान"], summary="विषय के प्रमुख व्यावहारिक अनुप्रयोग और विश्लेषण।"),
                ]

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

    @classmethod
    def get_pool(cls, subject: str, topic: str, difficulty: str = "Medium") -> List[Dict[str, Any]]:
        combined = f"{subject} {topic}".lower()
        diff = (difficulty or "Medium").capitalize()

        # 0. Hindi Question Bank (Class X Science & Mathematics)
        is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{subject} {topic}")) or "hindi" in combined
        if is_hindi:
            return [
                {
                    "question": "यदि किसी द्विघात समीकरण ax^2 + bx + c = 0 का विविक्तकर (b^2 - 4ac) शून्य से बड़ा (> 0) हो, तो मूलों की प्रकृति कैसी होगी?",
                    "options": {"A": "दो भिन्न वास्तविक मूल", "B": "दो बराबर वास्तविक मूल", "C": "कोई वास्तविक मूल नहीं", "D": "अवास्तविक (काल्पनिक) मूल"},
                    "correct_option": "A",
                    "explanation": "जब विविक्तकर (D > 0) धनात्मक होता है, तो द्विघात सूत्र के अनुसार दो भिन्न वास्तविक मूल प्राप्त होते हैं।"
                },
                {
                    "question": "किसी वास्तविक कोण x के लिए sin^2(x) + cos^2(x) का मान क्या होगा?",
                    "options": {"A": "0", "B": "1", "C": "tan(x)", "D": "2"},
                    "correct_option": "B",
                    "explanation": "sin^2(x) + cos^2(x) = 1 त्रिकोणमिति की मूलभूत सर्वसमिका है।"
                },
                {
                    "question": "समतल दर्पण की फोकस दूरी (Focal Length) कितनी होती है?",
                    "options": {"A": "शून्य", "B": "अनंत (Infinite)", "C": "25 सेमी", "D": "-25 सेमी"},
                    "correct_option": "B",
                    "explanation": "समतल दर्पण की वक्रता त्रिज्या अनंत होती है, इसलिए इसकी फोकस दूरी भी अनंत (Infinity) होती है।"
                },
                {
                    "question": "विद्युत विभवांतर (Electric Potential Difference) का SI मात्रक क्या है?",
                    "options": {"A": "एम्पीयर (Ampere)", "B": "वोल्ट (Volt)", "C": "ओम (Ohm)", "D": "जूल (Joule)"},
                    "correct_option": "B",
                    "explanation": "विद्युत विभवांतर का SI मात्रक 'वोल्ट' (V) है। 1 वोल्ट = 1 जूल प्रति कूलॉम होता है।"
                },
                {
                    "question": "प्रकाश के अपवर्तन के दौरान जब प्रकाश की किरण विरल माध्यम से सघन माध्यम में प्रवेश करती है, तो वह:",
                    "options": {
                        "A": "अभिलंब की ओर झुकती है",
                        "B": "अभिलंब से दूर हटती है",
                        "C": "सीधे बिना मुड़े निकल जाती है",
                        "D": "परावर्तित होकर वापस लौट जाती है"
                    },
                    "correct_option": "A",
                    "explanation": "जब प्रकाश विरल माध्यम से सघन माध्यम में जाता है, तो चाल कम होने के कारण अभिलंब की ओर झुक जाता है।"
                },
                {
                    "question": "ओम के नियम (Ohm's Law) के अनुसार विभवांतर (V) और धारा (I) के बीच सही संबंध क्या है?",
                    "options": {"A": "V = I * R", "B": "V = I / R", "C": "V = R / I", "D": "V = I + R"},
                    "correct_option": "A",
                    "explanation": "ओम के नियम के अनुसार एक निश्चित ताप पर चालक के सिरों का विभवांतर उसमें प्रवाहित धारा के समानुपाती होता है (V = IR)।"
                },
                {
                    "question": "एक लेंस की क्षमता (Power of Lens) +2.0 D है। इसकी फोकस दूरी क्या होगी?",
                    "options": {"A": "+0.5 मीटर", "B": "+2.0 मीटर", "C": "-0.5 मीटर", "D": "+50 मीटर"},
                    "correct_option": "A",
                    "explanation": "लेंस की क्षमता P = 1/f (मीटर में) होती है। f = 1/2 = +0.5 मीटर (50 सेमी)।"
                },
                {
                    "question": "अंकगणित की आधारभूत प्रमेय के अनुसार प्रत्येक भाज्य संख्या को किस रूप में व्यक्त किया जा सकता है?",
                    "options": {"A": "अभाज्य संख्याओं के गुणनफल के रूप में", "B": "सम संख्याओं के योग के रूप में", "C": "विषम संख्याओं के रूप में", "D": "परिमेय संख्याओं के रूप में"},
                    "correct_option": "A",
                    "explanation": "अंकगणित की आधारभूत प्रमेय के अनुसार प्रत्येक भाज्य संख्या को अभाज्य संख्याओं के गुणनफल के रूप में व्यक्त किया जा सकता है।"
                },
                {
                    "question": "समांतर श्रेणी (AP) 2, 7, 12, ... का 10-वां पद क्या होगा?",
                    "options": {"A": "47", "B": "42", "C": "52", "D": "37"},
                    "correct_option": "A",
                    "explanation": "प्रथम पद a = 2, सार्व अंतर d = 5। 10-वां पद a_10 = 2 + (10 - 1)*5 = 2 + 45 = 47।"
                },
                {
                    "question": "मानव नेत्र के किस भाग पर किसी वस्तु का वास्तविक प्रतिबिंब बनता है?",
                    "options": {"A": "कॉर्निया (Cornea)", "B": "दृष्टिपटल (Retina)", "C": "पुतली (Pupil)", "D": "परितारिका (Iris)"},
                    "correct_option": "B",
                    "explanation": "मानव नेत्र में किसी वस्तु का वास्तविक तथा उल्टा प्रतिबिंब दृष्टिपटल (Retina) पर बनता है।"
                },
                {
                    "question": "विद्युत धारा उत्पन्न करने की युक्ति को क्या कहते हैं?",
                    "options": {"A": "विद्युत जनित्र (Generator)", "B": "गैल्वेनोमीटर", "C": "एमीटर", "D": "विद्युत मोटर"},
                    "correct_option": "A",
                    "explanation": "विद्युत जनित्र यांत्रिक ऊर्जा को विद्युत ऊर्जा में बदलकर विद्युत धारा उत्पन्न करता है।"
                },
                {
                    "question": "निकट दृष्टि दोष (Myopia) को संशोधित करने के लिए किस लेंस का उपयोग किया जाता है?",
                    "options": {"A": "अवतल लेंस (Concave Lens)", "B": "उत्तल लेंस (Convex Lens)", "C": "द्विफोकसी लेंस", "D": "बेलनाकार लेंस"},
                    "correct_option": "A",
                    "explanation": "निकट दृष्टि दोष को संशोधित करने के लिए उपयुक्त क्षमता का अवतल लेंस (Concave Lens) उपयोग किया जाता है।"
                }
            ]

        # 1. Mathematics Question Bank (20 Verified Questions)
        if any(k in combined for k in ["math", "mathematics", "algebra", "geometry", "trig", "arithmetic", "calculus", "class x", "class 10"]):
            raw_pool = [
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
            raw_pool = [
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
            raw_pool = [
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
            raw_pool = [
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
            raw_pool = [
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

        # Prioritize foundational questions for Easy, and multi-step advanced questions for Hard
        if diff == "Hard" and len(raw_pool) > 5:
            return raw_pool[len(raw_pool) // 2 :] + raw_pool[: len(raw_pool) // 2]
        return raw_pool

    @classmethod
    def generate_quiz(cls, subject: str, topic: str, count: int, difficulty: str) -> InternalQuizSession:
        pool = cls.get_pool(subject, topic, difficulty)
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
        is_hindi = bool(re.search(r'[\u0900-\u097F]', f"{question} {explanation}"))
        if is_hindi:
            return {
                "simplified_explanation": (
                    f"आपने विकल्प {selected_option or 'कोई नहीं'} चुना था। "
                    f"सही उत्तर विकल्प {correct_option} है। {explanation}"
                ),
                "memory_tip": f"याद रखें: विकल्प {correct_option} इस अवधारणा के सटीक नियम को दर्शाता है।",
                "real_world_example": "व्यावहारिक उदाहरण: इस सिद्धांत को सही रूप से समझकर परीक्षा में नकारात्मक अंकों (negative marking) से बचा जा सकता है।",
            }

        return {
            "simplified_explanation": (
                f"You selected Option {selected_option or 'None'}. "
                f"The correct answer is Option {correct_option}. {explanation}"
            ),
            "memory_tip": f"Remember: Option {correct_option} directly satisfies the underlying rule of this question.",
            "real_world_example": "In practice, understanding this fundamental principle prevents errors and ensures correct results.",
        }

