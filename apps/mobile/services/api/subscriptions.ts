import { z } from 'zod';
import { api } from './client';

const subscriptions = z.array(z.object({
  id: z.string(), plan: z.string(), status: z.string(),
  starts_at: z.string().datetime({ offset: true }).nullable(),
  ends_at: z.string().datetime({ offset: true }).nullable(),
}));
export async function getSubscriptions(signal?: AbortSignal) {
  const response = await api.get('/subscriptions', { params: { limit: 100 }, signal });
  return subscriptions.parse(response.data.data);
}
