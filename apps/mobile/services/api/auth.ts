import {tokenStorage} from '../storage/tokens';
async function getDeviceId(){const key='fleet.login.device';let id=await tokenStorage.getItem(key);if(!id){id=`mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;await tokenStorage.setItem(key,id)}return id}
import { api } from './client';
import { useAuthStore } from '../../store/authStore';
import { createAuthActions } from './auth-actions';
export const { login, logout } = createAuthActions(api, useAuthStore, getDeviceId);
