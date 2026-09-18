<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00C9A7,100:6C5CE7&height=220&section=header&text=Evenly&fontSize=70&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Split%20and%20Settle%2C%20effortlessly&descAlignY=58&descSize=20" width="100%"/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=20&duration=3000&pause=800&color=6C5CE7&center=true&vCenter=true&width=650&lines=Create+a+tab.+Add+friends.+Settle+up.;Track+group+funds+with+Ambag+%2F+Kitty+pooling;Real-time+exact+split+allocation+as+you+type;No+accounts.+No+setup.+Just+split.;Built+with+Next.js+%2B+Supabase+%E2%9A%A1" alt="Typing SVG" />

<br/>

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/TailwindCSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

<img src="https://img.shields.io/badge/status-live-brightgreen?style=for-the-badge&logo=vercel" />
<img src="https://img.shields.io/github/last-commit/edmarcoabel/evenly?style=for-the-badge&color=6C5CE7" />

</div>

---

## 💸 About Evenly

Evenly is a personal project built to solve a simple but common problem: splitting money when going out with friends.

After a meal, trip, or gala, figuring out who paid, who owes who, and how much everyone needs to send can get confusing. **Evenly makes the process simple** — create a tab, record expenses, see everyone's balance, and settle up.

> No accounts. No complicated setup. Just share the tab and go.

---

## ✨ Features

### 🧾 Core Splitting

<table>
<tr>
<td width="50%">

**💸 Equal & Custom Splits**
Split expenses evenly or assign exact amounts.

**🔢 Real-Time Exact Split Allocation**
Live `₱X.XX remaining` display updates as you type, with dynamic status badges — green when fully matched, amber when under-allocated, rose when over-allocated. A `+Remaining` shortcut instantly assigns any leftover balance to a member.

**🧮 Debt Simplification**
Calculates simpler ways to settle group balances, minimizing the number of transactions needed.

</td>
<td width="50%">

**⚡ Real-Time Sync**
Changes update instantly across devices via Supabase Realtime.

**👥 Member Management**
Add or remove members while protecting outstanding balances.

**📜 Payment History**
Keep track of completed settlements and undo mistakes.

</td>
</tr>
</table>

### 🐖 Group Fund / Ambag (Kitty) Tracking

- Support for upfront pool contributions, whether even or uneven.
- Designate a group treasurer/collector to manage the pool.
- Real-time dashboard calculating **Collected**, **Spent**, and **Remaining in Pool**.
- Automatic refund calculations built into the suggested settle-up flow.

### 🏠 Homepage & Tab Management

- **Recent Tabs Settlement Status Badges** — live status tags on the homepage showing *"All settled"* or *"₱X.XX unsettled"*, calculated from real-time balances.
- **Inline Tab Renaming** — quick-edit button next to the tab name in the header, syncing renames instantly across Supabase and local browser history.
- **Shareable Tabs** — create a tab and share it with friends, no account required.
- Dedicated `/new` route for fast tab generation.

### 📱 Payments & PWA

- **GCash, Maya & QR Ph** — add payment details or upload a personal QR code.
- **Installable PWA** — add Evenly to your phone's home screen and use it like a native app.
- **Dark & Light Mode** — responsive UI with persistent theme preferences.

### ⚙️ Behind the Scenes

- **Client-Side Storage Optimization** — uploaded QR codes are automatically resized and compressed to ~50 KB WebP to stay well within Supabase free-tier limits.
- **Automatic File Cleanup** — orphaned QR images in storage are cleaned up whenever an image is replaced or a tab/member is deleted.

---

## 🛠️ Built With

<div align="center">
<img src="https://skillicons.dev/icons?i=nextjs,ts,tailwind,react,supabase,postgres,vercel&theme=dark" />
</div>

<div align="center">

| Frontend | Backend | Deployment | Other |
|---|---|---|---|
| Next.js | Supabase | Vercel | qrcode.react |
| TypeScript | PostgreSQL | | |
| Tailwind CSS | Supabase Realtime | | |
| Lucide React | Supabase Storage | | |
| PWA (manifest + service worker) | | | |

</div>

---

## 🔄 How It Works

```mermaid
%%{init: {'theme':'dark', 'themeVariables': { 'primaryColor':'#6C5CE7','edgeLabelBackground':'#0d1117'}}}%%
graph TD
    A[🧾 Create a Tab] --> B[👥 Add Friends]
    B --> C[🐖 Pool Ambag / Kitty]
    C --> D[💵 Record Expenses]
    D --> E[📊 Calculate Balances]
    E --> F[🧮 Simplify Debts]
    F --> G[💸 Settle Up]
    G -.loop.-> D
```

---

## 🚀 Deployment

Evenly is deployed with **Vercel**, with **Supabase** handling the database, real-time synchronization, and QR code storage.

<div align="center">
<img src="https://img.shields.io/badge/status-live-brightgreen?style=for-the-badge&logo=vercel" />
<img src="https://img.shields.io/github/last-commit/edmarcoabel/evenly?style=for-the-badge&color=6C5CE7" />
</div>

---

## 🎨 Branding & Identity

- Official Evenly SVG logo, replacing the temporary header emoji.
- Minimalist creator signature — *"Built by EJO"* — in the homepage footer.

---

## 👨‍💻 Personal Project

Built by **Edmarc Justin C. Oabel** as a personal project to explore full-stack web development while creating something useful for everyday situations.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6C5CE7,100:00C9A7&height=120&section=footer"/>

</div>
