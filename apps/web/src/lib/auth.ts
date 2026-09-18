import type {Role,Tokens} from '../types';
const key='fleet.web.session';let memory:Tokens|null=null;
export function getTokens(){if(memory)return memory;try{memory=JSON.parse(sessionStorage.getItem(key)||'null')}catch{memory=null}return memory}
export function setTokens(tokens:Tokens|null){memory=tokens;if(tokens)sessionStorage.setItem(key,JSON.stringify(tokens));else sessionStorage.removeItem(key);window.dispatchEvent(new Event('fleet-session'))}
export function claims():{id:string;role:Role}|null{const token=getTokens()?.accessToken;if(!token)return null;try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}}
