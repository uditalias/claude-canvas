import { forwardRef, useImperativeHandle, useState, useRef, useCallback } from "react";

export interface NarrationHandle {
  show: (text: string) => void;
  animateText: (text: string) => void;
}

export const Narration = forwardRef<NarrationHandle>(function Narration(_props, ref) {
  const [displayText, setDisplayText] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const animFrameRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const cancelAnimation = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animFrameRef.current) clearTimeout(animFrameRef.current);
  }, []);

  const show = useCallback(
    (text: string) => {
      cancelAnimation();
      setDisplayText(text);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), 4000);
    },
    [cancelAnimation]
  );

  const animateText = useCallback(
    (fullText: string) => {
      cancelAnimation();
      setDisplayText("");
      setVisible(true);

      let i = 0;
      function nextChar() {
        if (i >= fullText.length) {
          timerRef.current = setTimeout(() => setVisible(false), 2000);
          return;
        }
        i++;
        setDisplayText(fullText.slice(0, i));
        animFrameRef.current = setTimeout(nextChar, 30);
      }
      nextChar();
    },
    [cancelAnimation]
  );

  useImperativeHandle(ref, () => ({ show, animateText }), [show, animateText]);

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 text-white px-5 py-2.5 rounded-full text-[15px] max-w-[600px] text-center pointer-events-none z-[200] transition-opacity duration-400"
      style={{
        background: "rgba(181, 101, 29, 0.9)",
        fontFamily: "'Poppins', sans-serif",
        opacity: visible ? 1 : 0,
      }}
    >
      {displayText}
    </div>
  );
});
