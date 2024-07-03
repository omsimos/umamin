import { create } from "zustand";
import { CurrentNoteQueryResult } from "@/app/notes/queries";

type NoteData = Partial<CurrentNoteQueryResult> | null;

type State = {
  note: NoteData;
  isCleared: boolean;
};

type Action = {
  // eslint-disable-next-line no-unused-vars
  update: (data: NoteData) => void;
  clear: () => void;
};

export const useNoteStore = create<State & Action>((set) => ({
  note: null,
  isCleared: false,

  clear: () => set({ note: null, isCleared: true }),

  update: (data) =>
    set({
      note: data,
      isCleared: false,
    }),
}));
