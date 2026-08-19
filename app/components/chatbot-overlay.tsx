"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { IconClose, IconSparkle, IconUser, MomentumArc } from "@/app/components/icons";
import { ChatCard } from "@/app/components/chat-cards";
import type { RichCard } from "@/lib/chatbot/types";

type Message = { role: "assistant" | "user"; content: string; card?: RichCard };

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
  const openerRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    function openFromLauncher(event: Event) {
      const detail = (event as CustomEvent<{ preset?: string }>).detail;
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (detail?.preset) setInput(detail.preset);
      setIsOpen(true);
    }

    window.addEventListener("fitbot:open", openFromLauncher);
    return () => window.removeEventListener("fitbot:open", openFromLauncher);
  }, []);

  function openFromFloatingLauncher(event: React.MouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    setIsOpen(true);
  }

  function closeOverlay() {
    setIsOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }

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
      const data = (await response.json()) as { reply?: string; card?: RichCard };
      setMessages((current) => [...current, { role: "assistant", content: data.reply ?? "I’m here. Let’s take the next step together.", card: data.card }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I hit a small snag. Try that again and we’ll keep moving." }]);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  if (!isOpen) {
    return <button className="chatbot-launcher" type="button" onClick={openFromFloatingLauncher} aria-label="Open Fitbot chat"><MomentumArc className="chatbot-launcher-arc" /><IconSparkle /><span>Fitbot</span></button>;
  }

  return (
    <section className="chatbot-overlay animate-scale-in" aria-label="Conversation with Fitbot">
      <header className="chatbot-overlay-header">
        <div><span className="message-avatar assistant-avatar"><MomentumArc /></span><span className="wordmark">Fitbot</span></div>
        <button type="button" onClick={closeOverlay} aria-label="Close Fitbot chat"><IconClose /></button>
      </header>
      <div className="message-list chatbot-message-list" ref={messageListRef}>
        {messages.map((message, index) => <div className="message-stack" key={`${message.role}-${index}`}><div className={`message-row ${message.role}`}><div className={`message-avatar ${message.role === "assistant" ? "assistant-avatar" : "user-avatar"}`}>{message.role === "assistant" ? <MomentumArc /> : <IconUser />}</div><p className={message.card ? "sr-only" : undefined} aria-live={message.role === "assistant" ? "polite" : undefined}>{message.content}</p></div>{message.card ? <ChatCard card={message.card} /> : null}</div>)}
        {isSending && <div className="message-row assistant"><div className="message-avatar assistant-avatar"><MomentumArc /></div><p className="typing"><i /><i /><i /></p></div>}
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
