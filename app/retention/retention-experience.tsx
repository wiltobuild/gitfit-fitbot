"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconEnvelope,
  IconInfo,
  IconPencil,
  IconPhone,
  IconSend,
  IconTarget,
  IconUsers
} from "@/app/components/icons";
import { useToast } from "@/app/components/toaster";
import type { MemberRow } from "@/lib/members/queries";

type Cohort = { minDays: number; maxDays: number; members: MemberRow[] };
type TrendPoint = { weekStart: string; activeMembers: number };
const baseMessage =
  "Hey [First name],\nYou've got this. A fresh start is closer than you think.\nOne workout is all it takes to get the momentum back.\nWe'll be cheering you on,\n– The GitFit Team";
const incentiveLine =
  "As a thank-you, enjoy a bonus perk when you book this week.";
const nameOf = (member: MemberRow) =>
  member.full_name?.trim().split(/\s+/)[0] || "there";
const initials = (member: MemberRow) =>
  (
    member.full_name
      ?.split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("") || member.email.slice(0, 2)
  ).toUpperCase();
const inactiveFor = (date?: string | null) =>
  date
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86400000
        )
      )
    : null;

function ActivityTrend({ points }: { points: TrendPoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const colors = getComputedStyle(document.documentElement),
        teal = colors.getPropertyValue("--color-teal").trim(),
        violet = colors.getPropertyValue("--color-violet").trim(),
        magenta = colors.getPropertyValue("--color-magenta").trim(),
        muted = colors.getPropertyValue("--color-muted").trim(),
        border = colors.getPropertyValue("--color-border").trim(),
        surface = colors.getPropertyValue("--color-surface").trim();
      const w = Math.max(1, Math.round(canvas.getBoundingClientRect().width)),
        h = 210,
        ratio = devicePixelRatio || 1,
        pad = { top: 18, right: 12, bottom: 34, left: 38 },
        cw = w - pad.left - pad.right,
        ch = h - pad.top - pad.bottom,
        max = Math.max(...points.map((p) => p.activeMembers), 1),
        yMax = Math.max(1, Math.ceil(max / 5) * 5);
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      ctx.scale(ratio, ratio);
      ctx.font = "600 10px sans-serif";
      ctx.fillStyle = muted;
      ctx.strokeStyle = border;
      for (let i = 0; i <= 4; i += 1) {
        const y = pad.top + (ch * i) / 4;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(w - pad.right, y);
        ctx.stroke();
        ctx.fillText(String(Math.round(yMax - (yMax * i) / 4)), 0, y + 3);
      }
      if (!points.length) {
        ctx.fillText("No activity data yet", pad.left, pad.top + ch / 2);
        return;
      }
      const coordinates = points.map((p, i) => ({
          x:
            pad.left +
            (points.length === 1 ? cw / 2 : (cw * i) / (points.length - 1)),
          y: pad.top + ch - (p.activeMembers / yMax) * ch
        })),
        area = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch),
        line = ctx.createLinearGradient(pad.left, 0, w - pad.right, 0);
      area.addColorStop(0, `${violet}42`);
      area.addColorStop(1, `${teal}00`);
      ctx.beginPath();
      coordinates.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
      );
      ctx.lineTo(coordinates.at(-1)!.x, pad.top + ch);
      ctx.lineTo(coordinates[0].x, pad.top + ch);
      ctx.closePath();
      ctx.fillStyle = area;
      ctx.fill();
      line.addColorStop(0, teal);
      line.addColorStop(0.52, violet);
      line.addColorStop(1, magenta);
      ctx.beginPath();
      coordinates.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)
      );
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.stroke();
      const fmt = new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric"
      });
      coordinates.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = surface;
        ctx.fill();
        ctx.strokeStyle = violet;
        ctx.stroke();
        if (
          points.length <= 5 ||
          i === 0 ||
          i === points.length - 1 ||
          i % 2 === 0
        ) {
          ctx.fillStyle = muted;
          ctx.textAlign =
            i === 0 ? "left" : i === points.length - 1 ? "right" : "center";
          ctx.fillText(
            fmt.format(new Date(`${points[i].weekStart}T00:00:00`)),
            p.x,
            h - 10
          );
        }
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points]);
  return (
    <div className="retention-trend">
      <div className="retention-trend-heading">
        <div>
          <p className="retention-panel-kicker">Activity</p>
          <h3>Member activity trend</h3>
        </div>
        <span>Last 8 weeks</span>
      </div>
      <canvas aria-label="Weekly active members trend" ref={ref} role="img" />
    </div>
  );
}

