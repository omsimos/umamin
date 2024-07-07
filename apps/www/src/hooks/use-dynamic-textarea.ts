import { useEffect, useRef, RefCallback } from "react";

function updateTextAreaSize(textArea?: HTMLTextAreaElement | null) {
  if (textArea == null) return;
  textArea.style.height = "3rem";
  textArea.style.height = `${textArea.scrollHeight}px`;
}

export function useDynamicTextarea(
  content: string
): RefCallback<HTMLTextAreaElement> {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const inputRef = (textArea: HTMLTextAreaElement) => {
    updateTextAreaSize(textArea);
    textAreaRef.current = textArea;
  };

  useEffect(() => {
    updateTextAreaSize(textAreaRef.current);
  }, [content]);

  return inputRef;
}
