export type CommandInfo = {
  name: string
  description: string
  longDescription?: string
  usageExamples?: string[]
  options?: CommandOption[]
  subcommands?: CommandInfo[]
  category?: string
}

export interface CommandOption {
  name: string
  description: string
  type: string
  required: boolean
}

export interface CommandCategory {
  name: string
  description: string
  emoji?: string
}
