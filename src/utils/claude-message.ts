import { LocalStorage } from "@raycast/api";
import { createHash } from "crypto";
import { createReadStream } from "fs";
import { readFile, readdir, stat } from "fs/promises";
import { basename, join } from "path";
import { createInterface } from "readline";
import {
  CLAUDE_DIR,
  ContentItem,
  HIGH_WATER_MARK,
  JSONLEntry,
  MAX_LINE_LENGTH,
  MESSAGE_CONCURRENCY,
  MESSAGE_FILE_LIMIT,
  readCwdFromJsonl,
  runWithConcurrency,
  sanitizeText,
  truncate,
} from "./claude-shared";

const SNIPPETS_KEY = "claude-messages-snippets";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  sessionId: string;
  projectPath: string;
  projectName: string;
  fileName?: string;
  projectDir: string;
  fullPath: string;
};

export type ParsedMessage = Message & {
  id: string;
  preview: string;
};

const UNIX_TIMESTAMP_THRESHOLD = 10000000000; // Timestamps below this are in seconds, not milliseconds

const TEAMMATE_MESSAGE_TAG = "<teammate-message";
const TEAMMATE_RELAY_PREFIX = "Another Claude session sent a message:";

// Agent-team coordination traffic is machine-generated relay, not conversation. Matched only at the
// start so context-continuation summaries that merely quote the tag are kept.
function isTeammateMessage(content: string): boolean {
  const trimmed = content.trimStart();
  if (trimmed.startsWith(TEAMMATE_MESSAGE_TAG)) return true;
  return (
    trimmed.startsWith(TEAMMATE_RELAY_PREFIX) &&
    trimmed.slice(TEAMMATE_RELAY_PREFIX.length).trimStart().startsWith(TEAMMATE_MESSAGE_TAG)
  );
}

async function resolveProjectPath(projectDir: string, jsonlFiles: string[]): Promise<{ path: string; name: string }> {
  const dirPath = join(CLAUDE_DIR, projectDir);

  // 1. Try sessions-index.json (has originalPath at root level)
  try {
    const content = await readFile(join(dirPath, "sessions-index.json"), "utf8");
    const index = JSON.parse(content);
    const realPath = index.originalPath || index.entries?.[0]?.projectPath;
    if (realPath) {
      const name = basename(realPath);
      if (name) return { path: realPath, name };
    }
  } catch {
    // Try next source
  }

  // 2. Try cwd field from first JSONL file
  if (jsonlFiles.length > 0) {
    const cwd = await readCwdFromJsonl(join(dirPath, jsonlFiles[0]));
    if (cwd) {
      const name = basename(cwd);
      if (name) return { path: cwd, name };
    }
  }

  // 3. Fallback: use the storage directory path and raw directory name
  return { path: dirPath, name: projectDir };
}

/**
 * Extracts path information from project and file paths
 */
function extractPathInformation(projectPath: string, filePath: string) {
  return {
    fileName: filePath
      .split("/")
      .filter((f) => f)
      .pop(),
    projectDir: projectPath,
    fullPath: filePath,
  };
}

/**
 * Convert Unix timestamp (seconds) to JavaScript Date object
 * Handles both seconds and milliseconds timestamps
 */
function parseTimestamp(timestamp: string | number | undefined): Date {
  if (!timestamp) return new Date();

  if (typeof timestamp === "number") {
    // If timestamp is in seconds (< threshold), convert to milliseconds
    return new Date(timestamp < UNIX_TIMESTAMP_THRESHOLD ? timestamp * 1000 : timestamp);
  }

  // String timestamp - let Date constructor handle it
  return new Date(timestamp);
}

/**
 * Memory-efficient streaming parser for user messages only
 * Reads JSONL files line-by-line instead of loading entire file into memory
 * This prevents out-of-memory crashes with large conversation files
 */
