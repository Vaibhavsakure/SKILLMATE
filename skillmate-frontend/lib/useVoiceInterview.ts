"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  createInterviewWebSocket,
  type VoiceInterviewConfig,
  type InterviewAnswerResult,
  type InterviewReportData,
  type WSIncomingMessage,
} from "@/lib/api";

// --- Types ---
export type InterviewPhase =
  | "idle"
  | "connecting"
  | "ready"
  | "listening"
  | "evaluating"
  | "speaking"
  | "report"
  | "error";

export interface InterviewState {
  phase: InterviewPhase;
  sessionId: string | null;
  currentQuestion: string;
  currentCategory: string;
  questionNumber: number;
  totalQuestions: number;
  lastFeedback: string;
  lastScore: number | null;
  report: InterviewReportData | null;
  transcript: string;
  error: string | null;
  elapsedSeconds: number;
}

const INITIAL_STATE: InterviewState = {
  phase: "idle",
  sessionId: null,
  currentQuestion: "",
  currentCategory: "",
  questionNumber: 0,
  totalQuestions: 5,
  lastFeedback: "",
  lastScore: null,
  report: null,
  transcript: "",
  error: null,
  elapsedSeconds: 0,
};

/**
 * Custom hook for the Voice Interview Simulator.
 * Manages WebSocket connection, microphone recording, speech synthesis,
 * and the full interview lifecycle.
 */
