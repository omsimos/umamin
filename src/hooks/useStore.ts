/* eslint-disable no-unused-vars */
import create from 'zustand';

interface Store {
  currentUser: string | null;
  setCurrentUser: (currentUser: string | null) => void;
}

const useStore = create<Store>((set) => ({
  currentUser: null,
  setCurrentUser: (currentUser) => set(() => ({ currentUser })),
}));

export default useStore;
