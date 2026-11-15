# TuitionDesk — Design System

The single source of truth for how TuitionDesk looks, reads, and behaves. When in doubt, choose the calmer, plainer option.

The product name is written **TuitionDesk**, one word, in all UI, copy, emails, and metadata.

## 1. Principles

1. **A tidy front desk, not an edtech toy.** Calm, organized, trustworthy. No mascots, confetti, or stock photos. The mint gradient belongs to marketing surfaces only (see §3).
2. **Status at a glance.** The most important information is who has paid, who hasn't, and what's due next. Status colours are the one place the interface gets loud.
3. **Green is the brand, not a status.** Because the brand is green, "Paid" uses blue with a check icon (see §2). Green in the app always means TuitionDesk, never a payment state.
4. **Phone first.** Most admins run their class from a phone. Design at 360px, then scale up.
5. **Plain words.** Name things the way a tutor would: "Record payment", not "Create transaction".
6. **Lists over cards.** Students, payments, and registrations are lists of rows. Use cards only for genuinely separate things (e.g. a course on the dashboard).

## 2. Colour

### Brand palette
| Token | Hex | Use |
|---|---|---|
| `forest` | `#00472A` | Logo wordmark, app header, primary buttons, headings, focus rings |
| `forest-hover` | `#005C37` | Primary button hover and pressed |
| `mint` | `#4EF5A3` | The asterisk; accents on `forest` backgrounds only |
| `mint-soft` | `#E4FBEF` | Active nav background, selected rows, avatar circles |
| `ink` | `#12261C` | Body text |
| `slate` | `#5A6B63` | Secondary text, icons |
| `line` | `#DFE7E2` | Borders, dividers |
| `paper` | `#F6F9F7` | App background |
| `surface` | `#FFFFFF` | Panels, tables, dialogs |
| `amber` | `#F59E0B` | Deadlines and "due soon" |

### Status colours
Always pair colour with a text label, and Paid always with a check icon. Never colour alone.

| Status | Text | Background | Label |
|---|---|---|---|
| Paid | `#1D4ED8` | `#DBEAFE` | ✓ Paid |
| Partly paid | `#B45309` | `#FEF3C7` | Part paid |
| Due | `#B45309` | `#FEF3C7` | Due |
| Overdue | `#B91C1C` | `#FEE2E2` | Overdue |
| Archived / withdrawn | `#475569` | `#F1F5F9` | Archived |
| Sent to BC | `#6D28D9` | `#EDE9FE` | Sent to BC |

### Rules
- Only one `forest` primary button per screen.
- `mint` is never used for text, and never on white or `paper`: it fails contrast. It appears on `forest` backgrounds (header, icon, splash) and in marketing.
- No green status badges anywhere. `mint-soft` is for selection and navigation only, never shaped as a pill or badge.
- Red is reserved for overdue money and destructive actions.
- Text must meet WCAG AA (4.5:1). `slate` is the lightest allowed text colour.
- Light mode only for MVP. Keep colours in CSS variables so dark mode can be added later.

## 3. Logo

### Versions
| Version | Use |
|---|---|
| Wordmark, `forest` text + solid mid-green asterisk `#12B76A` | Default on white and `paper`: sign-in, receipts, PDFs, emails |
| Wordmark, white text + `mint` asterisk | On `forest` backgrounds: app header, splash |
| Wordmark, single colour `forest` | Faxes, stamps, low-quality prints, anywhere colour is unreliable |
| Icon: `mint` asterisk on `forest` rounded square | App icon, PWA icon, favicon, WhatsApp profile picture |
| Wordmark with `mint` gradient asterisk on mint gradient | Marketing only: social posts, landing page hero, pitch decks |

### Rules
- The wordmark is an SVG asset, never typeset in the app. Store versions in `public/brand/`.
- Clear space around the logo: at least the height of the asterisk on every side.
- Minimum wordmark width: 96px on screen. Below that, use the icon.
- The icon uses a heavier asterisk stroke than the wordmark so it reads at 16–32px.
- Don't add shadows, outlines, or effects. Don't recolour the asterisk outside the versions above. Don't stretch, rotate, or rearrange.
- Inside the portal, the institute's own logo leads. TuitionDesk appears only in the footer and on sign-in.

### Marketing gradient
Linear, top-left to bottom-right, `#BFFFDD` → `#F0FDF6`. Used only on marketing surfaces, the sign-in page background, and the PWA splash. Never inside the working app.

## 4. Typography

