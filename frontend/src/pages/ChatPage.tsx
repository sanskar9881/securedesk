import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import api from "../api/axios";
import toast from "react-hot-toast";
import {
  Send, Plus, Trash2, MessageSquare, Shield, Bot, User, Sparkles
} from "lucide-react";

interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

interface Conversation {
  _id: string;
  title: string;
  updated_at: string;
}

const SUGGESTIONS = [
  { icon: "🔍", text: "How do I spot a phishing email?" },
  { icon: "🛡️", text: "What makes a file transaction suspicious?" },
  { icon: "🔐", text: "Best practices for corporate data security" },
  { icon: "📊", text: "How does the risk score work?" },
  { icon: "🚀", text: "What features does SecureDesk offer?" },
  { icon: "⚠️", text: "I received a suspicious email, help me check it" },
];

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const loadConversations = async () => {
    try {
      const { data } = await api.get("/chat/conversations");
      setConversations(data);
    } catch { /* ignore */ }
  };

  const newConversation = async (firstMessage?: string) => {
    try {
      const { data } = await api.post("/chat/conversation", { title: "New Conversation" });
      await loadConversations();
      await openConversation(data.conversation_id);
      if (firstMessage) {
        // Small delay to let conversation load
        setTimeout(() => {
          setInput(firstMessage);
          inputRef.current?.focus();
        }, 100);
      }
      return data.conversation_id;
    } catch {
      toast.error("Failed to start conversation");
    }
  };

  const openConversation = async (id: string) => {
    setActiveConv(id);
    setLoadingConv(true);
    try {
      const { data } = await api.get(`/chat/conversation/${id}`);
      setMessages(data.messages || []);
    } catch {
      toast.error("Failed to load conversation");
    } finally {
      setLoadingConv(false);
    }
  };

  const deleteConv = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/conversation/${id}`);
      if (activeConv === id) { setActiveConv(null); setMessages([]); }
      await loadConversations();
    } catch { /* ignore */ }
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || !activeConv || sending) return;
    setInput("");
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempUserMsg: Message = {
      id: tempId,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const { data } = await api.post(`/chat/conversation/${activeConv}/message`, {
        message: text,
      });
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.user_message,
        data.assistant_message,
      ]);
      loadConversations();
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Message failed. Try again.");
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleSuggestion = async (text: string) => {
    let convId = activeConv;
    if (!convId) {
      const newId = await newConversation();
      convId = newId || null;
      if (!convId) return;
      // Wait for conversation to be set
      await new Promise(r => setTimeout(r, 200));
    }
    setInput(text);
    setTimeout(() => sendMessage(text), 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (activeConv) sendMessage();
    }
  };

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  };

  // Render message content with basic markdown-like formatting
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="flex">
      <Navbar />
      <main className="ml-64 flex-1 min-h-screen bg-gray-950 flex overflow-hidden" style={{ height: "100vh" }}>

        {/* Sidebar */}
        <div className="w-60 border-r border-gray-800 flex flex-col bg-gray-900/40 flex-shrink-0">
          <div className="p-3 border-b border-gray-800">
            <button
              onClick={() => newConversation()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {conversations.length === 0 ? (
              <p className="text-gray-600 text-xs text-center mt-6 px-3">
                No chats yet.<br />Start a new conversation!
              </p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv._id}
                  onClick={() => openConversation(conv._id)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition group ${
                    activeConv === conv._id
                      ? "bg-indigo-600/20 border border-indigo-600/30"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  <span className={`flex-1 text-xs truncate ${activeConv === conv._id ? "text-indigo-300" : "text-gray-400"}`}>
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => deleteConv(conv._id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-600 hover:text-red-400 transition flex-shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>
              ))
            )}
          </div>

          <div className="p-3 border-t border-gray-800">
            <p className="text-gray-700 text-xs text-center">SecureDesk AI v2.0</p>
            <p className="text-gray-800 text-xs text-center">Built with love from Sanskar Hadole</p>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeConv ? (
            /* Welcome screen */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center overflow-y-auto">
              <div className="w-16 h-16 bg-indigo-600/20 border border-indigo-600/30 rounded-2xl flex items-center justify-center mb-5">
                <Sparkles className="w-8 h-8 text-indigo-400" />
              </div>
              <h2 className="text-white text-2xl font-bold mb-2">SecureDesk AI</h2>
              <p className="text-gray-500 text-sm mb-8 max-w-md">
                Your cybersecurity assistant. Ask anything about phishing, data protection, file security, or how to use SecureDesk.
              </p>

              <div className="grid grid-cols-2 gap-3 max-w-lg w-full mb-8">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestion(s.text)}
                    className="bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-indigo-700/50 rounded-xl px-4 py-3 text-left transition group"
                  >
                    <span className="text-lg block mb-1">{s.icon}</span>
                    <span className="text-gray-300 group-hover:text-white text-xs transition">{s.text}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => newConversation()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition"
              >
                <Plus className="w-4 h-4" />
                Start New Conversation
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="border-b border-gray-800 px-6 py-3 flex items-center gap-3 bg-gray-900/30">
                <div className="w-8 h-8 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">SecureDesk AI</p>
                  <p className="text-green-400 text-xs flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block animate-pulse" />
                    Online
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {loadingConv ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <Bot className="w-10 h-10 text-gray-700 mb-3" />
                    <p className="text-gray-500 text-sm">Send a message to start chatting</p>
                    <p className="text-gray-700 text-xs mt-1">Ask about cybersecurity, phishing, or SecureDesk features</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className={`flex items-end gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        msg.role === "user" ? "bg-indigo-600" : "bg-gray-700/80"
                      }`}>
                        {msg.role === "user"
                          ? <User className="w-3.5 h-3.5 text-white" />
                          : <Bot className="w-3.5 h-3.5 text-gray-300" />
                        }
                      </div>
                      <div className={`max-w-[72%] group`}>
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white rounded-br-sm"
                            : "bg-gray-800 text-gray-200 rounded-bl-sm"
                        }`}>
                          {renderContent(msg.content)}
                        </div>
                        <p className={`text-gray-700 text-xs mt-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {/* Typing indicator */}
                {sending && (
                  <div className="flex items-end gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-gray-700/80 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                    <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3">
                      <span className="flex gap-1 items-center h-4">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick suggestions */}
              <div className="px-6 py-2 border-t border-gray-800/50">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {["What is phishing?", "Check my file risk", "Security tips", "How to report a threat"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(() => sendMessage(q), 50); }}
                      disabled={sending}
                      className="flex-shrink-0 bg-gray-800/60 hover:bg-gray-700 border border-gray-700/50 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-full transition disabled:opacity-40"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input area */}
              <div className="border-t border-gray-800 p-4">
                <div className="flex items-end gap-3 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 focus-within:border-indigo-500/70 transition">
                  <textarea
                    ref={(el) => {
                      (inputRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                      (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                    }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about cybersecurity, phishing, data protection..."
                    rows={1}
                    className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm resize-none focus:outline-none leading-relaxed"
                    style={{ maxHeight: "120px", minHeight: "24px" }}
                    disabled={sending}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={sending || !input.trim()}
                    className="w-8 h-8 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center flex-shrink-0 transition"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <p className="text-gray-700 text-xs text-center mt-2">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}