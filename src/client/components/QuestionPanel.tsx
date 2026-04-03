import { Button } from "./ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { QuestionState } from "../hooks/useQuestionPanel";

interface QuestionPanelProps {
  current: QuestionState;
  currentIndex: number;
  total: number;
  allAnswered: boolean;
  showDone: boolean;
  onNavigate: (index: number) => void;
  onAnswer: (value: string | string[]) => void;
  onDone: () => void;
}

function SingleSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          className={`rounded-lg border px-4 py-2 text-sm transition-all ${
            value === option
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background border-border hover:bg-accent hover:border-accent-foreground/20"
          }`}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          className={`rounded-lg border px-4 py-2 text-sm transition-all ${
            value.includes(option)
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background border-border hover:bg-accent hover:border-accent-foreground/20"
          }`}
          onClick={() => toggle(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function TextAnswer({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
      placeholder="Type your answer..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function QuestionPanel({
  current,
  currentIndex,
  total,
  allAnswered,
  showDone,
  onNavigate,
  onAnswer,
  onDone,
}: QuestionPanelProps) {
  const { question, answer } = current;

  const renderAnswer = () => {
    switch (question.type) {
      case "single":
        return (
          <SingleSelect
            options={question.options ?? []}
            value={typeof answer?.value === "string" ? answer.value : ""}
            onChange={(v) => onAnswer(v)}
          />
        );
      case "multi":
        return (
          <MultiSelect
            options={question.options ?? []}
            value={Array.isArray(answer?.value) ? answer.value : []}
            onChange={(v) => onAnswer(v)}
          />
        );
      case "text":
        return (
          <TextAnswer
            value={typeof answer?.value === "string" ? answer.value : ""}
            onChange={(v) => onAnswer(v)}
          />
        );
      case "canvas":
        return (
          <p className="text-sm italic text-muted-foreground">
            Draw your answer on the canvas above.
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-sm shadow-lg">
        {/* Question row */}
        <div className="flex items-center gap-3 px-5 py-3.5">
          <div className="flex-1 text-sm font-medium">{question.text}</div>
          <div className="flex items-center gap-1 shrink-0">
            {total > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentIndex === 0}
                  onClick={() => onNavigate(currentIndex - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {currentIndex + 1}/{total}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentIndex === total - 1}
                  onClick={() => onNavigate(currentIndex + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {showDone && (
              <Button
                size="icon"
                className="h-8 w-8 rounded-lg ml-1"
                onClick={onDone}
                disabled={!allAnswered}
                title={allAnswered ? "Submit answers" : "Answer all questions first"}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Answer area */}
        <div className="border-t border-border px-5 py-3">
          {renderAnswer()}
        </div>
      </div>
    </div>
  );
}
