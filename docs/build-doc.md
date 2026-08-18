# GitFit · Team Build Doc

## The Chatbot's Integration & Build Guide

*Strength. Stillness. Studio. — and one product that talks to all the others.*

Everyone on GitFit is building their own product in parallel. This doc covers what the chatbot needs to become the thing that ties them together: the shared contract every product should expose, the chatbot's own architecture, and the calls the whole team needs to make before integration week arrives and it's too late to change.

- **Owner** · Chatbot workstream
- **Audience** · Whole team, every product
- **Status** · Draft — confirm the marked assumptions
- **Ship date** · Friday, Aug 28, 2026

---

## The Real Problem

### You're building five products that have to feel like one

The chatbot isn't just another product in the suite — it's the thing that has to reach into everyone else's product. That only works if every teammate agrees on how their product exposes itself before they've each gone off and built it their own way.

Right now each of you is building independently, which is the right call for a capstone timeline — nobody should be blocked waiting on someone else's backend. But it means the single highest-risk item on this whole project isn't any one product, it's the seam between them. If four people build four APIs with four different auth schemes, four different ID formats, and four different error shapes, the chatbot integration becomes a week of reverse-engineering right before the deadline.

> **Do this first.** Freeze the contract in "Contract" below as a group, this week, before anyone writes product-specific business logic. It's three things: how the chatbot authenticates as a user across products, how each product describes its own capabilities, and what an error looks like. Everything else in your product can change; those three cannot, or the last week becomes integration hell instead of polish.

---

## Brand Quick-Reference

### Keep every surface recognizably GitFit

Pulled from the brand identity doc so whoever's building UI doesn't have to go dig it up. Full guide has the logo lockup rules and icon set — this is just the tokens.

| Color | Hex |
|---|---|
| Vital Teal | `#1FC2AE` |
| Drive Violet | `#6E3FE0` |
| Energy Magenta | `#C43FD6` |
| Ink | `#141B3C` |
| Paper | `#F8F7F5` |

- **Baloo 2** (600/700) — Headlines, wordmark, anywhere the chatbot needs personality (empty states, onboarding).
- **Inter** (400/500/600) — Every chat bubble, every button, every line the user actually reads and replies to.

**For the chatbot specifically:** the gradient (teal → violet → magenta) is a hero-moment device in the brand doc, not a body-text device — don't gradient-fill chat bubbles or buttons. Use it once: a thinking/typing indicator, or the send button's active state. Voice-wise, the brand reads as warm but driven — write the chatbot's copy like an instructor, not a customer-service bot: encouraging, direct, no corporate hedging ("Let's get you booked" beats "I'd be happy to assist with that").

---

## Architecture

### The chatbot is an orchestrator, not a fifth silo

It doesn't reimplement anyone's product logic. It holds a conversation, decides which product(s) a request touches, calls into them through the shared contract, and narrates the result back.

```
GitFit Chatbot (orchestrator + LLM)
   │ tool call        │ tool call        │ tool call
   ▼                  ▼                  ▼
Product A          Product B          Product C
(e.g. scheduling)  (e.g. community)   (e.g. practice log)
```

Every product owns its own data and business logic. The chatbot only ever talks to them through their published tool contract — never a shared database, never a direct table read.

**Why not a shared database instead?** It's tempting — one Postgres instance, everyone reads/writes the tables they need. It'll also be the thing that breaks hardest under a five-person team on a deadline: any schema change one person makes breaks everyone else silently, there's no way to reason about who's allowed to do what, and it doesn't resemble how real multi-service systems work (which matters if this is going in a portfolio). The tool-contract approach costs a little more upfront per product, and saves the whole team from that failure mode.

---

## The Shared Contract

### What every product owes the chatbot

Three things, and they're each small. Agree on these as a group before writing product code — changing them later means touching every product at once.

#### 1. A tool manifest, not a bespoke API

Each product exposes a small, explicit list of actions the chatbot is allowed to take, not its whole internal API surface. Two ways to ship this, both fine — pick one as a team:

