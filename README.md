# AI Chatbot — Free Forever

A modern AI chatbot with image support, powered by **Groq** (free) + **Llama 4 Scout** (vision model).

## Features
- 💬 Streaming chat responses
- 🖼️ Image input (vision model)
- 🌙 Dark theme UI
- 📱 Mobile responsive
- ⚡ Edge runtime — blazing fast

## Deploy to Vercel (Free)

### Step 1 — Get Groq API Key
1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free, no credit card)
3. Create an API key

### Step 2 — Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variable:
   - Key: `GROQ_API_KEY`
   - Value: your key from Step 1
4. Click Deploy — done!

## Local Development

```bash
cp .env.local.example .env.local
# Add your GROQ_API_KEY to .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Stack
- Next.js 14 (App Router)
- Groq SDK (Llama 4 Scout — vision model)
- Tailwind CSS
- React Markdown

## Rate Limits (Free Tier)
Groq free tier: 30 req/min, 14,400 req/day — more than enough for personal use.
