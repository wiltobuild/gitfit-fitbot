"use client";

import { useEffect, useRef, useState } from "react";

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  is_staff: boolean;
  created_at: string;
};

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function formatMemberSince(createdAt: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(createdAt));
}

function openFitBot() {
  window.dispatchEvent(new CustomEvent("fitbot:open", { detail: { preset: "look up a member" } }));
}

export function MemberSearch() {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const searchTerm = query.trim();
    requestRef.current?.abort();

    if (!searchTerm) {
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const response = await fetch("/api/staff/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ search_term: searchTerm }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Member search failed");
        const data = (await response.json()) as { members?: Member[] };
        if (!controller.signal.aborted) {
          setMembers(data.members ?? []);
          setStatus("success");
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError" && !controller.signal.aborted) {
          setMembers([]);
          setStatus("error");
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const liveMessage = status === "success"
      ? members.length === 1 ? "1 member found" : `${members.length} members found`
      : "";

  return (
    <section className="surface-card staff-member-search" aria-labelledby="member-search-title">
      <div className="staff-panel-heading">
        <div><p className="eyebrow"><span /> Member directory</p><h2 id="member-search-title">Find a member</h2></div>
        <p>Search by name or email.</p>
      </div>
      <label className="field-label" htmlFor="member-search">Member name or email</label>
      <input className="field-input" id="member-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setMembers([]); setStatus("idle"); }} placeholder="Start typing a name or email" autoComplete="off" />
      <p className="sr-only" aria-live="polite">{liveMessage}</p>
      <div className="staff-member-results" aria-busy={status === "loading"}>
        {status === "idle" ? <p className="staff-search-state">Search the member directory to see results.</p> : null}
        {status === "loading" ? <p className="staff-search-state">Searching members…</p> : null}
        {status === "error" ? <p className="staff-search-state staff-search-error">We couldn&apos;t look up members right now.</p> : null}
        {status === "success" && members.length === 0 ? <div className="staff-search-state"><p>No members found.</p><button type="button" className="staff-fitbot-text" onClick={openFitBot}>Ask FitBot for help</button></div> : null}
        {status === "success" && members.length > 0 ? <ul className="staff-member-list" aria-label="Member search results">
          {members.map((member) => <li className="staff-member-row" key={member.id}>
            <span className="staff-member-initials" aria-hidden="true">{initials(member.full_name, member.email)}</span>
            <div className="staff-member-identity"><strong>{member.full_name || "Unnamed member"}</strong><span>{member.email}</span></div>
            <span className="badge badge-neutral">{member.is_staff ? "staff" : "member"}</span>
            <span className="staff-member-since">Member since {formatMemberSince(member.created_at)}</span>
            <button className="btn btn-outline btn-sm" type="button" onClick={openFitBot}>Ask FitBot about {member.full_name || "member"}</button>
          </li>)}
        </ul> : null}
      </div>
    </section>
  );
}
