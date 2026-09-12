import { api } from './client';
import { useAuthStore } from '../../store/authStore';
import { createAuthActions } from './auth-actions';
export const { login, logout } = createAuthActions(api, useAuthStore);
