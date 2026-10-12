import { contextBridge } from 'electron'

// API typée exposée au renderer (phase 4).
const api = {}

contextBridge.exposeInMainWorld('api', api)

export type ApiReCV = typeof api
