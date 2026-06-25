export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8787'
export const STORAGE_MODE = (import.meta.env.VITE_STORAGE_MODE as 'server' | 'local') ?? 'server'
export const DEFAULT_TOP_K = Number((import.meta.env.VITE_TOP_K as string | undefined) ?? '8')
