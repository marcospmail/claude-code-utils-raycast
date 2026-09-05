import { Action, ActionPanel, Icon, List, showToast, Toast, useNavigation } from "@raycast/api";
import { useRef, useState } from "react";
import { PasteAction } from "../../components/paste-action";
import { executeConversation } from "../../utils/claude-cli";
import ComposeForm from "./execute";
import { DEFAULT_MODEL, MODELS } from "./models";

const SYSTEM_PROMPT = "You are a helpful assistant. Respond directly and concisely.";
const SNIPPET_LENGTH = 60;

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function snippet(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > SNIPPET_LENGTH ? `${oneLine.slice(0, SNIPPET_LENGTH)}…` : oneLine;
}

export default function ChatConversation() {
  const { push } = useNavigation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchText, setSearchText] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [isLoading, setIsLoading] = useState(false);
  const idCounter = useRef(0);

  function makeId(): string {
    idCounter.current += 1;
    return String(idCounter.current);
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = { id: makeId(), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setSearchText("");
    setIsLoading(true);

    try {
      const result = await executeConversation(
        nextMessages.map((m) => ({ role: m.role, content: m.content })),
        { model, systemPrompt: SYSTEM_PROMPT },
      );
      setMessages((prev) => [...prev, { id: makeId(), role: "assistant", content: result.result }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await showToast({ style: Toast.Style.Failure, title: "Chat failed", message: msg });
      setMessages((prev) => [...prev, { id: makeId(), role: "assistant", content: `**Error:** ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  function openFullTextInput() {
    push(<ComposeForm initialText={searchText} model={model} onModelChange={setModel} onSubmit={send} />);
  }

  function newConversation() {
    setMessages([]);
    setSearchText("");
  }

  function messageActions(content?: string) {
    return (
      <ActionPanel>
        <Action title="Send" icon={Icon.ArrowRight} onAction={() => send(searchText)} />
        <Action
          title="Full Text Input"
          icon={Icon.Text}
          shortcut={{ modifiers: ["cmd"], key: "t" }}
          onAction={openFullTextInput}
        />
        {content && <Action.CopyToClipboard title="Copy Message" content={content} icon={Icon.Clipboard} />}
        {content && <PasteAction content={content} />}
        <Action
          title="New Conversation"
          icon={Icon.Plus}
          shortcut={{ modifiers: ["cmd"], key: "n" }}
          onAction={newConversation}
        />
      </ActionPanel>
    );
  }

  // Newest at top: reverse the chronological list and prepend a "thinking" placeholder while awaiting a reply.
  const ordered = [...messages].reverse();

  return (
    <List
      isLoading={isLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      filtering={false}
      searchBarPlaceholder={messages.length > 0 ? "Ask another question…" : "Message Claude…"}
      isShowingDetail={messages.length > 0 || isLoading}
      navigationTitle="Chat"
      searchBarAccessory={
        <List.Dropdown tooltip="Model" value={model} onChange={setModel}>
          {MODELS.map((m) => (
            <List.Dropdown.Item key={m.value} value={m.value} title={m.title} />
          ))}
        </List.Dropdown>
      }
    >
      {messages.length === 0 && !isLoading ? (
        <List.EmptyView
          icon={Icon.Message}
          title="Start chatting"
          description="Type a message and press Enter · ⌘T for full text input"
          actions={messageActions()}
        />
      ) : (
        <>
          {isLoading && (
            <List.Item
              key="thinking"
              title="Claude"
              subtitle="Thinking…"
              icon={Icon.Stars}
              detail={<List.Item.Detail markdown="_Claude is thinking…_" />}
              actions={messageActions()}
            />
          )}
          {ordered.map((m) => (
            <List.Item
              key={m.id}
              title={m.role === "user" ? "You" : "Claude"}
              subtitle={snippet(m.content)}
              icon={m.role === "user" ? Icon.Person : Icon.Stars}
              detail={<List.Item.Detail markdown={m.content} />}
              actions={messageActions(m.content)}
            />
          ))}
        </>
      )}
    </List>
  );
}
