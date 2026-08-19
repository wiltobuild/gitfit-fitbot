"use client";

import { useState } from "react";

import { useToast } from "@/app/components/toaster";

export function OutreachCardActions() {
  const [queued, setQueued] = useState(false);
  const { showSuccess } = useToast();

  function queueOutreach() {
    setQueued(true);
    showSuccess("Outreach queued to send");
  }

  return <div className="chat-outreach-actions">
    {queued ? <span className="badge badge-success">Queued</span> : null}
    <button className="btn btn-secondary btn-sm" disabled={queued} onClick={queueOutreach} type="button">Send when ready</button>
    <button className="btn btn-outline btn-sm" disabled={queued} type="button">Edit draft</button>
  </div>;
}
