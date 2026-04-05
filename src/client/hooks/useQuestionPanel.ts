import { useState, useCallback, useRef } from "react";
import { Canvas } from "fabric";
import type { Question, Answer } from "../lib/protocol";

export interface QuestionState {
  question: Question;
  answer: Answer | null;
  canvasJson: object;
}

interface UseQuestionPanelOptions {
  getCanvas: () => Canvas | null;
  centerContent?: () => void;
}

export function useQuestionPanel({ getCanvas, centerContent }: UseQuestionPanelOptions) {
  const [questions, setQuestions] = useState<QuestionState[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [closed, setClosed] = useState(false);
  const [questionsDone, setQuestionsDone] = useState(false);
  const questionsRef = useRef<QuestionState[]>([]);
  const currentIndexRef = useRef(-1);

  // Keep refs in sync
  questionsRef.current = questions;
  currentIndexRef.current = currentIndex;

  const saveCurrent = useCallback(() => {
    const canvas = getCanvas();
    const idx = currentIndexRef.current;
    if (!canvas || idx < 0 || idx >= questionsRef.current.length) return;
    const canvasJson = canvas.toJSON();
    setQuestions((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], canvasJson };
      return updated;
    });
    questionsRef.current[idx] = { ...questionsRef.current[idx], canvasJson };
  }, [getCanvas]);

  const addBatch = useCallback(
    (items: { question: Question; canvasJson: object }[]) => {
      const newStates: QuestionState[] = items.map((item) => ({
        question: item.question,
        answer: null,
        canvasJson: item.canvasJson,
      }));
      setQuestions(newStates);
      questionsRef.current = newStates;
      setCurrentIndex(0);
      currentIndexRef.current = 0;
      setQuestionsDone(true);
      setClosed(false);
    },
    []
  );

  const navigateTo = useCallback(
    (index: number) => {
      const canvas = getCanvas();
      if (!canvas || index < 0 || index >= questionsRef.current.length) return;
      saveCurrent();
      const target = questionsRef.current[index];
      canvas.loadFromJSON(target.canvasJson).then(() => {
        centerContent?.();
        canvas.requestRenderAll();
      });
      setCurrentIndex(index);
      currentIndexRef.current = index;
    },
    [getCanvas, saveCurrent]
  );

  const setAnswer = useCallback((value: string | string[]) => {
    const idx = currentIndexRef.current;
    setQuestions((prev) => {
      if (idx < 0 || idx >= prev.length) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        answer: { questionId: updated[idx].question.id, value },
      };
      questionsRef.current = updated;
      return updated;
    });
  }, []);

  const getAllAnswers = useCallback((): Answer[] => {
    return questionsRef.current
      .filter((q) => q.answer !== null)
      .map((q) => q.answer!);
  }, []);

  const getQuestionsState = useCallback((): QuestionState[] => {
    return questionsRef.current;
  }, []);

  const close = useCallback(() => {
    saveCurrent();
    setClosed(true);
  }, [saveCurrent]);

  const isOpen = questions.length > 0 && !closed;
  const current =
    currentIndex >= 0 && currentIndex < questions.length
      ? questions[currentIndex]
      : null;

  return {
    questions,
    currentIndex,
    current,
    isOpen,
    isDone: closed,
    questionsDone,
    addBatch,
    navigateTo,
    setAnswer,
    saveCurrent,
    close,
    getAllAnswers,
    getQuestionsState,
  };
}
