/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Claude CLI Path - Custom path to the Claude CLI binary (leave empty for auto-detection) */
  "claudeCliPath"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `create-snippet` command */
  export type CreateSnippet = ExtensionPreferences & {}
  /** Preferences accessible in the `browse-snippets` command */
  export type BrowseSnippets = ExtensionPreferences & {}
  /** Preferences accessible in the `received-messages` command */
  export type ReceivedMessages = ExtensionPreferences & {}
  /** Preferences accessible in the `sent-messages` command */
  export type SentMessages = ExtensionPreferences & {}
  /** Preferences accessible in the `cheatsheet` command */
  export type Cheatsheet = ExtensionPreferences & {}
  /** Preferences accessible in the `browse-agents` command */
  export type BrowseAgents = ExtensionPreferences & {}
  /** Preferences accessible in the `browse-commands` command */
  export type BrowseCommands = ExtensionPreferences & {}
  /** Preferences accessible in the `changelog` command */
  export type Changelog = ExtensionPreferences & {}
  /** Preferences accessible in the `changelog-monitor` command */
  export type ChangelogMonitor = ExtensionPreferences & {}
  /** Preferences accessible in the `search-sessions` command */
  export type SearchSessions = ExtensionPreferences & {}
  /** Preferences accessible in the `transform-selection` command */
  export type TransformSelection = ExtensionPreferences & {}
  /** Preferences accessible in the `chat` command */
  export type Chat = ExtensionPreferences & {}
  /** Preferences accessible in the `browse-skills` command */
  export type BrowseSkills = ExtensionPreferences & {}
  /** Preferences accessible in the `status` command */
  export type Status = ExtensionPreferences & {}
  /** Preferences accessible in the `usage-monitor` command */
  export type UsageMonitor = ExtensionPreferences & {}
  /** Preferences accessible in the `claude-usage` command */
  export type ClaudeUsage = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `create-snippet` command */
  export type CreateSnippet = {}
  /** Arguments passed to the `browse-snippets` command */
  export type BrowseSnippets = {}
  /** Arguments passed to the `received-messages` command */
  export type ReceivedMessages = {}
  /** Arguments passed to the `sent-messages` command */
  export type SentMessages = {}
  /** Arguments passed to the `cheatsheet` command */
  export type Cheatsheet = {}
  /** Arguments passed to the `browse-agents` command */
  export type BrowseAgents = {}
  /** Arguments passed to the `browse-commands` command */
  export type BrowseCommands = {}
  /** Arguments passed to the `changelog` command */
  export type Changelog = {}
  /** Arguments passed to the `changelog-monitor` command */
  export type ChangelogMonitor = {}
  /** Arguments passed to the `search-sessions` command */
  export type SearchSessions = {}
  /** Arguments passed to the `transform-selection` command */
  export type TransformSelection = {}
  /** Arguments passed to the `chat` command */
  export type Chat = {}
  /** Arguments passed to the `browse-skills` command */
  export type BrowseSkills = {}
  /** Arguments passed to the `status` command */
  export type Status = {}
  /** Arguments passed to the `usage-monitor` command */
  export type UsageMonitor = {}
  /** Arguments passed to the `claude-usage` command */
  export type ClaudeUsage = {}
}

