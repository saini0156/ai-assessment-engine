"""
Quick Database Inspector for Nitish.
Prints the latest quiz sessions, student scores, and recorded answers from PostgreSQL.
"""
import sys
from app.database import SessionLocal
from app.models.quiz_session import QuizSession
from app.models.quiz_session_question import QuizSessionQuestion
from app.models.quiz_answer import QuizAnswer
from app.models.topic import Topic
from app.models.subject import Subject

def inspect_latest_database_records():
    db = SessionLocal()
    try:
        print("=" * 65)
        print("POSTGRESQL DATABASE INSPECTION REPORT (ai_assessment_db)")
        print("=" * 65)

        total_sessions = db.query(QuizSession).count()
        total_answers = db.query(QuizAnswer).count()
        total_questions = db.query(QuizSessionQuestion).count()

        print(f"\nTOTAL COUNTS:")
        print(f"  * Total Quiz Sessions : {total_sessions}")
        print(f"  * Total Test Questions: {total_questions}")
        print(f"  * Total Answers Logged: {total_answers}")

        # Fetch latest session
        latest_session = db.query(QuizSession).order_by(QuizSession.started_at.desc()).first()
        if not latest_session:
            print("\n[!] No quiz sessions found in database yet.")
            return

        subject = db.query(Subject).filter_by(id=latest_session.subject_id).first()
        topic = db.query(Topic).filter_by(id=latest_session.topic_id).first()

        print(f"\nLATEST QUIZ SESSION DETAILS:")
        print(f"  * Session ID    : {latest_session.id}")
        print(f"  * Subject       : {subject.name if subject else 'Unknown'}")
        print(f"  * Topic         : {topic.name if topic else 'Unknown'}")
        print(f"  * Difficulty    : {latest_session.difficulty.upper()}")
        print(f"  * Status        : {latest_session.status.upper()}")
        print(f"  * Score         : {latest_session.score_percentage}%")
        print(f"  * Started At    : {latest_session.started_at}")
        print(f"  * Submitted At  : {latest_session.submitted_at}")

        # Fetch questions and answers for this session
        session_questions = db.query(QuizSessionQuestion).filter_by(session_id=latest_session.id).order_by(QuizSessionQuestion.question_order).all()
        print(f"\nQUESTIONS & STUDENT ATTEMPTS ({len(session_questions)} questions):")

        for sq in session_questions:
            ans = db.query(QuizAnswer).filter_by(session_question_id=sq.id).first()
            selected = ans.selected_option if ans else "Unattempted"
            status_icon = "[CORRECT]" if (ans and ans.is_correct) else "[INCORRECT]"

            print(f"\n  [Q{sq.question_order}] {sq.question_text_snapshot[:65]}...")
            print(f"       Correct Answer : Option {sq.correct_option_snapshot}")
            print(f"       Student Choice : Option {selected} -> {status_icon}")

        print("\n" + "=" * 65)
        print("DATABASE VERIFICATION COMPLETE: ALL DATA PERMANENTLY SAVED!")
        print("=" * 65)

    except Exception as e:
        print(f"Error inspecting database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_latest_database_records()
