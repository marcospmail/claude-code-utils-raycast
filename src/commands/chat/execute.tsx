import { Action, ActionPanel, Form, Icon, useNavigation } from "@raycast/api";
import { useState } from "react";
import { MODELS } from "./models";

interface ComposeFormProps {
  initialText: string;
  model: string;
  onModelChange: (model: string) => void;
  onSubmit: (text: string) => void;
}

// Full-text composer (⌘T from the chat) — a multi-line TextArea with no length limit,
// for messages too long or too multi-line for the inline search bar.
export default function ComposeForm({ initialText, model, onModelChange, onSubmit }: ComposeFormProps) {
  const { pop } = useNavigation();
  const [text, setText] = useState(initialText);

  return (
    <Form
      navigationTitle="Full Text Input"
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Send"
            icon={Icon.ArrowRight}
            onSubmit={() => {
              if (!text.trim()) return;
              onSubmit(text);
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea id="message" title="Message" placeholder="Message Claude…" value={text} onChange={setText} />
      <Form.Dropdown id="model" title="Model" value={model} onChange={onModelChange}>
        {MODELS.map((m) => (
          <Form.Dropdown.Item key={m.value} value={m.value} title={m.title} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
