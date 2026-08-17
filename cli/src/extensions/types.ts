export interface ZerfExtensionManifest {
  name: string
  version: string
  description: string
  author?: string
  commands?: Array<{ cmd: string; description: string }>
  hooks?: string[]
  permissions?: string[]
  entrypoint?: string
}

export interface ZerfExtensionContext {
  api: {
    getTasks(): Promise<any[]>
    createTask(title: string, opts?: any): Promise<any>
    getNotes(): Promise<any[]>
    createNote(title: string, body: string): Promise<any>
  }
  log: {
    info(msg: string): void
    success(msg: string): void
    error(msg: string): void
  }
  config: {
    get(key: string): any
    set(key: string, value: any): void
  }
}

export interface ZerfExtension {
  manifest: ZerfExtensionManifest
  onLoad?(ctx: ZerfExtensionContext): Promise<void>
  onCommand?(cmd: string, args: string[], ctx: ZerfExtensionContext): Promise<void>
  onHook?(event: string, data: any, ctx: ZerfExtensionContext): Promise<void>
}
