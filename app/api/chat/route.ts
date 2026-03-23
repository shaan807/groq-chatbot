import Groq from "groq-sdk";
import { NextRequest } from "next/server";

export const runtime = "edge";

interface Message {
  role: "user" | "assistant" | "system";
  content: string | ContentPart[];
}

interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export async function POST(req: NextRequest) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { messages, imageBase64, imageMimeType } = await req.json();

    // Build the messages array for Groq
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const groqMessages: any[] = [
      {
        role: "system",
        content:
          "You are a helpful, knowledgeable AI assistant. Be concise but thorough. Use markdown formatting when helpful.",
      },
    ];

    // Add previous messages (text only for history)
    for (let i = 0; i < messages.length - 1; i++) {
      groqMessages.push({
        role: messages[i].role,
        content: messages[i].content,
      });
    }

    // Add the latest user message (may include image)
    const lastMessage = messages[messages.length - 1];
    if (imageBase64 && imageMimeType) {
      groqMessages.push({
        role: "user",
        content: [
          { type: "text", text: lastMessage.content },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageMimeType};base64,${imageBase64}`,
            },
          },
        ],
      });
    } else {
      groqMessages.push({
        role: "user",
        content: lastMessage.content,
      });
    }

    const stream = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: groqMessages,
      stream: true,
      max_tokens: 2048,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Groq API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get response from AI" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