export function useVoiceInterview(token: string | null) {
  const [state, setState] = useState<InterviewState>(INITIAL_STATE);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }
    return () => {
      // Cleanup on unmount
      synthRef.current?.cancel();
      if (timerRef.current) clearInterval(timerRef.current);
      wsRef.current?.close();
    };
  }, []);

  // --- Helper: Speak text aloud ---
  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        resolve();
        return;
      }
      synthRef.current.cancel(); // Cancel any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to use a professional-sounding voice
      const voices = synthRef.current.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes("Google") ||
          v.name.includes("Microsoft") ||
          v.name.includes("Samantha") ||
          v.lang.startsWith("en")
      );
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synthRef.current.speak(utterance);
    });
  }, []);

  // --- Helper: Start elapsed timer ---
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setState((prev) => ({
        ...prev,
        elapsedSeconds: prev.elapsedSeconds + 1,
      }));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // --- Connect & Start Interview ---
  const startInterview = useCallback(
    async (config: VoiceInterviewConfig) => {
      if (!token) {
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: "Not authenticated",
        }));
        return;
      }

      setState({
        ...INITIAL_STATE,
        phase: "connecting",
        totalQuestions: config.total_questions || 5,
      });

      try {
        const ws = createInterviewWebSocket(token);
        wsRef.current = ws;

        ws.onopen = () => {
          // Send start command
          ws.send(
            JSON.stringify({
              type: "start",
              data: {
                job_title: config.job_title,
                resume_text: config.resume_text,
                difficulty: config.difficulty,
                total_questions: config.total_questions || 5,
              },
            })
          );
        };

        ws.onmessage = async (event) => {
          const msg: WSIncomingMessage = JSON.parse(event.data);

          switch (msg.type) {
            case "session_start": {
              const question = msg.data.question;
              setState((prev) => ({
                ...prev,
                phase: "speaking",
                sessionId: msg.data.session_id,
                currentQuestion: question,
                currentCategory: msg.data.category,
                questionNumber: msg.data.question_number,
                totalQuestions: msg.data.total_questions,
              }));
              startTimer();
              // Read the question aloud
              await speakText(question);
              setState((prev) => ({ ...prev, phase: "ready" }));
              break;
            }

            case "evaluating":
              setState((prev) => ({
                ...prev,
                phase: "evaluating",
              }));
              break;

            case "answer_result": {
              const result = msg.data as InterviewAnswerResult;
              const nextQ = result.next_question || "";

              setState((prev) => ({
                ...prev,
                phase: "speaking",
                lastScore: result.score,
                lastFeedback: result.feedback,
                currentQuestion: nextQ,
                currentCategory: result.next_category || "technical",
                questionNumber: result.question_number,
                transcript: "",
              }));

              // Speak feedback, then next question
              await speakText(result.feedback);
              if (nextQ) {
                await speakText(nextQ);
              }
              setState((prev) => ({ ...prev, phase: "ready" }));
              break;
            }

            case "generating_report":
              setState((prev) => ({
                ...prev,
                phase: "evaluating",
              }));
              break;

            case "interview_complete": {
              stopTimer();
              const report = msg.data.report as InterviewReportData;

              // Include last answer feedback if present
              if (msg.data.report?.last_answer_feedback) {
                setState((prev) => ({
                  ...prev,
                  lastFeedback: msg.data.report.last_answer_feedback,
                  lastScore: msg.data.report.last_answer_score,
                }));
              }

              setState((prev) => ({
                ...prev,
                phase: "report",
                report,
              }));

              await speakText(
                `Interview complete. Your overall score is ${report.overall_score} out of 100.`
              );
              break;
            }

            case "error":
              setState((prev) => ({
                ...prev,
                error: msg.data.message || "Unknown error",
              }));
              break;

            case "pong":
              // Keep-alive response, no action needed
              break;
          }
        };

        ws.onerror = () => {
          stopTimer();
          setState((prev) => ({
            ...prev,
            phase: "error",
            error: "WebSocket connection failed. Is the backend running?",
          }));
        };

        ws.onclose = (event) => {
          stopTimer();
          if (event.code === 4001) {
            setState((prev) => ({
              ...prev,
              phase: "error",
              error: "Authentication failed. Please re-login.",
            }));
          }
        };
      } catch (err: any) {
        stopTimer();
        setState((prev) => ({
          ...prev,
          phase: "error",
          error: err.message || "Failed to connect",
        }));
      }
    },
    [token, speakText, startTimer, stopTimer]
  );

  // --- Start Recording (Microphone) ---
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setState((prev) => ({ ...prev, phase: "listening", transcript: "" }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error:
          "Microphone access denied. Please allow microphone access in your browser settings.",
      }));
    }
  }, []);

  // --- Stop Recording & Send Transcription ---
  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder || mediaRecorder.state !== "recording") return;

    mediaRecorder.stop();

    // Stop all audio tracks to release the microphone
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());

    mediaRecorder.onstop = () => {
      // For now, we use the Web Speech API for transcription (free, client-side)
      // In production, you'd send the audio blob to Whisper API
      setState((prev) => ({ ...prev, phase: "evaluating" }));
    };
  }, []);

  // --- Send Text Answer (for typed/transcribed input) ---
  const sendAnswer = useCallback(
    (text: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setState((prev) => ({
          ...prev,
          error: "WebSocket not connected",
        }));
        return;
      }

      wsRef.current.send(
        JSON.stringify({
          type: "answer",
          data: {
            transcription: text,
            question_number: state.questionNumber,
          },
        })
      );

      setState((prev) => ({ ...prev, phase: "evaluating", transcript: "" }));
    },
    [state.questionNumber]
  );

  // --- Update transcript (from SpeechRecognition or manual input) ---
  const setTranscript = useCallback((text: string) => {
    setState((prev) => ({ ...prev, transcript: text }));
  }, []);

  // --- End Interview Early ---
  const endInterview = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "finish" }));
    }
    stopTimer();
  }, [stopTimer]);

  // --- Reset Everything ---
  const resetInterview = useCallback(() => {
    synthRef.current?.cancel();
    stopTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setState(INITIAL_STATE);
  }, [stopTimer]);

  return {
    state,
    startInterview,
    startRecording,
    stopRecording,
    sendAnswer,
    setTranscript,
    endInterview,
    resetInterview,
  };
}
