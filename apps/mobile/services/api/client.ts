import axios from 'axios';
import { config } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { createApiClient } from './create-client';
import { createDemoAdapter } from '../../features/demo/adapter';
export const api = createApiClient(
  config.apiUrl,
  useAuthStore,
  config.demoMode ? createDemoAdapter() : undefined
);
export const apiError = (error: unknown) => axios.isAxiosError(error)
  ? error.response?.status === 401 ? 'Sign-in failed or your session expired.'
    : error.response?.status === 429 ? 'Too many requests. Please try again shortly.'
    : !error.response ? 'Unable to connect. Check your network and try again.'
    : 'The request could not be completed.'
  : 'The request could not be completed.';
