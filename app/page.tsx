"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, ImagePlus, X, Bot, User, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string; // base64 preview for display
  imageMimeType?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setImage({ base64, mimeType: file.type, preview: result });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !image) return;
    if (loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text || "(image attached)",
      image: image?.preview,
      imageMimeType: image?.mimeType,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setImage(null);
    setLoading(true);

    // Placeholder for assistant
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          imageBase64: image?.base64 ?? null,
          imageMimeType: image?.mimeType ?? null,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "⚠️ Something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, image, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  return (
    <div className="flex flex-col h-screen bg-[#11111b] text-[#cdd6f4]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#313244] bg-[#181825]">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#89b4fa] to-[#cba6f7] flex items-center justify-center">
          <Bot size={18} className="text-[#11111b]" />
        </div>
        <div>
          <h1 className="font-semibold text-sm text-[#cdd6f4]">AI Chat</h1>
          <p className="text-xs text-[#6c7086]">Llama 4 · Powered by Groq</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#a6e3a1] animate-pulse" />
          <span className="text-xs text-[#6c7086]">Online</span>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#89b4fa] to-[#cba6f7] flex items-center justify-center">
              <Bot size={32} className="text-[#11111b]" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[#cdd6f4]">How can I help?</h2>
              <p className="text-sm text-[#6c7086] mt-1">Ask anything. Send text or images.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[#11111b] ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[#89dceb] to-[#89b4fa]"
                  : "bg-gradient-to-br from-[#89b4fa] to-[#cba6f7]"
              }`}
            >
              {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#89b4fa] text-[#11111b] rounded-tr-sm"
                  : "bg-[#1e1e2e] border border-[#313244] text-[#cdd6f4] rounded-tl-sm"
              }`}
            >
              {msg.image && (
                <img
                  src={msg.image}
                  alt="attachment"
                  className="rounded-lg mb-2 max-h-48 max-w-full object-contain"
                />
              )}
              {msg.role === "assistant" && msg.content === "" && loading ? (
                <div className="flex gap-1 items-center h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#89b4fa] animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#89b4fa] animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#89b4fa] animate-bounce [animation-delay:300ms]" />
                </div>
              ) : msg.role === "assistant" ? (
                <div className="prose-chat">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <div className="border-t border-[#313244] bg-[#181825] px-4 py-3">
        {/* Image preview */}
        {image && (
          <div className="relative inline-block mb-2">
            <img
              src={image.preview}
              alt="preview"
              className="h-16 w-16 object-cover rounded-lg border border-[#313244]"
            />
            <button
              onClick={() => setImage(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#f38ba8] flex items-center justify-center"
            >
              <X size={10} className="text-white" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Image upload */}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-xl bg-[#313244] hover:bg-[#45475a] flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
            title="Attach image"
          >
            <ImagePlus size={18} className="text-[#89b4fa]" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message AI... (Enter to send, Shift+Enter for newline)"
            rows={1}
            className="flex-1 bg-[#313244] rounded-xl px-4 py-2.5 text-sm text-[#cdd6f4] placeholder-[#6c7086] resize-none outline-none focus:ring-1 focus:ring-[#89b4fa] min-h-[40px] max-h-[160px]"
          />

          {/* Send */}
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !image)}
            className="w-9 h-9 rounded-xl bg-[#89b4fa] hover:bg-[#b4d0fb] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
          >
            {loading ? (
              <Loader2 size={16} className="text-[#11111b] animate-spin" />
            ) : (
              <Send size={16} className="text-[#11111b]" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-[#45475a] text-center mt-2">
          AI can make mistakes. Verify important info.
        </p>
      </div>
    </div>
  );
}
