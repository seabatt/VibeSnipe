import { create } from 'zustand';
import { ScheduledBlock, Underlying } from '@/types';

const STORAGE_KEY = 'vibesnipe_schedule_blocks';

// Load blocks from localStorage or use empty array
const loadBlocks = (): ScheduledBlock[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load schedule blocks:', error);
  }
  return [];
};

// Save blocks to localStorage
const saveBlocks = (blocks: ScheduledBlock[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  } catch (error) {
    console.error('Failed to save schedule blocks:', error);
  }
};

interface ScheduleStore {
  blocks: ScheduledBlock[];
  currentBlock: ScheduledBlock | null;
  nextBlock: ScheduledBlock | null;
  activeUnderlying: Underlying | null;
  setActiveUnderlying: (underlying: Underlying | null) => void;
  getCurrentBlock: () => ScheduledBlock | null;
  getNextBlock: () => ScheduledBlock | null;
  setBlocks: (blocks: ScheduledBlock[]) => void;
}

export const useSchedule = create<ScheduleStore>((set, get) => ({
  blocks: loadBlocks(),
  currentBlock: null,
  nextBlock: null,
  activeUnderlying: null,
  setActiveUnderlying: (underlying) => set({ activeUnderlying: underlying }),
  setBlocks: (blocks) => {
    set({ blocks });
    saveBlocks(blocks);
  },
  getCurrentBlock: () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const blocks = get().blocks;
    const activeUnderlying = get().activeUnderlying;
    
    // Find the current block based on windowStart and windowEnd
    const current = blocks.find((block) => {
      if (activeUnderlying && block.underlying !== activeUnderlying) return false;
      return block.windowStart <= currentTime && currentTime <= block.windowEnd;
    });

    if (current) {
      set({ currentBlock: current });
      return current;
    }

    set({ currentBlock: null });
    return null;
  },
  getNextBlock: () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const blocks = get().blocks;
    const activeUnderlying = get().activeUnderlying;
    
    const next = blocks.find((block) => {
      if (activeUnderlying && block.underlying !== activeUnderlying) return false;
      return block.windowStart > currentTime;
    });

    set({ nextBlock: next || null });
    return next || null;
  },
}));
