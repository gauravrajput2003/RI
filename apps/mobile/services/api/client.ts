import {apiErrorMessage} from './error-message';
import { config } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { createApiClient } from './create-client';
import { createDemoAdapter } from '../../features/demo/adapter';
export const api = createApiClient(
  config.apiUrl,
  useAuthStore,
  config.demoMode ? createDemoAdapter() : undefined
);
export const apiError = (error: unknown) => apiErrorMessage(error,config.demoMode);