- **MCP server** (recommended if anyone's comfortable with it) — each product runs a small Model Context Protocol server exposing its actions as typed tools. The chatbot becomes an MCP client that connects to all of them. This is literally the protocol built for "one LLM app calling into several backends" — it's the least work for the chatbot side.
- **REST + OpenAPI** (recommended if the team is more comfortable with plain HTTP) — each product ships a normal REST API plus an `openapi.yaml` describing it. The chatbot loads each spec and turns operations into tool definitions itself.

Example tool manifest entry (either approach converges here):

```json
{
  "name": "book_class",
  "description": "Reserve a spot in a yoga class for the current user.",
  "input_schema": {
    "type": "object",
    "properties": {
      "class_id": { "type": "string" },
      "date": { "type": "string", "format": "date" }
    },
    "required": ["class_id", "date"]
  },
  "product": "scheduling",
  "mutates": true,
  "requires_confirmation": true
}
```

The last two fields aren't standard MCP/OpenAPI — they're a GitFit convention. `mutates` tells the chatbot this isn't a safe read; `requires_confirmation` tells it to show the user what it's about to do and wait for a yes before calling it. Every product should tag its own actions this way.

#### 2. One identity, everywhere

The chatbot acts as the logged-in user across every product — "book me into Tuesday's class and log it in my practice tracker" is two products touched by one sentence. That only works if a user is the same user everywhere.

| Approach | What it takes | Fit for this project |
|---|---|---|
| Shared JWT secret | One signing secret in everyone's `.env`; each product issues/verifies the same token shape. | Best fit — zero external dependencies, everyone understands it, works offline for the demo. |
| Hosted identity (Clerk/Auth0 free tier) | One account, SDK in each product. | Fine if someone already wants the experience; overkill otherwise. |
| Per-product logins | Nothing shared. | Avoid — the chatbot can't act across products without asking the user to re-auth mid-conversation. |

Minimum shared JWT claim shape:

```json
{
  "sub": "user_8f2a1c",
  "email": "ava@example.com",
  "iat": 1755500000,
  "exp": 1755503600
}
```

#### 3. One error shape

So the chatbot can tell a user "that class is full" instead of "Error 500."

```json
{
  "error": {
    "code": "class_full",
    "message": "This class has no open spots.",
    "retryable": false
  }
}
```

**Also agree on, quickly:** IDs as strings everywhere (not "usually a number, sometimes a UUID"); timestamps as ISO 8601 UTC (`2026-08-18T14:00:00Z`); each product's tool names prefixed so they can't collide (`schedule.book_class`, not `book_class`).

---

## Chatbot Tech Stack

### What to actually build it with

You have a free hand on the stack. Here's a concrete recommendation, plus why, so you're not relitigating this mid-semester.

| Layer | Recommendation | Why |
|---|---|---|
| LLM | Claude (Anthropic API), Sonnet-tier model | Native, mature tool-calling — the core mechanic this whole chatbot depends on — and prompt caching keeps a class-project API bill small. |
| Backend | Node.js + TypeScript | Same language as the tool-call JSON schemas you're passing around all day, plus the official MCP SDK is first-class TS. Python + FastAPI is a fully reasonable alternative if the team already leans Python — just pick one and don't split. |
| Frontend | React (Vite or Next.js) + a small token-based CSS layer (Tailwind is fine) built from the brand palette above | Streaming chat UI is well-trodden React territory; token-based styling keeps every product's UI swappable without a redesign. |
| Conversation transport | Server-sent events or a streaming HTTP response | Users need to see the assistant "thinking" and typing, not stare at a spinner for 4 seconds. Skip WebSockets unless something else in the app already needs bidirectional push. |
| State / memory | Postgres (or SQLite for the demo) storing conversation turns keyed by `user_id` | You need conversation history to survive a page refresh; nothing fancier than a table of messages is required at this scale. |
| Hosting | Render, Fly.io, or Vercel (frontend) + Render (backend) | Free/cheap tiers, trivial deploy, no DevOps time spent that could go into the actual product. |

---

## Chatbot Internals

### What "advanced" actually means here

Advanced doesn't mean more features bolted on — it means the loop below is solid. This is the part that's genuinely yours to build well; everything above this section is scaffolding for it.

**The core loop:**

1. User sends a message → append to conversation history.
2. Send full history + the tool manifest (merged from every connected product) to Claude.
3. If Claude returns a tool call: check `requires_confirmation`. If set, show the user what's about to happen and wait. Otherwise, call the product's endpoint/MCP tool directly.
4. Feed the tool's result back to Claude as a tool result message; loop until it returns plain text.
5. Stream the final text to the user.

**Things to get right early:**

- **Tool discovery, not hardcoding.** The chatbot should pull each product's manifest at startup (or on a refresh interval), not have product tool names hand-typed into its code — otherwise every teammate's change means editing the chatbot.
- **Confirm before mutating.** Booking a class, canceling a class, posting to a community feed — anything with a side effect gets a visible confirmation step. This is both good UX and the single easiest "advanced chatbot done responsibly" line in your demo and your writeup.
- **Bounded tool loops.** Cap chained tool calls per turn (5–8 is plenty) so a confused model can't spiral into calling tools forever and burning API budget.
- **Graceful degradation per product.** If Product B's server is down during your demo, the chatbot should say so and keep working for A and C — not 500 the whole conversation.
- **A small eval set.** Before demo day, write 15–20 example prompts with the tool call(s) you expect ("what classes are open Thursday" → `schedule.list_classes`) and run them after every change to the system prompt or manifest. Catching a broken tool call in a script beats catching it live in front of your professor.

---

## Security & Privacy

### Non-negotiables, even for a class project

- **Secrets never in the repo.** API keys and the shared JWT secret live in `.env` files that are gitignored, not committed "temporarily."
- **Least privilege per product.** The chatbot's token should only be able to call the tool manifest a product actually published — not query its database directly, even if that database is reachable.
- **Yoga/health data is still personal data.** Practice history, attendance, and any biometric-adjacent fields (weight, injury notes) deserve the same "don't log it in plaintext, don't expose it in an unauthenticated endpoint" treatment as anything else personal — worth a line in your writeup regardless of grading, it's the right habit.
- **Rate-limit the LLM endpoint.** A capstone demo day is exactly when someone will accidentally hammer refresh and burn your API budget — a simple per-user rate limit avoids that being your Tuesday.

---

## Open Questions

### Answer these as a team before you build

The icon set in the brand doc (Balance, Breath, Mat, Schedule, Community, Practice) reads like it's hinting at feature areas — but that's a guess, not a confirmed product list. Nail down:

1. What are the actual products, one per teammate, and what's the one core action each exposes to the chatbot?
2. MCP or REST+OpenAPI for the manifest — pick one, don't mix.
3. Where does the shared JWT secret live, and who owns rotating it if it leaks?
4. What's the demo's golden-path script? ("Show me a chatbot that can check the class schedule, book one, and log it" is a very different scope than "chatbot answers questions about yoga poses.")
5. Who owns the hosted deploy the whole team demos from, so it isn't someone's laptop on demo day?

---

*GitFit · Chatbot Integration & Build Guide — Draft, update as the team confirms the open questions above.*
