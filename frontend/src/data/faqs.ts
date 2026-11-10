
export type FAQ = {
  question: string;
  answer: string;
  category: string;
};

export const faqs: FAQ[] = [
  {
    category: "Getting Started",
    question: "What is MindMark?",
    answer:
      "MindMark is an online learning and assessment platform that helps you create, attempt, and review quizzes to test your knowledge and improve your preparation.",
  },
  {
    category: "Getting Started",
    question: "Do I need an account to use MindMark?",
    answer:
      "Some features may be available without an account, while features such as saving quiz history or accessing your personal results may require you to sign in.",
  },
  {
    category: "Getting Started",
    question: "How do I get started?",
    answer:
      "Visit the quiz section, choose an available quiz or follow the quiz creation process, and start answering questions. Follow any instructions shown on the screen.",
  },
  {
    category: "Quizzes",
    question: "Can I create my own quizzes?",
    answer:
      "MindMark is designed to support quiz creation. The available creation options depend on the features enabled on the platform.",
  },
  {
    category: "Quizzes",
    question: "Can I upload my study material to create a quiz?",
    answer:
      "If document upload is enabled, you can submit supported study materials through the available upload option. Make sure you have permission to use the material you upload.",
  },
  {
    category: "Quizzes",
    question: "Can I see my score after completing a quiz?",
    answer:
      "Quiz results and scores are displayed according to the quiz settings. Where available, you can review your performance after submitting your answers.",
  },
  {
    category: "Quizzes",
    question: "Can I retake a quiz?",
    answer:
      "Retake availability depends on the settings of the particular quiz. Check the quiz page for available attempts and instructions.",
  },
  {
    category: "Quizzes",
    question: "Are the quiz questions always accurate?",
    answer:
      "We aim to provide useful learning and assessment experiences, but questions, generated content, and explanations may occasionally contain errors. Always verify important information using trusted learning resources.",
  },
  {
    category: "Account & Privacy",
    question: "Is my quiz history saved?",
    answer:
      "If quiz history is supported and you are signed in, relevant activity may be saved to your account. The information available depends on the platform features and settings.",
  },
  {
    category: "Account & Privacy",
    question: "Is my personal information safe?",
    answer:
      "We take reasonable measures to protect information processed through MindMark. You can read our Privacy Policy to understand what information we collect, how it is used, and your available choices.",
  },
  {
    category: "Account & Privacy",
    question: "Can I request deletion of my account or data?",
    answer:
      "You can contact us to request deletion of your personal information, subject to applicable legal requirements and any information we are required or permitted to retain.",
  },
  {
    category: "Support",
    question: "What should I do if a quiz is not loading?",
    answer:
      "Check your internet connection, refresh the page, and try again using an updated browser. If the issue continues, contact our support team with details of the problem.",
  },
  {
    category: "Support",
    question: "How can I contact MindMark?",
    answer:
      "For assistance or questions, contact us at [YOUR SUPPORT EMAIL]. We will update this answer with the official support contact details.",
  },
];
