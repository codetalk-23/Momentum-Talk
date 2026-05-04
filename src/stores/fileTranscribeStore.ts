import { create } from "zustand";

interface FileTranscribeStore {
  filePath: string | null;
  fileName: string | null;
  streamText: string;
  result: string | null;

  setFile: (path: string, name: string) => void;
  setStreamText: (text: string) => void;
  setResult: (text: string | null) => void;
  reset: () => void;
}

export const useFileTranscribeStore = create<FileTranscribeStore>()((set) => ({
  filePath: null,
  fileName: null,
  streamText: "",
  result: null,

  setFile: (path, name) => set({ filePath: path, fileName: name }),
  setStreamText: (text) => set({ streamText: text }),
  setResult: (text) => set({ result: text }),
  reset: () => set({ filePath: null, fileName: null, streamText: "", result: null }),
}));