async function parseUserMessagesOnlyStreaming(
  filePath: string,
  sessionId: string,
  projectPath: string,
  projectName: string,
): Promise<Message[]> {
  return new Promise((resolve) => {
    const userMessages: Message[] = [];
    let fileStream: ReturnType<typeof createReadStream> | null = null;
    let rl: ReturnType<typeof createInterface> | null = null;

    // Clean up resources to prevent memory leaks
    const cleanup = () => {
      try {
        if (rl) {
          rl.close();
          rl.removeAllListeners();
          rl = null;
        }
        if (fileStream) {
          fileStream.destroy();
          fileStream = null;
        }
      } catch {
        // Ignore cleanup errors
      }
    };

    try {
      fileStream = createReadStream(filePath, { highWaterMark: HIGH_WATER_MARK });

      rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
        terminal: false,
      });

      rl.on("line", (line: string) => {
        try {
          if (!line.trim()) return;
          if (line.length > MAX_LINE_LENGTH) return;
          if (!line.includes('"role":"user"') && !line.includes('"role": "user"')) return;
          if (line.includes('"tool_result"')) return;

          const data: JSONLEntry = JSON.parse(line);

          if (data.message && data.message.role === "user") {
            let content = "";

            if (data.message.content) {
              if (typeof data.message.content === "string") {
                content = data.message.content;
              } else if (Array.isArray(data.message.content)) {
                content = data.message.content
                  .filter((item: ContentItem) => item.type === "text")
                  .map((item: ContentItem) => item.text || "")
                  .join("\n");
              }
            }

            if (content && content.trim() && !isTeammateMessage(content)) {
              const timestamp = parseTimestamp(data.timestamp);
              const pathInfo = extractPathInformation(projectPath, filePath);

              userMessages.push({
                role: "user",
                content: truncate(sanitizeText(content), 200, ""),
                timestamp,
                sessionId,
                projectPath,
                projectName,
                ...pathInfo,
              });
            }
          }
        } catch {
          // Skip invalid JSON
        }
      });

      rl.on("close", () => {
        cleanup();
        resolve(userMessages);
      });

      rl.on("error", () => {
        cleanup();
        resolve([]);
      });

      fileStream.on("error", () => {
        cleanup();
        resolve([]);
      });
    } catch {
      cleanup();
      resolve([]);
    }
  });
}

async function parseAssistantMessagesOnlyStreaming(
  filePath: string,
  sessionId: string,
  projectPath: string,
  projectName: string,
): Promise<Message[]> {
  return new Promise((resolve) => {
    const assistantMessages: Message[] = [];
    let fileStream: ReturnType<typeof createReadStream> | null = null;
    let rl: ReturnType<typeof createInterface> | null = null;

    const cleanup = () => {
      try {
        if (rl) {
          rl.close();
          rl.removeAllListeners();
          rl = null;
        }
        if (fileStream) {
          fileStream.destroy();
          fileStream = null;
        }
      } catch {
        // Ignore cleanup errors
      }
    };

    try {
      fileStream = createReadStream(filePath, { highWaterMark: HIGH_WATER_MARK });
      rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
        terminal: false,
      });

      rl.on("line", (line: string) => {
        try {
          if (!line.trim()) return;
          if (line.length > MAX_LINE_LENGTH) return;
          if (!line.includes('"role":"assistant"') && !line.includes('"role": "assistant"')) return;

          const data: JSONLEntry = JSON.parse(line);

          if (data.message && data.message.role === "assistant") {
            let content: string | null = "";

            if (data.message.content !== undefined) {
              if (data.message.content === null) {
                content = null;
              } else if (typeof data.message.content === "string") {
                content = data.message.content;
              } else if (Array.isArray(data.message.content)) {
                content = data.message.content
                  .filter((item: ContentItem) => item.type === "text")
                  .map((item: ContentItem) => item.text || "")
                  .join("\n");
              }
            }

            const timestamp = parseTimestamp(data.timestamp);
            const pathInfo = extractPathInformation(projectPath, filePath);

            if (content === null) {
              assistantMessages.push({
                role: "assistant",
                content: "",
                timestamp,
                sessionId,
                projectPath,
                projectName,
                ...pathInfo,
              });
            } else if (content && !isTeammateMessage(content)) {
              assistantMessages.push({
                role: "assistant",
                content: truncate(sanitizeText(content), 200, ""),
                timestamp,
                sessionId,
                projectPath,
                projectName,
                ...pathInfo,
              });
            }
          }
        } catch {
          // Skip invalid JSON
        }
      });

      rl.on("close", () => {
        cleanup();
        resolve(assistantMessages);
      });

      rl.on("error", () => {
        cleanup();
        resolve([]);
      });

      fileStream.on("error", () => {
        cleanup();
        resolve([]);
      });
    } catch {
      cleanup();
      resolve([]);
    }
  });
}

