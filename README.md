# Zam

A free AI chatbot powered by Groq and Llama 4. Supports text, images, PDFs, and Word documents.

Live at [zam-ai.vercel.app](https://zam-ai.vercel.app)

---

## Features

- Streaming chat responses
- Image understanding (vision model)
- PDF and DOCX file reading
- Dark theme UI
- Mobile responsive
- Edge runtime

---

## Stack

- Next.js 14 (App Router)
- Groq SDK — Llama 4 Scout (vision model)
- Tailwind CSS
- React Markdown
- pdfjs-dist (PDF parsing)
- mammoth (DOCX parsing)

---

## Self-hosting

### 1. Get a Groq API key

Sign up at [console.groq.com](https://console.groq.com). Free, no credit card required.

### 2. Clone and run locally

```bash
git clone https://github.com/shaan807/groq-chatbot.git
cd groq-chatbot
cp .env.local.example .env.local
# Add your GROQ_API_KEY to .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Deploy to Vercel

1. Import the repo at [vercel.com/new](https://vercel.com/new)
2. Add environment variable: `GROQ_API_KEY`
3. Deploy

---

## Rate limits (free tier)

Groq free tier allows 30 requests per minute and 14,400 requests per day. Sufficient for personal use.
