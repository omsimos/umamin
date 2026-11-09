import { useCallback, useLayoutEffect, useRef } from "react";

function updateTextAreaSize(textArea?: HTMLTextAreaElement | null) {
  if (!textArea) return;
  textArea.style.height = "3rem";
  // scrollHeight leaves out the border, and border-box heights include it, so
  // without it a bordered textarea always overflows and shows a scrollbar.
  const border = textArea.offsetHeight - textArea.clientHeight;
  textArea.style.height = `${textArea.scrollHeight + border}px`;
}

export function useDynamicTextarea(content: string) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const inputRef = useCallback((textArea: HTMLTextAreaElement | null) => {
    textAreaRef.current = textArea;
    updateTextAreaSize(textArea);
  }, []);

  // Updates height only when content changes.
  useLayoutEffect(() => {
    updateTextAreaSize(textAreaRef.current);
  }, [content]);

  return inputRef;
}