| Role | Font | Weight |
|---|---|---|
| Headings | Plus Jakarta Sans | 600 |
| UI and body | Inter | 400, 500, 600 |
| Sinhala | Noto Sans Sinhala | 400, 600 |
| Tamil | Noto Sans Tamil | 400, 600 |
| Money and numbers | Inter with `font-variant-numeric: tabular-nums` | 500 |

Load fonts with `next/font/google`. The wordmark's typeface is part of the logo artwork and is not loaded as a web font.

### Scale (mobile → desktop)
| Token | Size / line height | Use |
|---|---|---|
| `display` | 28/34 → 32/40 | Dashboard greeting, exam countdown, empty-state headline |
| `h1` | 22/28 → 24/32 | Page title |
| `h2` | 18/24 | Section title |
| `body` | 15/22 → 16/24 | Default text |
| `small` | 13/18 | Helper text, table meta |

### Rules
- Headings use `forest`; body text uses `ink`.
- Sentence case everywhere: "Exam sessions", not "Exam Sessions".
- No all-caps labels and no small labels stacked above headings.
- Money is always right-aligned in tables and uses tabular numbers.
- Keep paragraph text under ~70 characters per line.

## 5. Spacing, shape, depth

- **Spacing scale:** 4, 8, 12, 16, 24, 32, 48 px. Page padding 16px on mobile, 32px on desktop.
- **Radius:** 6px for inputs and badges, 10px for buttons and panels, 16px for dialogs, bottom sheets, and the app icon's rounded square. Not everything gets the same radius.
- **Depth:** borders (`line`) do the work. Shadows only on things that float: dialogs, dropdowns, bottom sheets, toasts.
- **Touch targets:** at least 44 × 44px.

## 6. Layout

### Admin, mobile (< 768px)
```
┌──────────────────────────┐
│ [✱] Institute name  [+]  │  forest header, 56px, mint icon
├──────────────────────────┤
│ Deadline strip (if any)  │  amber, see §7
├──────────────────────────┤
│                          │
│  Page content            │  paper background
│  Lists as full-width rows│
│                          │
├──────────────────────────┤
│ Home Students Exams Pay  │  bottom nav, 4 items + More
└──────────────────────────┘
```

### Admin, desktop (≥ 1024px)
```
┌────────┬─────────────────────────────────┐
│ Logo   │ Page title            [Action]  │
│        ├─────────────────────────────────┤
│ Home   │ Deadline strip                  │
│ Studen │                                 │
│ Course │ Content, max-width 1120px,      │
│ Exams  │ left aligned                    │
│ Paymts │                                 │
│ Settin │                                 │
└────────┴─────────────────────────────────┘
  240px sidebar, forest background, white text,
  active item: mint-soft text on a slightly lighter forest
```

### Portal (parents and students), all screen sizes
```
┌──────────────────────────┐
│ Institute logo + name    │  surface header with forest text
│ [Kavindu ▾]              │  child switcher, only if 2+ children
├──────────────────────────┤
│                          │
│  Single column,          │  max-width 640px, centred column
│  stacked sections        │  on desktop
│                          │
├──────────────────────────┤
│ Home Courses Exams Fees  │  bottom nav on every size
└──────────────────────────┘
```
- The portal shows the **institute's** name and logo, not TuitionDesk's. Parents relate to their class, not to us. TuitionDesk appears only in the footer and on the sign-in page.
- No sidebar, no deadline strip, no admin vocabulary.

### General
- Content is left aligned. Never centre page content except empty states.
- Tables on desktop become stacked rows on mobile (name and status on line one, meta on line two, amount on the right).

## 7. The signature element: the deadline strip

The one bold, memorable thing in the admin interface. When any exam session's BC registration deadline is within 14 days, a full-width amber strip sits below the header on every admin screen:

> **B2 First (12 Dec)**: BC deadline in 6 days. 8 of 31 students unpaid. [Send reminders]

- Background `#FEF3C7`, left border 4px `amber`, text `ink`.
- Within 3 days, the border and count turn red (`#B91C1C`).
- If several sessions are close, show the nearest one plus "and 2 more".
- Tapping it opens the session's unpaid list.

Nothing else in the app uses amber as a background.

## 8. Components

Use shadcn/ui and theme it; don't build from scratch.

