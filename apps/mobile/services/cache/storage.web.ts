import { createMemoryStorage } from '../storage/memory';
// Match the ephemeral session: don't leave orphaned GPS snapshots in the browser.
export const snapshotStorage = createMemoryStorage();
