import { forwardRef, useImperativeHandle, useState, useRef, useCallback } from "react";

export interface NarrationHandle {
  show: (text: string) => void;
}

export const Narration = forwardRef<NarrationHandle>(function Narration(_props, ref) {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback((newText: string) => {
    setText(newText);
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 4000);
  }, []);

  useImperativeHandle(ref, () => ({ show }), [show]);

  return (
    <div
      className="fixed bottom-8 left-1/2 -translate-x-1/2 text-white px-5 py-2.5 rounded-full text-[15px] max-w-[600px] text-center pointer-events-none z-[200] transition-opacity duration-400"
      style={{
        background: "rgba(181, 101, 29, 0.9)",
        fontFamily: "'Patrick Hand', cursive",
        opacity: visible ? 1 : 0,
      }}
    >
      {text}
    </div>
  );
});
