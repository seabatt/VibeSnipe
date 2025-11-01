import { create } from 'zustand';
import { ScheduledBlock, Underlying } from '@/types';
import scheduleData from '@/lib/schedule.json';

interface ScheduleStore {
  blocks: ScheduledBlock[];
  currentBlock: ScheduledBlock | null;
  nextBlock: ScheduledBlock | null;
  activeUnderlying: Underlying | null;
  setActiveUnderlying: (underlying: Underlying | null) => void;
  getCurrentBlock: () => ScheduledBlock | null;
  getNextBlock: () => ScheduledBlock | null;
}

export const useSchedule = create<ScheduleStore>((set, get) => ({
  blocks: scheduleData as ScheduledBlock[],
  currentBlock: null,
  nextBlock: null,
  activeUnderlying: null,
  setActiveUnderlying: (underlying) => set({ activeUnderlying: underlying }),
  getCurrentBlock: () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const blocks = get().blocks;
    const activeUnderlying = get().activeUnderlying;
    
    // Find the current block
    const current = blocks.find((block) => {
      if (activeUnderlying && block.underlying !== activeUnderlying) return false;
      return block.time <= currentTime;
    });

    if (current) {
      // Check if we're within the 10-minute window
      const [blockHour, blockMin] = current.time.split(':').map(Number);
      const blockDate = new Date();
      blockDate.setHours(blockHour, blockMin, 0, 0);
      
      const blockEnd = new Date(blockDate.getTime() + 10 * 60 * 1000);
      
      if (now >= blockDate && now < blockEnd) {
        set({ currentBlock: current });
        return current;
      }
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
      return block.time > currentTime;
    });

    set({ nextBlock: next || null });
    return next || null;
  },
}));
