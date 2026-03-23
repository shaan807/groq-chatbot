"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Send, ImagePlus, X, Bot, User, Loader2, FileText, Paperclip } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  fileName?: string;
  fileType?: "image" | "pdf" | "doc";
}

interface AttachedFile {
  name: string;
  type: "image" | "pdf" | "doc";
  // for image
  base64?: string;
  mimeType?: string;
  preview?: string;
  // for pdf/doc — extracted text
  text?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<AttachedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const extractPdfText = async (file: File): Promise<string> => {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: unknown) => (item as { str: string }).str).join(" ");
      fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    return fullText.trim();
  };

  const extractDocText = async (file: File): Promise<string> => {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setAttached({
          name: file.name,
          type: "image",
          base64: result.split(",")[1],
          mimeType: file.type,
          preview: result,
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type === "application/pdf" || ext === "pdf") {
      setExtracting(true);
      try {
        const text = await extractPdfText(file);
        setAttached({ name: file.name, type: "pdf", text });
      } catch {
        alert("Failed to read PDF. Please try another file.");
      } finally {
        setExtracting(false);
      }
    } else if (
      ext === "docx" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "doc"
    ) {
      setExtracting(true);
      try {
        const text = await extractDocText(file);
        setAttached({ name: file.name, type: "doc", text });
      } catch {
        alert("Failed to read document. Please try another file.");
      } finally {
        setExtracting(false);
      }
    } else {
      alert("Supported formats: Images, PDF, DOCX");
    }
  };

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text && !attached) return;
    if (loading) return;

    let userContent = text;

    // For PDF/doc, prepend the file content as context
    let contextPrefix = "";
    if (attached?.type === "pdf" || attached?.type === "doc") {
      contextPrefix = `[File: ${attached.name}]\n\`\`\`\n${attached.text}\n\`\`\`\n\n`;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userContent || "(file attached)",
      image: attached?.type === "image" ? attached.preview : undefined,
      fileName: attached?.type !== "image" ? attached?.name : undefined,
      fileType: attached?.type,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setAttached(null);
    setLoading(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    // Build messages for API — inject file text into last user message
    const apiMessages = updatedMessages.map((m, i) => {
      if (i === updatedMessages.length - 1 && contextPrefix) {
        return { role: m.role, content: contextPrefix + (text || "Please summarize or describe this file.") };
      }
      return { role: m.role, content: m.content };
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          imageBase64: attached?.type === "image" ? attached.base64 : null,
          imageMimeType: attached?.type === "image" ? attached.mimeType : null,
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
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "⚠️ Something went wrong. Please try again." } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }, [input, attached, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  const fileIcon = (type?: "image" | "pdf" | "doc") => {
    if (type === "pdf") return "📄";
    if (type === "doc") return "📝";
    return "🖼️";
  };

  return (
    <div className="flex flex-col h-screen bg-[#11111b] text-[#cdd6f4]">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-[#313244] bg-[#181825]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#89b4fa] to-[#cba6f7] flex items-center justify-center font-bold text-[#11111b] text-lg">
          Z
        </div>
        <div>
          <h1 className="font-bold text-sm text-[#cdd6f4] tracking-wide">Zam</h1>
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
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#89b4fa] to-[#cba6f7] flex items-center justify-center font-bold text-[#11111b] text-3xl">
              Z
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#cdd6f4]">Hey, I&apos;m Zam</h2>
              <p className="text-sm text-[#6c7086] mt-1">Ask me anything. Send text, images, PDFs, or docs.</p>
            </div>
            <div className="flex gap-2 flex-wrap justify-center mt-2">
              {["Explain quantum computing", "Write a Python script", "Summarize a document"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs bg-[#1e1e2e] border border-[#313244] rounded-full px-3 py-1.5 text-[#89b4fa] hover:border-[#89b4fa] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div
              className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[#11111b] font-bold text-sm ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[#89dceb] to-[#89b4fa]"
                  : "bg-gradient-to-br from-[#89b4fa] to-[#cba6f7]"
              }`}
            >
              {msg.role === "user" ? <User size={14} /> : "Z"}
            </div>

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#89b4fa] text-[#11111b] rounded-tr-sm"
                  : "bg-[#1e1e2e] border border-[#313244] text-[#cdd6f4] rounded-tl-sm"
              }`}
            >
              {/* Image preview */}
              {msg.image && (
                <img src={msg.image} alt="attachment" className="rounded-lg mb-2 max-h-48 max-w-full object-contain" />
              )}
              {/* File badge */}
              {msg.fileName && (
                <div className="flex items-center gap-1.5 mb-2 bg-black/10 rounded-lg px-2 py-1 w-fit">
                  <span>{fileIcon(msg.fileType)}</span>
                  <span className="text-xs font-medium truncate max-w-[180px]">{msg.fileName}</span>
                </div>
              )}
              {/* Content */}
              {msg.role === "assistant" && msg.content === "" && loading ? (
                <div className="flex gap-1 items-center h-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#89b4fa] animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#89b4fa] animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#89b4fa] animate-bounce [animation-delay:300ms]" />
                </div>
              ) : msg.role === "assistant" ? (
                <div className="prose-chat"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <div className="border-t border-[#313244] bg-[#181825] px-4 py-3">
        {/* Attachment preview */}
        {attached && (
          <div className="relative inline-flex items-center gap-2 mb-2 bg-[#313244] rounded-xl px-3 py-2 pr-8">
            {attached.type === "image" ? (
              <img src={attached.preview} alt="preview" className="h-8 w-8 object-cover rounded-lg" />
            ) : (
              <span className="text-lg">{fileIcon(attached.type)}</span>
            )}
            <span className="text-xs text-[#cdd6f4] truncate max-w-[160px]">{attached.name}</span>
            <button
              onClick={() => setAttached(null)}
              className="absolute right-1.5 top-1.5 w-4 h-4 rounded-full bg-[#f38ba8] flex items-center justify-center"
            >
              <X size={8} className="text-white" />
            </button>
          </div>
        )}

        {extracting && (
          <div className="flex items-center gap-2 mb-2 text-xs text-[#6c7086]">
            <Loader2 size={12} className="animate-spin" />
            Extracting text from file...
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attach button */}
          <button
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-xl bg-[#313244] hover:bg-[#45475a] flex items-center justify-center transition-colors flex-shrink-0 mb-0.5"
            title="Attach image, PDF, or DOCX"
          >
            <Paperclip size={17} className="text-[#89b4fa]" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileSelect}
          />

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Zam... (Enter to send)"
            rows={1}
            className="flex-1 bg-[#313244] rounded-xl px-4 py-2.5 text-sm text-[#cdd6f4] placeholder-[#6c7086] resize-none outline-none focus:ring-1 focus:ring-[#89b4fa] min-h-[40px] max-h-[160px]"
          />

          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !attached)}
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
          Supports images · PDFs · Word docs · Zam can make mistakes
        </p>
      </div>
    </div>
  );
}
