import { create } from "zustand";

type State = {
  deletedList: string[];
};

type Action = {
  // eslint-disable-next-line no-unused-vars
  delete: (id: string) => void;
};

export const useMessageStore = create<State & Action>((set) => ({
  deletedList: [],

  delete: (id) =>
    set((state) => {
      return {
        deletedList: [...state.deletedList, id],
      };
    }),
}));
