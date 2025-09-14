import { useCallback, useLayoutEffect, useRef } from "react";

function updateTextAreaSize(textArea?: HTMLTextAreaElement | null) {
  if (!textArea) return;
  textArea.style.height = "3rem";
  textArea.style.height = `${textArea.scrollHeight}px`;
}

export function useDynamicTextarea(content: string) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const inputRef = useCallback((textArea: HTMLTextAreaElement | null) => {
    textAreaRef.current = textArea;
    updateTextAreaSize(textArea);
  }, []);

  useLayoutEffect(() => {
    updateTextAreaSize(textAreaRef.current);
  }, [content]);

  return inputRef;
}
