import { create } from 'zustand';
export const useVehicleStore = create<{
  selectedVehicleId: string | null; followSelected: boolean;
  setSelected(id: string | null): void; setFollow(value: boolean): void;
}>(set => ({
  selectedVehicleId: null, followSelected: true,
  setSelected: id => set({ selectedVehicleId: id, followSelected: true }),
  setFollow: value => set({ followSelected: value }),
}));
