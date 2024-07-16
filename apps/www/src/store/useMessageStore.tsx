/* eslint no-unused-vars: 0 */

import {
  ReceivedMessagesResult,
  SentMessageResult,
} from "@/app/(profile)/inbox/queries";
import { create } from "zustand";

type State = {
  deletedList: string[];
  receivedList: ReceivedMessagesResult;
  sentList: SentMessageResult;
};

type Action = {
  delete: (id: string) => void;
  updateReceivedList: (list: ReceivedMessagesResult) => void;
  updateSentList: (list: SentMessageResult) => void;
};

export const useMessageStore = create<State & Action>((set) => ({
  deletedList: [],
  receivedList: [],
  sentList: [],

  delete: (id) =>
    set((state) => {
      return {
        deletedList: [...state.deletedList, id],
      };
    }),

  updateReceivedList: (list) =>
    set((state) => {
      return {
        receivedList: [...state.receivedList, ...list],
      };
    }),

  updateSentList: (list) =>
    set((state) => {
      return {
        sentList: [...state.sentList, ...list],
      };
    }),
}));
