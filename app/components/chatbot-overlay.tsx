"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { IconClose, IconSparkle } from "@/app/components/icons";

type Message = { role: "assistant" | "user"; content: string };

const greeting: Message = {
  role: "assistant",
  content: "Hey, I’m Fitbot. What do you want to move toward today?",
};

const starters = ["Plan my week", "Give me a quick workout", "Build consistency"];

export function ChatbotOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadMessages() {
      try {
        const response = await fetch("/api/chat");
        if (!response.ok) throw new Error("Unable to load chat history");
        const data = (await response.json()) as { messages?: Message[] };
        if (isMounted) setMessages(data.messages?.length ? data.messages : [greeting]);
      } catch {
        if (isMounted) setMessages([greeting]);
      }
    }

    void loadMessages();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  useEffect(() => { messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight }); }, [isOpen, messages, isSending]);

  async function sendMessage(event?: FormEvent<HTMLFormElement>, preset?: string) {
    event?.preventDefault();
    const message = (preset ?? input).trim();
    if (!message || isSending) return;

    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setIsSending(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      if (!response.ok) throw new Error("Unable to send message");
      const data = (await response.json()) as { reply?: string };
      setMessages((current) => [...current, { role: "assistant", content: data.reply ?? "I’m here. Let’s take the next step together." }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I hit a small snag. Try that again and we’ll keep moving." }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  if (!isOpen) {
    return <button className="chatbot-launcher" type="button" onClick={() => setIsOpen(true)} aria-label="Open Fitbot chat"><IconSparkle /><span>Fitbot</span></button>;
  }

  return (
    <section className="chatbot-overlay animate-scale-in" aria-label="Conversation with Fitbot">
      <header className="chatbot-overlay-header">
        <div><span className="message-avatar">F</span><span className="wordmark">Fitbot</span></div>
        <button type="button" onClick={() => setIsOpen(false)} aria-label="Close Fitbot chat"><IconClose /></button>
      </header>
      <div className="message-list chatbot-message-list" ref={messageListRef} aria-live="polite">
        {messages.map((message, index) => <div className={`message-row ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === "assistant" ? "F" : "You"}</div><p>{message.content}</p></div>)}
        {isSending && <div className="message-row assistant"><div className="message-avatar">F</div><p className="typing"><i /><i /><i /></p></div>}
      </div>
      {messages.length === 1 && <div className="chat-starters chatbot-starters">{starters.map((starter) => <button key={starter} type="button" onClick={() => sendMessage(undefined, starter)}>{starter}<span>→</span></button>)}</div>}
      <form className="chat-form chatbot-form" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="chatbot-message">Message Fitbot</label>
        <input ref={inputRef} id="chatbot-message" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tell Fitbot what’s on your mind..." disabled={isSending} />
        <button aria-label="Send message" disabled={!input.trim() || isSending} type="submit">↑</button>
      </form>
      <p className="chat-disclaimer">Fitbot gives general fitness guidance, not medical advice.</p>
    </section>
  );
}