export function RetentionExperience({
  initialCohorts,
  initialTrend,
  staffUserId
}: {
  initialCohorts: Cohort[];
  initialTrend: TrendPoint[];
  staffUserId: string;
}) {
  const { showSuccess } = useToast();
  const [chosen, setChosen] = useState(
      Math.min(1, Math.max(initialCohorts.length - 1, 0))
    ),
    [goal, setGoal] = useState("Restart with one manageable workout"),
    [channel, setChannel] = useState("Push notification + email"),
    [sendTime, setSendTime] = useState("This Friday at 6:00 PM"),
    [message, setMessage] = useState(baseMessage),
    [tab, setTab] = useState("push"),
    [incentive, setIncentive] = useState(false),
    [edit, setEdit] = useState<"goal" | "channel" | "sendTime" | null>(null),
    [value, setValue] = useState(""),
    [launch, setLaunch] = useState(false),
    [launchPending, setLaunchPending] = useState(false),
    [launchError, setLaunchError] = useState(""),
    [launchResult, setLaunchResult] = useState<{
      draftsCreated: number;
      reachableCount: number;
    } | null>(null);
  const cohort = initialCohorts[chosen],
    member = cohort?.members[0],
    composed = `${message.trimEnd()}${incentive ? `\n\n${incentiveLine}` : ""}`,
    preview = composed.replaceAll(
      "[First name]",
      member ? nameOf(member) : "there"
    );
  const open = (field: "goal" | "channel" | "sendTime") => {
      setEdit(field);
      setValue(
        field === "goal" ? goal : field === "channel" ? channel : sendTime
      );
    },
    save = () => {
      if (edit === "goal") setGoal(value);
      if (edit === "channel") setChannel(value);
      if (edit === "sendTime") setSendTime(value);
      setEdit(null);
    };
  async function launchCampaign() {
    if (!cohort) return;
    setLaunchPending(true);
    setLaunchError("");
    try {
      const response = await fetch("/api/retention/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: cohort.members.map((item) => item.id),
          members: cohort.members,
          subject: `GitFit: ${goal}`,
          body: composed
        })
      });
      const payload = (await response.json()) as {
        draftsCreated?: number;
        reachableCount?: number;
        error?: string;
      };
      if (
        !response.ok ||
        typeof payload.draftsCreated !== "number" ||
        typeof payload.reachableCount !== "number"
      )
        throw new Error(payload.error ?? "Unable to create campaign drafts.");
      setLaunchResult({
        draftsCreated: payload.draftsCreated,
        reachableCount: payload.reachableCount
      });
      showSuccess(`${payload.draftsCreated} campaign drafts created.`);
    } catch (error) {
      setLaunchError(
        error instanceof Error
          ? error.message
          : "Unable to create campaign drafts."
      );
    } finally {
      setLaunchPending(false);
    }
  }
  const readiness = [
    { label: "Audience selected", yes: !!cohort },
    { label: "Message isn't empty", yes: !!message.trim() },
    { label: "Channel selected", yes: !!channel }
  ];
  return (
    <>
      <header className="retention-header-band">
        <div className="retention-header-inner">
          <div>
            <p className="eyebrow">
              <span /> Staff outreach
            </p>
            <h1>Retention Campaigns</h1>
            <p>
              Build thoughtful re-engagement campaigns from live member
              activity.
            </p>
          </div>
          <span className="badge badge-brand">Campaign workspace</span>
        </div>
      </header>
      <div className="retention-layout">
        <section className="surface-card retention-panel">
          <p className="retention-panel-kicker">Audience</p>
          <h2>Audience cohorts</h2>
          <ul className="retention-cohort-list">
            {initialCohorts.map((item, index) => (
              <li key={`${item.minDays}-${item.maxDays}`}>
                <button
                  aria-pressed={chosen === index}
                  className={`retention-cohort-row${chosen === index ? " selected" : ""}`}
                  onClick={() => setChosen(index)}
                  type="button"
                >
                  <span>
                    {item.minDays}–{item.maxDays} days inactive
                  </span>
                  <strong>{item.members.length}</strong>
                  <IconChevronRight />
                </button>
              </li>
            ))}
          </ul>
          <div className="retention-readiness">
            <h3>Ready to launch</h3>
            {readiness.map(({ label, yes }) => (
              <p className={yes ? "complete" : ""} key={label}>
                {yes ? <IconCheck /> : <IconInfo />}
                {label}
              </p>
            ))}
          </div>
        </section>
        <div className="retention-middle-column">
        <section className="surface-card retention-panel retention-trend-panel">
          <ActivityTrend points={initialTrend} />
        </section>
        <section className="surface-card retention-panel">
          <p className="retention-panel-kicker">Workspace</p>
          <h2>Your campaign</h2>
          <div className="retention-fields">
            <div>
              <IconUsers />
              <span>
                <small>Audience</small>
                <strong>
                  {cohort
                    ? `${cohort.minDays}–${cohort.maxDays} days inactive · ${cohort.members.length} members`
                    : "No cohort selected"}
                </strong>
              </span>
            </div>
            {[
              [IconTarget, "Goal", goal, "goal"],
              [IconSend, "Channel", channel, "channel"],
              [IconCalendar, "Send time", sendTime, "sendTime"]
            ].map(([Icon, label, text, field]) => (
              <div key={String(field)}>
                <Icon />
                <span>
                  <small>{String(label)}</small>
                  <strong>{String(text)}</strong>
                </span>
                <button
                  aria-label={`Edit ${String(label).toLowerCase()}`}
                  onClick={() => open(field as "goal" | "channel" | "sendTime")}
                  type="button"
                >
                  <IconPencil />
                </button>
              </div>
            ))}
          </div>
          <div className="retention-composer">
            <div className="retention-composer-heading">
              <h3>Message</h3>
              <div role="tablist">
                <button
                  aria-selected={tab === "push"}
                  className={tab === "push" ? "active" : ""}
                  onClick={() => setTab("push")}
                  role="tab"
                  type="button"
                >
                  <IconPhone /> Push
                </button>
                <button
                  aria-selected={tab === "email"}
                  className={tab === "email" ? "active" : ""}
                  onClick={() => setTab("email")}
                  role="tab"
                  type="button"
                >
                  <IconEnvelope /> Email
                </button>
              </div>
            </div>
            <textarea
              aria-label="Campaign message"
              onChange={(e) => setMessage(e.target.value)}
              value={message}
            />
            <div className="retention-composer-meta">
              <span>{composed.length}/240 characters</span>
              <label>
                <input
                  checked={incentive}
                  onChange={(e) => setIncentive(e.target.checked)}
                  type="checkbox"
                />
                <i /> Adds an incentive line to the message
              </label>
            </div>
            <div className="retention-actions">
              <button
                className="btn btn-outline btn-sm"
                onClick={() =>
                  showSuccess(
                    "Draft persistence isn't connected yet — your changes stay in this workspace for now"
                  )
                }
                type="button"
              >
                Save draft
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={() =>
                  showSuccess(
                    "This is a preview — no test message infrastructure is connected yet"
                  )
                }
                type="button"
              >
                Send test
              </button>
              <button
                className="btn btn-primary btn-sm"
                disabled={!cohort || !message.trim()}
                onClick={() => {
                  setLaunchError("");
                  setLaunchResult(null);
                  setLaunch(true);
                }}
                type="button"
              >
                Launch campaign
              </button>
            </div>
          </div>
        </section>
        </div>
        <aside className="surface-card retention-panel">
          <p className="retention-panel-kicker">Preview</p>
          <h2>Live member preview</h2>
          {member ? (
            <div className="retention-member-preview">
              <div className="retention-member-heading">
                <span className="member-initials">{initials(member)}</span>
                <div>
                  <strong>{nameOf(member)}</strong>
                  <small>
                    {inactiveFor(member.last_visit_date) === null
                      ? "No visit on record"
                      : `Inactive for ${inactiveFor(member.last_visit_date)} days`}
                  </small>
                </div>
              </div>
              <div className="retention-notification">
                <span>
                  <IconPhone /> GitFit
                </span>
                <p>{preview}</p>
              </div>
              <div className="retention-email-preview">
                <span>
                  <IconEnvelope /> GitFit
                </span>
                <strong>A fresh start is closer than you think</strong>
                <p>{preview}</p>
              </div>
            </div>
          ) : (
            <div className="retention-placeholder">
              <p>No members in this cohort right now.</p>
              <small>
                Choose another audience to preview its campaign message.
              </small>
            </div>
          )}
          <small className="retention-staff-note">
            Workspace owner: {staffUserId.slice(0, 8)}
          </small>
        </aside>
      </div>
      {edit ? (
        <div
          aria-modal="true"
          className="retention-modal-backdrop"
          onMouseDown={() => setEdit(null)}
          role="dialog"
        >
          <div
            className="retention-modal surface-card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2>Edit {edit === "sendTime" ? "send time" : edit}</h2>
            <label className="field">
              <span className="field-label">
                {edit === "channel"
                  ? "Channel"
                  : edit === "goal"
                    ? "Goal"
                    : "Send time"}
              </span>
              {edit === "channel" ? (
                <select
                  className="field-input"
                  onChange={(e) => setValue(e.target.value)}
                  value={value}
                >
                  <option>Push notification + email</option>
                  <option>Push notification</option>
                  <option>Email</option>
                </select>
              ) : (
                <input
                  autoFocus
                  className="field-input"
                  onChange={(e) => setValue(e.target.value)}
                  value={value}
                />
              )}
            </label>
            <div>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setEdit(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={save}
                type="button"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {launch ? (
        <div
          aria-modal="true"
          className="retention-modal-backdrop"
          onMouseDown={() => !launchPending && setLaunch(false)}
          role="dialog"
        >
          <div
            className="retention-modal surface-card"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2>
              {launchResult ? "Campaign drafts created" : "Launch campaign"}
            </h2>
            {launchResult ? (
              <p>
                {launchResult.draftsCreated} drafts created.{" "}
                {launchResult.reachableCount} of {launchResult.draftsCreated}{" "}
                members have an account and can be reached via FitBot once sent.
              </p>
            ) : (
              <p>
                Launching will create a draft for every member in this audience.
                Drafts must still be reviewed and sent individually before they
                appear in FitBot.
              </p>
            )}
            {launchError ? (
              <p className="card-error" role="alert">
                {launchError}
              </p>
            ) : null}
            <div>
              {launchResult ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setLaunch(false)}
                  type="button"
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={launchPending}
                    onClick={() => setLaunch(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={launchPending}
                    onClick={() => void launchCampaign()}
                    type="button"
                  >
                    {launchPending ? "Creating drafts..." : "Create drafts"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
