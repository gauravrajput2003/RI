import {AxiosError,type InternalAxiosRequestConfig} from 'axios';
import {expect,it} from 'vitest';
import {apiErrorMessage} from './error-message';

function failure(url:string,status:number){const config={url} as InternalAxiosRequestConfig;return new AxiosError('Rejected','ERR_BAD_REQUEST',config,undefined,{status,statusText:'Error',headers:{},config,data:{}})}
it('distinguishes live credential failures, demo credential failures, and expired sessions',()=>{
 expect(apiErrorMessage(failure('/auth/login',401))).toContain('Incorrect username or password');
 expect(apiErrorMessage(failure('/auth/login',401),true)).toContain('Demo mode only accepts demo credentials');
 expect(apiErrorMessage(failure('/vehicles',401))).toBe('Your session expired. Please sign in again.');
 expect(apiErrorMessage(failure('/auth/login',400))).toContain('at least 8 characters');
});
it('keeps connectivity and rate-limit failures separate from credential failures',()=>{
 expect(apiErrorMessage(new AxiosError('Network unavailable','ERR_NETWORK'))).toContain('Unable to connect');
 expect(apiErrorMessage(failure('/auth/login',429))).toContain('Too many requests');
});