type FileEntry = {
  path: string;
  name: string;
  projectPath: string;
  projectName: string;
  mtime: number;
};

async function collectRecentFiles(): Promise<FileEntry[]> {
  const projects = await readdir(CLAUDE_DIR);
  const files: FileEntry[] = [];

  for (const project of projects) {
    try {
      const projectDirPath = join(CLAUDE_DIR, project);
      const projectStat = await stat(projectDirPath);
      if (!projectStat.isDirectory()) continue;

      const entries = await readdir(projectDirPath);
      const jsonlFiles = entries.filter((f) => f.endsWith(".jsonl"));
      if (jsonlFiles.length === 0) continue;

      const resolved = await resolveProjectPath(project, jsonlFiles);
      if (!resolved.name || resolved.name === "-" || resolved.name.length <= 1) continue;

      for (const file of jsonlFiles) {
        try {
          const filePath = join(projectDirPath, file);
          const fileStat = await stat(filePath);
          files.push({
            path: filePath,
            name: file,
            projectPath: resolved.path,
            projectName: resolved.name,
            mtime: fileStat.mtimeMs,
          });
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files.slice(0, MESSAGE_FILE_LIMIT);
}

export async function getAllClaudeMessages(): Promise<Message[]> {
  try {
    const recentFiles = await collectRecentFiles();

    const allMessages: Message[] = [];

    await runWithConcurrency(
      recentFiles,
      async (file) => {
        try {
          const sessionId = file.name.replace(".jsonl", "");
          const messages = await parseAssistantMessagesOnlyStreaming(
            file.path,
            sessionId,
            file.projectPath,
            file.projectName,
          );
          allMessages.push(...messages);
        } catch {
          // skip
        }
      },
      MESSAGE_CONCURRENCY,
    );

    return allMessages
      .filter((msg) => msg.role === "assistant")
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  } catch {
    return [];
  }
}

/**
 * Gets the most recent user messages (messages sent TO Claude) across all projects
 * Uses memory-efficient streaming to avoid crashes with large conversation histories
 */
export async function getSentMessages(): Promise<ParsedMessage[]> {
  try {
    const recentFiles = await collectRecentFiles();

    const allUserMessages: Message[] = [];

    await runWithConcurrency(
      recentFiles,
      async (file) => {
        try {
          const sessionId = file.name.replace(".jsonl", "");
          const userMessages = await parseUserMessagesOnlyStreaming(
            file.path,
            sessionId,
            file.projectPath,
            file.projectName,
          );
          allUserMessages.push(...userMessages);
        } catch {
          // skip
        }
      },
      MESSAGE_CONCURRENCY,
    );

    const finalMessages = allUserMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return finalMessages.map((msg, index) => ({
      ...msg,
      id: `sent-${index}`,
      preview: truncate(msg.content, 100),
    }));
  } catch {
    return [];
  }
}

export async function loadMessageContent(
  filePath: string,
  timestamp: Date,
  role: "user" | "assistant",
  contentPrefix: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    let fileStream: ReturnType<typeof createReadStream> | null = null;
    let rl: ReturnType<typeof createInterface> | null = null;
    let resolved = false;

    const done = (value: string | null) => {
      if (resolved) return;
      resolved = true;
      try {
        if (rl) {
          rl.close();
          rl.removeAllListeners();
          rl = null;
        }
        if (fileStream) {
          fileStream.destroy();
          fileStream = null;
        }
      } catch {
        // Ignore cleanup errors
      }
      resolve(value);
    };

    try {
      fileStream = createReadStream(filePath, { highWaterMark: HIGH_WATER_MARK });
      rl = createInterface({
        input: fileStream,
        crlfDelay: Infinity,
        terminal: false,
      });

      const targetTime = timestamp.getTime();

      const roleStr = `"role":"${role}"`;
      const roleStrSpaced = `"role": "${role}"`;

      rl.on("line", (line: string) => {
        if (resolved) return;
        try {
          if (!line.trim()) return;
          if (line.length > MAX_LINE_LENGTH) return;
          if (!line.includes(roleStr) && !line.includes(roleStrSpaced)) return;

          const data: JSONLEntry = JSON.parse(line);

          if (data.message && data.message.role === role) {
            const lineTime = parseTimestamp(data.timestamp).getTime();
            if (Math.abs(lineTime - targetTime) <= 1000) {
              let content = "";
              if (data.message.content) {
                if (typeof data.message.content === "string") {
                  content = data.message.content;
                } else if (Array.isArray(data.message.content)) {
                  content = data.message.content
                    .filter((item: ContentItem) => item.type === "text")
                    .map((item: ContentItem) => item.text || "")
                    .join("\n");
                }
              }
              const safe = sanitizeText(content);
              if (safe.startsWith(contentPrefix)) {
                done(safe);
              }
            }
          }
        } catch {
          // Skip invalid JSON
        }
      });

      rl.on("close", () => done(null));
      rl.on("error", () => done(null));
      fileStream.on("error", () => done(null));
    } catch {
      done(null);
    }
  });
}

export async function getReceivedMessages(): Promise<ParsedMessage[]> {
  const allMessages = await getAllClaudeMessages();

  const parsedMessages = allMessages.map((msg, index) => {
    const preview = msg.content ? truncate(msg.content, 100) : "[Empty message]";
    return {
      ...msg,
      id: `received-${index}`,
      preview: preview,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
    };
  });

  return parsedMessages;
}

export type Snippet = {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Get all snippets from LocalStorage
 */
export async function getSnippets(): Promise<Snippet[]> {
  try {
    const snippetsData = await LocalStorage.getItem<string>(SNIPPETS_KEY);
    if (!snippetsData) return [];

    const snippets: Snippet[] = JSON.parse(snippetsData);
    return snippets.map((snippet) => ({
      ...snippet,
      createdAt: new Date(snippet.createdAt),
      updatedAt: new Date(snippet.updatedAt),
    }));
  } catch {
    return [];
  }
}

/**
 * Create a new snippet
 */
export async function createSnippet(title: string, content: string): Promise<Snippet> {
  try {
    const snippetsData = await LocalStorage.getItem<string>(SNIPPETS_KEY);
    let snippets: Snippet[] = [];

    // Handle JSON parse errors gracefully
    if (snippetsData) {
      try {
        snippets = JSON.parse(snippetsData);
      } catch {
        snippets = [];
      }
    }

    const newSnippet: Snippet = {
      id: createHash("md5").update(`${title}-${content}-${Date.now()}`).digest("hex"),
      title,
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    snippets.push(newSnippet);
    await LocalStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets));

    return newSnippet;
  } catch {
    throw new Error("Failed to create snippet");
  }
}

/**
 * Delete a snippet
 */
export async function deleteSnippet(id: string): Promise<void> {
  try {
    const snippetsData = await LocalStorage.getItem<string>(SNIPPETS_KEY);
    if (!snippetsData) return;

    let snippets: Snippet[] = JSON.parse(snippetsData);
    snippets = snippets.filter((s) => s.id !== id);

    await LocalStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets));
  } catch {
    throw new Error("Failed to delete snippet");
  }
}
