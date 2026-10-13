import {identity,json,cookieClear} from "../_auth.js";
export async function onRequestGet({request,env}){const user=await identity(request,env);return json({authenticated:!!user,email:user?.email||null});}
export async function onRequestDelete(){return json({ok:true},{headers:{"Set-Cookie":cookieClear()}});}
