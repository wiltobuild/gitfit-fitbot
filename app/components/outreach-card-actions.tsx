"use client";

import { useState } from "react";

import { useToast } from "@/app/components/toaster";

export function OutreachCardActions({ sent, sentAt }: { sent: boolean; sentAt?: string }) {
  const [queued, setQueued] = useState(false);
  const { showSuccess } = useToast();
  const sentLabel = sentAt ? `Sent ${new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(sentAt))}` : "Sent";

  function queueOutreach() {
    setQueued(true);
    showSuccess("Outreach queued to send");
  }

  if (sent) {
    return <div className="chat-outreach-actions"><span className="badge badge-success">{sentLabel}</span></div>;
  }

  return <div className="chat-outreach-actions">
    {queued ? <span className="badge badge-success">Queued</span> : null}
    <button className="btn btn-secondary btn-sm" disabled={queued} onClick={queueOutreach} type="button">Send when ready</button>
    <button className="btn btn-outline btn-sm" disabled={queued} type="button">Edit draft</button>
  </div>;
}