- **Button.** Primary (`forest` fill, white text, `forest-hover` on hover), secondary (white, `line` border, `forest` text), ghost (text only), destructive (red, only in confirm dialogs). Labels are verbs: "Add student", "Record payment", "Export for BC". No arrows or icons appended to text.
- **Status badge.** Pill, 6px radius, colours from §2, 13px medium text. Paid includes a check icon.
- **Row list.** The workhorse. 56–64px rows, avatar initials (`forest` text in a `mint-soft` circle) for people, primary text `ink`, meta in `slate`, amount and badge on the right.
- **Money input.** Prefix "LKR", numeric keyboard (`inputMode="decimal"`), formats with commas on blur.
- **Phone input.** Accepts `077…` or `+94…`, shows normalized number below.
- **Bottom sheet** (mobile) / **dialog** (desktop) for quick actions like recording a payment. Same component, responsive.
- **WhatsApp send button.** Secondary button with the WhatsApp glyph in its own green (`#25D366`) only on the icon. Label: "Send reminder".
- **Toast.** `forest` background, white text. Bottom on mobile, bottom-right on desktop. Confirms using the action's own verb: "Payment recorded", "Student archived".
- **File row.** File-type icon, name, size and uploader in meta, download on tap. Folders first, then files, alphabetical.

## 9. Key screens

- **Dashboard.** Greeting, deadline strip, three numbers (active students, unpaid this month, next exam), then "Needs attention" list.
- **Students.** Search, filter by course and level, row list, "Add student".
- **Student detail.** Header (name, level, guardian phone with WhatsApp button), tabs: Courses, Payments, Exams, Portal access.
- **Course detail.** Tabs: Students, Files. Files tab shows folders.
- **Exam session.** Header with exam date and BC deadline, summary (registered / paid / total owed to BC), row list with filters (All, Unpaid, Paid), actions: "Register students", "Export for BC", "Mark as sent to BC".
- **Record payment.** Student picker → outstanding charges with checkboxes → amount → method → save → receipt preview with "Share receipt".
- **Receipt (PDF and share image).** Institute name and logo, receipt number, date, student, items, total, method. Small "Made with TuitionDesk" footer using the single-colour wordmark.
- **Student detail → Portal access.** Shows linked guardians with "Invite parent" / "Resend invite", invite status (Not invited, Invited, Joined), and a toggle for the student's own login.

### Portal screens
- **Sign in and Join.** The only portal screens that carry TuitionDesk branding: mint gradient background, default wordmark, white form panel.
- **Join (`/join/<token>`).** Institute logo, "Kavindu's class at <Institute> uses TuitionDesk", fields: your name, password, confirm. Phone shown read-only. One button: "Create account". Expired link: "This link has expired. Ask your class to send a new one."
- **Sign in.** Phone and password, "Forgot password?" explains that the class can send a new link.
- **Home.** Per child, in order: next exam (exam name, date, days to go), fees (one line: "All paid" in blue with a check, or "LKR 38,000 due by 15 Nov" in amber or red), new files (up to 3, "See all"). If nothing is due and no exam is booked, say so plainly: "Nothing due. No exams booked yet."
- **Courses.** Course rows (name, level, teacher). Tap → folders and files. Audio files get an inline player; other files open or download.
- **Exams.** Session rows with date, candidate number once set ("Candidate no. pending" in `slate` until then), result when entered.
- **Fees.** Outstanding charges first with status badges, then payment history; each payment has "View receipt".

### Portal components
- **Child switcher.** Compact dropdown in the header showing the child's initials and first name. Hidden when only one child.
- **Exam countdown.** The portal's one prominent element: exam name in `h2`, date below, large number of days to go in `display` size, `forest`. In the final 7 days the number turns amber. On the day: "Today, good luck!"
- **Audio player.** Native `<audio controls>` styled minimally, full width, with the file name above. Listening practice matters for these exams.
- **Installation prompt.** After the second visit, a dismissible bottom banner: "Add <Institute> to your home screen for quick access." Never shown again once dismissed.

## 10. Voice and copy

- Plain, short, polite. Write for a busy tutor, not a developer.
- Empty states tell people what to do next:
  - Students: "No students yet. Add your first student to start tracking fees."
  - Files: "No files in this course. Upload past papers or worksheets for your students."
- Errors say what happened and how to fix it, without apologizing: "That phone number looks incomplete. Use 10 digits, like 0771234567."
- Messages to parents are respectful: "Dear Parent, a kind reminder that…"
- In the portal, write to the parent about their child by name: "Kavindu's fees", "Kavindu's next exam". For a student's own login, use "Your fees", "Your next exam".
- Portal vocabulary is simpler than admin: "Fees" not "Charges", "Classes" or the course name, never "Enrollments", "Remittance", or "Allocations".
- Dates: `12 Dec 2026`. Money: `LKR 38,000.00` (drop `.00` in lists: `LKR 38,000`).
- Use "Sent to BC" for remitted sessions. Never use Cambridge or British Council logos or colours.

