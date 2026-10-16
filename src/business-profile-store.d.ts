export {};
declare global {
  interface Window {
    KitchAIBusinessProfileStore?: {
      read: () => { name: string; type: string; currency: string; updatedAt: string } | null;
      save: (input: { name: string; type: string; currency: string }) => { name: string; type: string; currency: string; updatedAt: string };
      clear: () => void;
    };
  }
}
