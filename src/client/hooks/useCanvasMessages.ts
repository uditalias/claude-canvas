import { useCallback, useRef } from "react";
import type { Canvas, FabricObject } from "fabric";
import type { WsMessage, DrawPayload, DrawCommand, AskPayload, Question, Answer } from "../lib/protocol";
import type { QuestionState } from "./useQuestionPanel";
import type { NarrationHandle } from "../components/Narration";

interface UseCanvasMessagesOpts {
  renderCommands: (cmds: DrawCommand[]) => FabricObject[];
  clear: () => void;
  clearLayer: (layer: string) => void;
  takeScreenshot: () => string;
  autopan: (objects: FabricObject[]) => void;
  getCanvas: () => Canvas | null;
  exportSVG: (labels?: boolean) => string;
  exportPNG: (labels?: boolean) => string;
  exportJSON: () => string;
  onAskBatch?: (batch: { question: Question; canvasJson: object }[]) => void;
  getAllAnswers?: () => Answer[];
  getQuestionsState?: () => QuestionState[];
  narrationRef: React.RefObject<NarrationHandle | null>;
  sendRef: React.RefObject<((msg: object) => void) | undefined>;
}

export function useCanvasMessages(opts: UseCanvasMessagesOpts) {
  const {
    renderCommands,
    clear,
    clearLayer,
    takeScreenshot,
    autopan,
    getCanvas,
    exportSVG,
    exportPNG,
    exportJSON,
    onAskBatch,
    getAllAnswers,
    getQuestionsState,
    narrationRef,
    sendRef,
  } = opts;

  const getAllAnswersRef = useRef(getAllAnswers);
  getAllAnswersRef.current = getAllAnswers;
  const getQuestionsStateRef = useRef(getQuestionsState);
  getQuestionsStateRef.current = getQuestionsState;

  const handleScreenshotRequest = async () => {
    const canvas = getCanvas();
    if (!canvas) return;

    const mainImage = takeScreenshot();

    if (!getAllAnswersRef.current || !getQuestionsStateRef.current) {
      sendRef.current?.({ type: "screenshot_response", payload: { image: mainImage, answers: [] } });
      return;
    }

    const answers = getAllAnswersRef.current();
    const questionsState = getQuestionsStateRef.current();
    const processedAnswers: Answer[] = [];

    // Save current canvas state
    const currentJson = canvas.toJSON();

    for (const a of answers) {
      const qs = questionsState.find((q) => q.question.id === a.questionId);
      if (qs && qs.question.type === "canvas") {
        await canvas.loadFromJSON(qs.canvasJson);
        canvas.requestRenderAll();
        const snapshot = takeScreenshot();
        processedAnswers.push({ ...a, canvasSnapshot: snapshot });
      } else {
        processedAnswers.push(a);
      }
    }

    // Restore original canvas
    await canvas.loadFromJSON(currentJson);
    canvas.requestRenderAll();

    sendRef.current?.({
      type: "screenshot_response",
      payload: { image: mainImage, answers: processedAnswers },
    });
  };

  const submitAnswers = useCallback(async () => {
    const canvas = getCanvas();
    if (!canvas) return;

    const mainImage = takeScreenshot();

    if (!getAllAnswersRef.current || !getQuestionsStateRef.current) {
      sendRef.current?.({ type: "answers_submitted", payload: { image: mainImage, answers: [] } });
      return;
    }

    const answers = getAllAnswersRef.current();
    const questionsState = getQuestionsStateRef.current();
    const processedAnswers: Answer[] = [];

    const currentJson = canvas.toJSON();

    for (const a of answers) {
      const qs = questionsState.find((q) => q.question.id === a.questionId);
      if (qs && qs.question.type === "canvas") {
        await canvas.loadFromJSON(qs.canvasJson);
        canvas.requestRenderAll();
        const snapshot = takeScreenshot();
        processedAnswers.push({ ...a, canvasSnapshot: snapshot });
      } else {
        processedAnswers.push(a);
      }
    }

    await canvas.loadFromJSON(currentJson);
    canvas.requestRenderAll();

    sendRef.current?.({
      type: "answers_submitted",
      payload: { image: mainImage, answers: processedAnswers },
    });
  }, [getCanvas, takeScreenshot]);

  const handleMessage = useCallback(
    (msg: WsMessage) => {
      if (msg.type === "draw") {
        const payload = msg.payload as DrawPayload;
        if (payload?.narration) narrationRef.current?.animateText(payload.narration);
        if (payload?.commands) {
          const added = renderCommands(payload.commands);
          autopan(added);
        }
      } else if (msg.type === "ask") {
        const askPayload = msg.payload as AskPayload;
        if (askPayload?.questions && onAskBatch) {
          const canvas = getCanvas();
          if (!canvas) return;
          const batch: { question: Question; canvasJson: object }[] = [];
          for (const q of askPayload.questions) {
            clear();
            if (q.commands) renderCommands(q.commands);
            // Make all objects interactive for Q&A
            canvas.forEachObject((obj) => {
              obj.set({ selectable: true, evented: true });
            });
            canvas.requestRenderAll();
            batch.push({ question: q, canvasJson: canvas.toJSON() });
          }
          // Restore Q1's canvas
          if (batch.length > 0) {
            canvas.loadFromJSON(batch[0].canvasJson).then(() => canvas.requestRenderAll());
          }
          onAskBatch(batch);
        }
      } else if (msg.type === "clear") {
        const layer = msg.payload as string | null;
        if (layer) {
          clearLayer(layer);
        } else {
          clear();
        }
      } else if (msg.type === "export_request") {
        const exportPayload = msg.payload as { format: string; labels: boolean };
        if (exportPayload) {
          let data: string;
          if (exportPayload.format === "json") {
            data = exportJSON();
          } else if (exportPayload.format === "svg") {
            data = exportSVG(exportPayload.labels);
          } else {
            data = exportPNG(exportPayload.labels);
          }
          sendRef.current?.({ type: "export_response", payload: data });
        }
      } else if (msg.type === "screenshot_request") {
        void handleScreenshotRequest();
      }
    },
    [renderCommands, clear, clearLayer, takeScreenshot, autopan, getCanvas, getAllAnswers, getQuestionsState, onAskBatch, exportSVG, exportPNG, exportJSON]
  );

  return { handleMessage, submitAnswers };
}