## 11. Accessibility and motion

- Visible focus ring on everything: 2px `forest` outline, 2px offset. On `forest` backgrounds, use a `mint` ring.
- All icon-only buttons have `aria-label`.
- Respect `prefers-reduced-motion`.
- Motion only responds to actions: sheets slide up (200ms ease-out), toasts fade in. No entrance animations on page load.
- Motion follows the `apple-design` skill (Apple's fluid-interface rules, `~/.claude/skills/apple-design`):
  - **Press feedback on the press, not the release.** Buttons scale to 0.96 over 150ms ease-out while held (`better-ui`) (`[data-slot="button"]` or the `press` class); rows highlight on press (`pressable`).
  - **Sheets leave the way they came.** On phones a sheet rises from the bottom and goes back down; from md up a dialog grows from 96% and fades. Classes `sheet-motion` and `backdrop-motion` in `globals.css`.
  - **Sheets can be swiped down** by their grab bar: 1:1 tracking, rubber band when pulled up, flick speed decides close or stay (`components/ui/use-sheet-drag.ts`). Not while saving.
  - **Feedback fires together.** The attendance scan shows the result, beeps and (on Android) buzzes on the same frame.
  - **Reduced motion** turns slides and scales into a short cross-fade; nothing bounces.

## 12. PWA and icons

- `manifest.json`: `name` "TuitionDesk", `theme_color` `#00472A`, `background_color` `#F6F9F7`.
- Icons from the icon version (§3): 192px, 512px, and a maskable 512px with the asterisk inside the safe zone.
- Favicon: 32px and 16px PNGs plus an SVG, all from the icon version with the heavier stroke.
- Splash: mint gradient with the default wordmark centred.

## 13. Tailwind / shadcn theme

Put this in `app/globals.css` (Tailwind v4):

```css
@import "tailwindcss";

:root {
  --forest: #00472A;
  --forest-hover: #005C37;
  --mint: #4EF5A3;
  --mint-soft: #E4FBEF;
  --ink: #12261C;
  --slate: #5A6B63;
  --line: #DFE7E2;
  --paper: #F6F9F7;
  --surface: #FFFFFF;
  --amber: #F59E0B;

  --status-paid-fg: #1D4ED8;    --status-paid-bg: #DBEAFE;
  --status-due-fg: #B45309;     --status-due-bg: #FEF3C7;
  --status-overdue-fg: #B91C1C; --status-overdue-bg: #FEE2E2;
  --status-muted-fg: #475569;   --status-muted-bg: #F1F5F9;
  --status-sent-fg: #6D28D9;    --status-sent-bg: #EDE9FE;

  /* shadcn mappings */
  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--surface);
  --card-foreground: var(--ink);
  --popover: var(--surface);
  --popover-foreground: var(--ink);
  --primary: var(--forest);
  --primary-foreground: #FFFFFF;
  --secondary: var(--surface);
  --secondary-foreground: var(--forest);
  --muted: #EEF3F0;
  --muted-foreground: var(--slate);
  --accent: var(--mint-soft);
  --accent-foreground: var(--forest);
  --destructive: #B91C1C;
  --border: var(--line);
  --input: var(--line);
  --ring: var(--forest);
  --radius: 10px;
}

@theme inline {
  --color-forest: var(--forest);
  --color-forest-hover: var(--forest-hover);
  --color-mint: var(--mint);
  --color-mint-soft: var(--mint-soft);
  --color-ink: var(--ink);
  --color-slate: var(--slate);
  --color-line: var(--line);
  --color-paper: var(--paper);
  --color-surface: var(--surface);
  --color-amber: var(--amber);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --font-heading: var(--font-jakarta), system-ui, sans-serif;
  --font-sans: var(--font-inter), "Noto Sans Sinhala", "Noto Sans Tamil", system-ui, sans-serif;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
}

body {
  background: var(--paper);
  color: var(--ink);
}

h1, h2, h3 { color: var(--forest); font-family: var(--font-heading); }

.tabular { font-variant-numeric: tabular-nums; }

.bg-brand-gradient {
  background: linear-gradient(135deg, #BFFFDD 0%, #F0FDF6 100%);
}
```