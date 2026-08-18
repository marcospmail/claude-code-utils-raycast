import { Action, ActionPanel, Color, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { PasteAction } from "../../components/paste-action";
import { sanitizeText, truncate } from "../../utils/claude-shared";
import { SessionSearchResult } from "../../utils/session-search";
import CreateSnippet from "../create-snippet/list";

const PAGE_SIZE = 50;

interface SessionDetailProps {
  session: SessionSearchResult;
}

type ContentItem = {
  type: string;
  text?: string;
};

type JSONLEntry = {
  message?: {
    role: "user" | "assistant";
    content: string | ContentItem[];
  };
};

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function extractText(content: string | ContentItem[]): string {
  if (typeof content === "string") return sanitizeText(content);
  if (Array.isArray(content)) {
    return sanitizeText(
      content
        .filter((item) => item.type === "text")
        .map((item) => item.text || "")
        .join("\n"),
    );
  }
  return "";
}

export default function SessionDetail({ session }: SessionDetailProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    const collected: MessageItem[] = [];
    let fileStream: ReturnType<typeof createReadStream> | null = null;
    let rl: ReturnType<typeof createInterface> | null = null;
    let index = 0;

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

    fileStream = createReadStream(session.filePath);
    rl = createInterface({ input: fileStream, crlfDelay: Infinity, terminal: false });

    rl.on("line", (line: string) => {
      try {
        if (!line.trim()) return;
        const data: JSONLEntry = JSON.parse(line);
        if (data.message && (data.message.role === "user" || data.message.role === "assistant")) {
          const text = extractText(data.message.content);
          if (text.trim()) {
            collected.push({ id: `msg-${index++}`, role: data.message.role, text: text.trim() });
          }
        }
      } catch {
        // Skip invalid JSON
      }
    });

    rl.on("close", () => {
      cleanup();
      setMessages(collected);
      setIsLoading(false);
    });

    rl.on("error", () => {
      cleanup();
      setIsLoading(false);
    });

    return cleanup;
  }, [session.filePath]);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      navigationTitle={truncate(session.firstMessage, 60, "")}
      pagination={{
        pageSize: PAGE_SIZE,
        hasMore: visibleCount < messages.length,
        onLoadMore: () => setVisibleCount((c) => c + PAGE_SIZE),
      }}
    >
      {messages.slice(0, visibleCount).map((msg) => (
        <List.Item
          key={msg.id}
          title={truncate(msg.text, 60)}
          icon={msg.role === "user" ? Icon.Person : Icon.Stars}
          accessories={[{ tag: { value: msg.role, color: msg.role === "user" ? Color.Blue : Color.Green } }]}
          detail={
            <List.Item.Detail
              markdown={msg.text}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="Session ID" text={session.id} />
                  <List.Item.Detail.Metadata.Label title="Project" text={session.projectName} />
                  <List.Item.Detail.Metadata.Label title="Project Path" text={session.projectPath} />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="Turns" text={String(session.turnCount)} />
                  <List.Item.Detail.Metadata.Label title="Last Modified" text={session.lastModified.toLocaleString()} />
                </List.Item.Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <PasteAction content={msg.text} />
              <Action.CopyToClipboard title="Copy Message" content={msg.text} />
              <Action.Push
                title="Create Snippet from Message"
                icon={Icon.Document}
                shortcut={{ modifiers: ["cmd"], key: "s" }}
                target={<CreateSnippet content={msg.text} />}
              />
              <Action.CopyToClipboard
                title="Copy Session ID"
                content={session.id}
                shortcut={{ modifiers: ["cmd"], key: "." }}
              />
              <Action.CopyToClipboard
                title="Copy Conversation File Path"
                icon={Icon.CopyClipboard}
                content={session.filePath}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
              <Action.CopyToClipboard
                title="Copy Project Path"
                icon={Icon.Folder}
                content={session.projectPath}
                shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
              />
              {session.projectPath.startsWith("/") && (
                <Action.ShowInFinder
                  path={session.projectPath}
                  title="Open Project in Finder"
                  icon={Icon.Folder}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
