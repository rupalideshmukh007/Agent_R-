import { useState, useEffect, useRef, useCallback } from "react";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

type AppState = "listening" | "matched" | "answered";

interface QA {
  question: string;
  answer: string;
  keywords: string[];
}

const QUESTIONS: QA[] = [
  {
    question: "भारताची राजधानी कोणती आहे?",
    answer: "नवी दिल्ली (New Delhi)",
    keywords: ["भारत", "राजधानी", "capital", "india", "bharat"],
  },
  {
    question: "पाण्याचे रासायनिक सूत्र काय आहे?",
    answer: "H₂O",
    keywords: ["पाणी", "water", "सूत्र", "formula", "रासायनिक", "paani"],
  },
  {
    question: "महाराष्ट्राची राजधानी कोणती आहे?",
    answer: "मुंबई (Mumbai)",
    keywords: ["महाराष्ट्र", "maharashtra", "राजधानी", "mumbai"],
  },
  {
    question: "सूर्य हा कोणत्या प्रकारचा तारा आहे?",
    answer: "G-type main-sequence star (पिवळा बटु तारा)",
    keywords: ["सूर्य", "sun", "तारा", "star", "surya"],
  },
  {
    question: "मानवी शरीरात किती हाडे असतात?",
    answer: "206 हाडे",
    keywords: ["हाडे", "bones", "शरीर", "body", "haade"],
  },
];

const ANSWER_TRIGGERS = ["answer", "उत्तर", "aansar", "dakhav", "दाखव", "show", "सांग"];
const NEXT_TRIGGERS = ["next", "पुढे", "pudhe", "pudhil", "पुढील", "nxt"];

function matchQuestion(spoken: string): QA | null {
  const norm = spoken.toLowerCase().replace(/[?।,.!]/g, " ");
  let best: QA | null = null;
  let bestScore = 0;
  for (const qa of QUESTIONS) {
    let score = 0;
    for (const kw of qa.keywords) {
      if (norm.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) { bestScore = score; best = qa; }
  }
  return bestScore >= 1 ? best : null;
}

function isAnswerTrigger(spoken: string): boolean {
  const norm = spoken.toLowerCase();
  return ANSWER_TRIGGERS.some((t) => norm.includes(t));
}

function isNextTrigger(spoken: string): boolean {
  const norm = spoken.toLowerCase();
  return NEXT_TRIGGERS.some((t) => norm.includes(t));
}

function doVibrate() {
  if ("vibrate" in navigator) navigator.vibrate(3000);
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("listening");
  const [matched, setMatched] = useState<QA | null>(null);
  const [isVibrating, setIsVibrating] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [notSupported, setNotSupported] = useState(false);

  const appStateRef = useRef<AppState>("listening");
  const shouldRestartRef = useRef(true);
  const recRef = useRef<SpeechRecognition | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpeech = useCallback((text: string) => {
    setLastHeard(text);
    const cur = appStateRef.current;
    if (cur === "listening") {
      const q = matchQuestion(text);
      if (q) { appStateRef.current = "matched"; setMatched(q); setAppState("matched"); }
    } else if (cur === "matched") {
      if (isAnswerTrigger(text)) {
        appStateRef.current = "answered";
        setAppState("answered");
        doVibrate();
        setIsVibrating(true);
        setTimeout(() => setIsVibrating(false), 3000);
      } else if (isNextTrigger(text)) {
        appStateRef.current = "listening"; setMatched(null); setAppState("listening");
      }
    } else if (cur === "answered") {
      if (isNextTrigger(text)) {
        appStateRef.current = "listening";
        setMatched(null); setAppState("listening"); setIsVibrating(false);
        if ("vibrate" in navigator) navigator.vibrate(0);
      }
    }
  }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setNotSupported(true); return; }

    const startRec = () => {
      if (!shouldRestartRef.current) return;
      const rec = new SR();
      rec.lang = "mr-IN";
      rec.continuous = false;
      rec.interimResults = false;
      rec.onstart = () => setMicActive(true);
      rec.onend = () => {
        setMicActive(false);
        if (shouldRestartRef.current) restartTimerRef.current = setTimeout(startRec, 200);
      };
      rec.onerror = (e: SpeechRecognitionErrorEvent) => {
        if (e.error === "not-allowed") { setNotSupported(true); shouldRestartRef.current = false; return; }
        if (shouldRestartRef.current) restartTimerRef.current = setTimeout(startRec, 600);
      };
      rec.onresult = (e: SpeechRecognitionEvent) => {
        handleSpeech(e.results[0][0].transcript.trim());
      };
      recRef.current = rec;
      try { rec.start(); } catch { restartTimerRef.current = setTimeout(startRec, 500); }
    };

    shouldRestartRef.current = true;
    startRec();
    return () => {
      shouldRestartRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try { recRef.current?.stop(); } catch { /* ignore */ }
    };
  }, [handleSpeech]);

  if (notSupported) return (
    <div className="app-bg">
      <div className="card center-card">
        <div className="big-icon">⚠️</div>
        <p className="err-title">Speech Not Supported</p>
        <p className="err-sub">Please use <strong>Chrome</strong> on Android.</p>
      </div>
    </div>
  );

  return (
    <div className="app-bg">
      <div className="container">
        <div className={`mic-wrap ${micActive ? "active" : ""}`}>
          {micActive && <div className="mic-pulse" />}
          {micActive && <div className="mic-pulse delay" />}
          <div className="mic-btn">🎙️</div>
        </div>
        <p className="status-text">
          {appState === "listening" && <><span className="status-dot listening" /> बोला... प्रश्न सांगा</>}
          {appState === "matched" && <><span className="status-dot matched" /> "answer" म्हणा</>}
          {appState === "answered" && <><span className="status-dot answered" /> "next" म्हणा पुढच्या प्रश्नासाठी</>}
        </p>
        {lastHeard && <div className="heard-chip">🗣 &ldquo;{lastHeard}&rdquo;</div>}
        {(appState === "matched" || appState === "answered") && matched && (
          <div className="card question-card">
            <p className="label">प्रश्न (Question)</p>
            <p className="question-text">{matched.question}</p>
          </div>
        )}
        {appState === "answered" && matched && (
          <div className={`card answer-card${isVibrating ? " vibrating" : ""}`}>
            <p className="label answer-label">उत्तर (Answer)</p>
            {isVibrating && <div className="vib-badge">📳 Vibrating 3s...</div>}
            <p className="answer-text">{matched.answer}</p>
          </div>
        )}
        {appState === "listening" && (
          <div className="hint-box">
            <p className="hint-title">Voice Commands:</p>
            <p className="hint-row">🔍 Question बोला → match होईल</p>
            <p className="hint-row">🔓 "answer" बोला → उत्तर + vibrate</p>
            <p className="hint-row">➡️ "next" बोला → पुढचा प्रश्न</p>
          </div>
        )}
      </div>
    </div>
  );
}
