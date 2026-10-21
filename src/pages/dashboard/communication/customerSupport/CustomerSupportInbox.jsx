import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { customerChatApi as api, uploadCustomerChatFile } from "../../../../utils/customerChatApi";
import SupportAttachment from "./SupportAttachment";
import SupportBookingDialog from "./SupportBookingDialog";
import { messageCategory, currentChatCategory } from "../../../../utils/supportCategory";
import {
  HotelIcon,
  CloseIcon,
  RefreshIcon,
  CheckIcon,
  ForumIcon,
  ImageIcon,
  DescriptionIcon,
  Search,
  PersonIcon,
  CalendarMonthIcon,
} from "@icons";
import "./customerSupport.css";

const services = ["hotel", "sightseeing", "car", "selfDrive"];
const serviceIcon = (s) => {
  switch (s) {
    case "hotel":
      return "🏨";
    case "sightseeing":
      return "🏞️";
    case "car":
      return "🚗";
    case "selfDrive":
      return "🚙";
    default:
      return "📋";
  }
};
const serviceLabels = {
  hotel: "Hotels",
  sightseeing: "Sightseeing",
  car: "Cars",
  selfDrive: "Self Drive",
};

const formatShortRef = (ref) => {
  if (!ref) return "N/A";
  const str = String(ref).trim();
  if (str.length <= 9) return str.toUpperCase();
  if (str.includes("-")) {
    const parts = str.split("-");
    const prefix = parts[0];
    const rest = parts.slice(1).join("");
    return `${prefix.slice(0, 4)}-${rest.slice(-5)}`.toUpperCase();
  }
  return `${str.slice(0, 4)}…${str.slice(-4)}`.toUpperCase();
};

const formatBookingDate = (dateVal) => {
  if (!dateVal) return "Date pending";
  try {
    let d;
    if (typeof dateVal === "number" || (!isNaN(dateVal) && !isNaN(parseFloat(dateVal)) && String(dateVal).trim().length >= 10)) {
      d = new Date(Number(dateVal));
    } else {
      d = new Date(dateVal);
    }
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  } catch (_) {}
  const clean = String(dateVal).split("T")[0];
  return clean || "Date pending";
};

const unique = (items) => [...new Map(items.map((item) => [item.id, item])).values()];

export default function CustomerSupportInbox({
  initialCustomerId,
  initialCustomerName,
  initialBooking,
  isDrawer = false,
  onClose,
}) {
  const [searchParams] = useSearchParams();
  const urlCustomerId = searchParams.get("customerId");
  const targetCustomerId = initialCustomerId || urlCustomerId;

  const [inbox, setInbox] = useState([]);
  const [inboxCursor, setInboxCursor] = useState(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [mobileView, setMobileView] = useState(targetCustomerId ? "chat" : "list");
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [booking, setBooking] = useState(initialBooking || null);
  const [reply, setReply] = useState(null);
  const [picker, setPicker] = useState(false);
  const [service, setService] = useState("hotel");
  const [bookings, setBookings] = useState([]);
  const [bookingCursor, setBookingCursor] = useState(null);
  const [bookingFilter, setBookingFilter] = useState("");
  const [loadingBookings, setLoadingBookings] = useState(false);
  const pickerRef = useRef(null);
  const [tab, setTab] = useState("messages");
  const [query, setQuery] = useState("");
  const [globalSearch, setGlobalSearch] = useState(false);
  const [searchRun, setSearchRun] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [bookingDetails, setBookingDetails] = useState(null);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const bookingRequest = useRef(0);
  const bookingSelection = useRef(null);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const timelineRef = useRef(null);
  const topSentinelRef = useRef(null);
  const initialScrolled = useRef(false);
  const scope = useRef(0);
  const retry = useRef(null);
  const tail = useRef(null);
  const historyLoaded = useRef(false);
  const uid = selected?.customerId;
  const report = (e) => setError(e.message || "Chat request failed. Please retry.");

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    api("open", {customerId: uid}).then(({conversation}) => {
      if (!alive) return;
      setInbox(previous => previous.some(item => item.customerId === uid)
        ? previous.map(item => item.customerId === uid ? conversation : item)
        : [conversation, ...previous]);
      setSelected(previous => previous?.customerId === uid ? conversation : previous);
    }).catch(error => { if (alive) report(error); });
    return () => { alive = false; };
  }, [uid]);

  // Close message 3-dot menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => setActiveMenuMessageId(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const loadInbox = useCallback(
    async (next = null) => {
      const result = await api("inbox", { ...(next ? { cursor: next } : {}) });
      setInbox((previous) =>
        next
          ? unique([...previous, ...result.items])
          : unique([
              ...result.items,
              ...previous.filter((item) => !result.items.some((fresh) => fresh.id === item.id)),
            ]),
      );
      if (next || !inboxCursor) setInboxCursor(result.nextCursor);
      setInboxLoading(false);
    },
    [inboxCursor],
  );

  useEffect(() => {
    let alive = true;
    let timer;
    async function poll() {
      try {
        if (!document.hidden) await loadInbox();
      } catch (e) {
        if (alive) {
          report(e);
          setInboxLoading(false);
        }
      }
      if (alive) timer = setTimeout(poll, 10000);
    }
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [loadInbox]);

  // Handle auto-selecting target customer
  useEffect(() => {
    if (!inbox.length && !targetCustomerId) return;
    if (targetCustomerId) {
      const found = inbox.find((item) => item.customerId === targetCustomerId);
      if (found) {
        setSelected(found);
        setMobileView("chat");
      } else if (!selected) {
        // Create placeholder conversation while it connects
        setSelected({
          id: targetCustomerId,
          customerId: targetCustomerId,
          customerName: initialCustomerName || "Guest",
          status: "open",
          lastMessage: "Conversation initiated",
        });
        setMobileView("chat");
      }
    } else {
      setSelected((current) => current || inbox[0]);
    }
  }, [inbox, targetCustomerId, initialCustomerName]);

  const loadMessages = useCallback(
    async (next = null) => {
      if (!uid) return;
      const generation = scope.current;
      if (next && tab === "messages") historyLoaded.current = true;
      const action = tab === "search" ? "search" : tab === "messages" ? "messages" : "shared";
      if (action === "search" && !searchRun) return;
      const result = await api(action, {
        customerId: uid,
        ...(next ? { cursor: next } : {}),
        ...(action === "shared" ? { category: tab } : {}),
        ...(action === "search" ? { query: searchRun, allCustomers: globalSearch } : {}),
      });
      if (scope.current !== generation) return;
      setMessages((previous) => (next ? unique([...previous, ...result.items]) : result.items));
      setCursor(result.nextCursor);
      if (!next && tab === "messages" && result.items.length) {
        await api("read", {
          customerId: uid,
          through: Math.max(...result.items.map((item) => item.createdAt)),
        });
      }
    },
    [uid, tab, searchRun, globalSearch],
  );

  useEffect(() => {
    scope.current += 1;
    setMessages([]);
    setMessagesLoading(!!uid);
    setCursor(null);
    historyLoaded.current = false;
    initialScrolled.current = false;
    let alive = true;
    let timer;
    async function poll() {
      try {
        if (!document.hidden && !historyLoaded.current) await loadMessages();
      } catch (e) {
        if (alive) report(e);
      } finally {
        if (alive) setMessagesLoading(false);
      }
      if (alive && tab === "messages") timer = setTimeout(poll, 5000);
    }
    poll();
    return () => {
      alive = false;
      clearTimeout(timer);
      scope.current += 1;
    };
  }, [loadMessages, tab, uid]);

  useEffect(() => {
    if (!picker || !uid) return;
    let alive = true;
    setBookings([]);
    setBookingCursor(null);
    setLoadingBookings(true);
    api("bookings", { customerId: uid, service })
      .then((result) => {
        if (alive) {
          setBookings(result.items);
          setBookingCursor(result.nextCursor);
        }
      })
      .catch((e) => {
        if (alive) report(e);
      })
      .finally(() => {
        if (alive) setLoadingBookings(false);
      });
    return () => {
      alive = false;
    };
  }, [picker, uid, service]);

  // Close booking command picker on outside click or Escape key
  useEffect(() => {
    if (!picker) return;
    const handleOutside = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        !e.target.closest(".booking-toggle-btn")
      ) {
        setPicker(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setPicker(false);
    };
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [picker]);

  // Auto-scroll to bottom on first load of a conversation
  useEffect(() => {
    if (messages.length && !initialScrolled.current && timelineRef.current) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
      initialScrolled.current = true;
    }
  }, [messages]);

  // Load older messages automatically with scroll position preservation
  const loadOlder = useCallback(async () => {
    if (!cursor || loadingOlder || !initialScrolled.current || !timelineRef.current) return;
    const container = timelineRef.current;
    const prevScrollHeight = container.scrollHeight;
    const prevScrollTop = container.scrollTop;
    setLoadingOlder(true);
    try {
      await loadMessages(cursor);
      requestAnimationFrame(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - prevScrollHeight + prevScrollTop;
        }
      });
    } catch (e) {
      report(e);
    } finally {
      setLoadingOlder(false);
    }
  }, [cursor, loadingOlder, loadMessages]);

  // Top sentinel intersection observer to auto-trigger loading older messages
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = timelineRef.current;
    if (!sentinel || !container || !cursor || !initialScrolled.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && cursor && !loadingOlder && initialScrolled.current) {
          loadOlder();
        }
      },
      { root: container, rootMargin: "60px 0px 0px 0px", threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadingOlder, loadOlder]);

  const handleTimelineScroll = (e) => {
    const container = e.currentTarget;
    if (container.scrollTop < 60 && cursor && !loadingOlder && initialScrolled.current) {
      loadOlder();
    }
  };

  async function chooseConversation(item) {
    scope.current += 1;
    initialScrolled.current = false;
    setSelected(item);
    setMobileView("chat");
    setDraft("");
    setFile(null);
    setBooking(null);
    setReply(null);
    setPicker(false);
    setTab("messages");
    setSearchRun("");
    setError("");
    closeBooking();
    retry.current = null;
  }

  async function send(e) {
    e.preventDefault();
    if (!uid || busy || (!draft.trim() && !file && !booking)) return;
    const generation = scope.current;
    setBusy(true);
    setError("");
    try {
      if (!retry.current)
        retry.current = {
          requestId: crypto.randomUUID(),
          customerId: uid,
          text: draft.trim(),
          booking,
          replyTo: reply?.id,
          file,
        };
      const pending = retry.current;
      if (pending.file && !pending.attachmentId)
        pending.attachmentId = (await uploadCustomerChatFile(uid, pending.file)).attachment.id;
      const { file: ignored, ...payload } = pending;
      void ignored;
      await api("send", payload);
      retry.current = null;
      if (generation === scope.current) {
        setDraft("");
        setFile(null);
        setBooking(null);
        setReply(null);
        setNotice("");
        await loadMessages();
        tail.current?.scrollIntoView({ behavior: "smooth" });
      }
      await loadInbox();
    } catch (e) {
      report(e);
      setNotice("Send failed. Retry sends the same message once. Cancel retry to change it.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus() {
    try {
      const currentConv = inbox.find((item) => item.customerId === uid) || selected;
      const status = currentConv?.status === "resolved" ? "open" : "resolved";
      await api("status", { customerId: uid, status });
      setSelected((previous) => ({ ...previous, status }));
      await loadInbox();
    } catch (e) {
      report(e);
    }
  }

  async function act(action, message) {
    if (
      action === "delete" &&
      !window.confirm("Delete this message and remove its attachment access?")
    )
      return;
    const value = action === "edit" ? window.prompt("Edit message", message.text) : null;
    if (action === "edit" && value === null) return;
    try {
      await api(action, {
        customerId: message.customerId,
        messageId: message.id,
        ...(action === "edit" ? { text: value } : {}),
      });
      await loadMessages();
      await loadInbox();
    } catch (e) {
      report(e);
    }
  }

  function closeBooking() {
    bookingRequest.current += 1;
    setBookingDialog(false);
    setBookingDetails(null);
  }

  async function showBooking(message) {
    const request = ++bookingRequest.current;
    bookingSelection.current = message;
    setBookingDialog(true);
    setBookingLoading(true);
    setBookingError("");
    setBookingDetails(message.booking);
    try {
      const result = await api("booking", {
        customerId: message.customerId,
        booking: message.booking,
      });
      if (request === bookingRequest.current) setBookingDetails(result.booking);
    } catch (e) {
      if (request === bookingRequest.current)
        setBookingError(e.message || "Could not load booking details.");
    } finally {
      if (request === bookingRequest.current) setBookingLoading(false);
    }
  }

  const locked = busy || !!retry.current;
  const ordered =
    tab === "messages"
      ? [...messages].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
      : messages;

  const activeConversation = inbox.find((item) => item.customerId === uid) || selected;
  const visibleInbox = inbox.filter(
    (item) =>
      (statusFilter === "all" || item.status === statusFilter) &&
      `${item.customerName || ""} ${item.customerId || ""}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className={`support-inbox bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col ${isDrawer ? "h-full rounded-none border-none" : "h-full shadow-xl"}`}>
      {/* Drawer Header (if in drawer mode) */}
      {isDrawer && (
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-sm border-b border-primary-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl text-white">
              <ForumIcon fontSize="small" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">Customer Support</h3>
              <p className="text-xs text-primary-100">
                {selected?.customerName || initialCustomerName || "Guest conversation"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
            aria-label="Close drawer"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-rose-50 border-b border-rose-200 text-rose-700 px-4 py-2.5 text-xs font-medium flex items-center justify-between shrink-0">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error" className="font-bold text-rose-800 p-1">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">
        {/* Sidebar - Conversations list */}
        <aside
          className={`${
            mobileView === "chat" ? "hidden md:flex" : "flex"
          } md:w-80 lg:w-96 border-r border-neutral-200 flex-col h-full bg-white flex-shrink-0`}
        >
          {/* Search & Filter Header */}
          <div className="p-3.5 border-b border-neutral-100 space-y-2.5 flex-shrink-0 bg-neutral-50/50">
            <div className="relative">
              <input
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 text-xs bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:outline-none transition-all placeholder:text-neutral-400"
                aria-label="Filter conversations"
                placeholder="Search conversations by name or ID…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
              <Search sx={{ fontSize: 16 }} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            </div>

            {/* Status Pills */}
            <div className="flex gap-1.5">
              {[
                { id: "all", label: "All" },
                { id: "open", label: "Open" },
                { id: "resolved", label: "Resolved" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                    statusFilter === pill.id
                      ? "bg-primary-50 text-primary-700 border border-primary-200 shadow-2xs"
                      : "bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-100"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="support-sidebar-list flex-1 overflow-y-auto p-2 space-y-1">
            {inboxLoading && (
              <div className="p-8 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                <span>Loading conversations…</span>
              </div>
            )}
            {!inboxLoading && !inbox.length && (
              <div className="p-8 text-center text-xs text-neutral-400">
                No conversations yet. Customers appear after initiating support in the app.
              </div>
            )}
            {!inboxLoading && inbox.length > 0 && !visibleInbox.length && (
              <div className="p-6 text-center text-xs text-neutral-400">
                No matching conversations. Try a different filter or search.
              </div>
            )}

            {visibleInbox.map((item) => {
              const isSelected = uid === item.customerId;
              const isResolved = item.status === "resolved";
              return (
                <button
                  key={item.id}
                  disabled={busy}
                  onClick={() => chooseConversation(item)}
                  aria-pressed={isSelected}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    isSelected
                      ? "bg-primary-50/90 border-primary-300 shadow-2xs ring-1 ring-primary-300/40 text-primary-950"
                      : "border-transparent hover:bg-neutral-50 hover:border-neutral-200 text-slate-800"
                  }`}
                >
                  <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold text-sm shadow-2xs flex items-center justify-center shrink-0">
                    {(item.customerName || "Customer").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <strong className="text-xs font-bold truncate text-slate-800">
                        {item.customerName || "Customer"}
                      </strong>
                      {item.adminUnread > 0 && (
                        <span className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-full px-2 py-0.5 text-[10px] font-bold shadow-2xs animate-pulse">
                          {item.adminUnread}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 truncate mb-1">
                      {item.lastMessage || "New conversation"}
                    </p>
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isResolved
                            ? "bg-neutral-100 text-neutral-600 border-neutral-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {isResolved ? "Resolved" : "Open"}
                      </span>
                      {item.lastMessageAt && (
                        <span className="text-[10px] text-neutral-400">
                          {new Date(item.lastMessageAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}

            {inboxCursor && (
              <div className="p-2">
                <button
                  type="button"
                  className="w-full py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-primary-700 transition-colors shadow-2xs"
                  onClick={() => loadInbox(inboxCursor).catch(report)}
                >
                  Load more conversations
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main
          className={`${
            mobileView === "list" ? "hidden md:flex" : "flex"
          } flex-1 min-w-0 flex-col h-full bg-slate-50/40`}
        >
          {!uid ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-500">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-2xl shadow-lg mb-4">
                💬
              </div>
              <h2 className="text-xl font-bold text-slate-800">Your Conversations</h2>
              <p className="text-xs text-neutral-500 max-w-sm mt-1 leading-relaxed">
                Select a customer from the left to view messages, assist with reservations, or share booking references.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header: Customer details + small icons beside Mark Resolved */}
              <header className="bg-white border-b border-neutral-200 px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-shrink-0 shadow-2xs">
                {/* Left: Customer info (with mobile back button) */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileView("list")}
                    className="md:hidden p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-600 transition-colors shrink-0"
                    title="Back to conversations"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="relative shrink-0">
                    <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold text-base flex items-center justify-center shadow-2xs">
                      {(selected?.customerName || "Customer").slice(0, 1).toUpperCase()}
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        activeConversation?.status === "resolved" ? "bg-neutral-400" : "bg-emerald-500"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-slate-800 text-sm md:text-base leading-tight truncate">
                        {selected?.customerName || "Customer"}
                      </h2>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          activeConversation?.status === "resolved"
                            ? "bg-neutral-100 text-neutral-600 border-neutral-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {activeConversation?.status === "resolved" ? "Resolved" : "Active"}
                      </span>
                    </div>
                    {currentChatCategory(activeConversation, messages) && (
                      <p className="text-xs text-primary-700 mt-0.5">
                        Chatting in <strong>{currentChatCategory(activeConversation, messages)}</strong>
                      </p>
                    )}
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5 font-mono">
                      ID: {selected?.customerId}
                    </p>
                  </div>
                </div>

                {/* Right: Small action icons (All, Media, Docs, Links, Search) + Mark resolved */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Small Icon Tabs beside Mark Resolved */}
                  <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTab("messages");
                        setSearchRun("");
                      }}
                      title="All messages"
                      className={`p-1.5 rounded-lg transition-all ${
                        tab === "messages"
                          ? "bg-white text-primary-600 shadow-2xs font-semibold"
                          : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                      }`}
                    >
                      <ForumIcon sx={{ fontSize: 17 }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("media");
                        setSearchRun("");
                      }}
                      title="Media & photos"
                      className={`p-1.5 rounded-lg transition-all ${
                        tab === "media"
                          ? "bg-white text-primary-600 shadow-2xs font-semibold"
                          : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                      }`}
                    >
                      <ImageIcon sx={{ fontSize: 17 }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("documents");
                        setSearchRun("");
                      }}
                      title="Documents & files"
                      className={`p-1.5 rounded-lg transition-all ${
                        tab === "documents"
                          ? "bg-white text-primary-600 shadow-2xs font-semibold"
                          : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                      }`}
                    >
                      <DescriptionIcon sx={{ fontSize: 17 }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("links");
                        setSearchRun("");
                      }}
                      title="Shared links"
                      className={`p-1.5 rounded-lg transition-all ${
                        tab === "links"
                          ? "bg-white text-primary-600 shadow-2xs font-semibold"
                          : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                      }`}
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTab(tab === "search" ? "messages" : "search");
                        setSearchRun("");
                      }}
                      title="Search in conversation"
                      className={`p-1.5 rounded-lg transition-all ${
                        tab === "search"
                          ? "bg-white text-primary-600 shadow-2xs font-semibold"
                          : "text-slate-500 hover:text-slate-800 hover:bg-white/60"
                      }`}
                    >
                      <Search sx={{ fontSize: 17 }} />
                    </button>
                  </div>

                  {/* Mark Resolved / Reopen Button */}
                  <button
                    type="button"
                    onClick={changeStatus}
                    disabled={busy}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 active:scale-95 ${
                      activeConversation?.status === "resolved"
                        ? "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300"
                        : "bg-gradient-to-r from-success-600 to-success-700 hover:from-success-700 hover:to-success-800 text-white shadow-xs"
                    }`}
                  >
                    {activeConversation?.status === "resolved" ? (
                      <>
                        <RefreshIcon sx={{ fontSize: 14 }} />
                        <span>Reopen</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon sx={{ fontSize: 14 }} />
                        <span>Mark Resolved</span>
                      </>
                    )}
                  </button>
                </div>
              </header>

              {/* Collapsible Search Bar (only when search tab is active) */}
              {tab === "search" && (
                <form
                  className="p-3 bg-white border-b border-neutral-200 flex flex-wrap items-center gap-2.5 animate-fade-in flex-shrink-0"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearchRun(query);
                  }}
                >
                  <div className="relative flex-1 min-w-[200px]">
                    <input
                      className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-neutral-300 text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:outline-none"
                      aria-label="Search messages"
                      placeholder="Search text, filename, link or booking #…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <Search sx={{ fontSize: 16 }} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  </div>
                  <label className="text-xs text-neutral-600 flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                      checked={globalSearch}
                      onChange={(e) => {
                        setGlobalSearch(e.target.checked);
                        setSearchRun("");
                      }}
                    />
                    <span>All chats</span>
                  </label>
                  <button
                    type="submit"
                    className="bg-primary-600 hover:bg-primary-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    Search
                  </button>
                  <button
                    type="button"
                    className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-3 py-1.5 rounded-xl text-xs transition-colors"
                    onClick={() => {
                      setTab("messages");
                      setSearchRun("");
                      setQuery("");
                    }}
                  >
                    Cancel
                  </button>
                </form>
              )}

              {/* Messages Timeline */}
              <div
                ref={timelineRef}
                onScroll={handleTimelineScroll}
                className="support-timeline flex-1 overflow-y-auto p-4 md:p-6 space-y-4"
              >
                {/* Auto Load Older Messages Sentinel & Indicator */}
                {cursor && (
                  <div ref={topSentinelRef} className="py-2 text-center min-h-[28px] flex items-center justify-center">
                    {loadingOlder ? (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-100 text-xs font-medium text-neutral-600 shadow-2xs animate-fade-in">
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                        <span>Loading older messages…</span>
                      </div>
                    ) : (
                      <div className="h-2 w-full" />
                    )}
                  </div>
                )}
                {messagesLoading && !messages.length && (
                  <div className="flex items-center justify-center gap-2 py-12 text-xs text-neutral-400">
                    <div className="w-4 h-4 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                    <span>Loading conversation…</span>
                  </div>
                )}
                {!messagesLoading && !ordered.length && (
                  <div className="py-12 text-center text-xs text-neutral-400">
                    {tab === "messages"
                      ? "No messages yet. Send a message below to start."
                      : `No ${tab} found in this conversation.`}
                  </div>
                )}

                {ordered.map((message, index) => {
                  const previous = ordered[index - 1];
                  const newDay = !previous || new Date(previous.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
                  const category = messageCategory(message);
                  if (category) return (
                    <div key={message.id}>
                      {newDay && <div className="my-4 text-center text-[11px] text-neutral-500">{new Date(message.createdAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"})}</div>}
                      <div id={`support-message-${message.id}`} className="my-4 text-center">
                        <span className="inline-block rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm text-primary-700">
                          Chatting in <strong>{category}</strong>
                        </span>
                      </div>
                    </div>
                  );

                  const isAdmin = message.senderRole === "admin";
                  const isMyMessage =
                    isAdmin || message.senderId === getAuth().currentUser?.uid;
                  const messageTime =
                    typeof message.createdAt === "number"
                      ? message.createdAt
                      : new Date(message.createdAt).getTime();
                  // User rule: Edit available for 1 minute from sending
                  const isWithinOneMinute = Date.now() - messageTime <= 60 * 1000;
                  const canEdit = isMyMessage && isWithinOneMinute;

                  return (
                    <div key={message.id}>
                      {newDay && (
                        <div className="flex justify-center my-4">
                          <span className="text-[11px] font-semibold text-neutral-500 bg-white border border-neutral-200 px-3.5 py-1 rounded-full shadow-2xs">
                            {new Date(message.createdAt).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}

                      <div className={`flex items-start gap-2 ${isAdmin ? "justify-end" : "justify-start"} group support-bubble-wrapper relative`}>
                        {/* 3-Dot Action Button on Hover (placed on the side of bubble) */}
                        <div className={`order-${isAdmin ? 1 : 3} relative flex items-center self-center`}>
                          <button
                            type="button"
                            aria-label="Message actions"
                            aria-expanded={activeMenuMessageId === message.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuMessageId((cur) => (cur === message.id ? null : message.id));
                            }}
                            className="support-bubble-menu-trigger p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all cursor-pointer"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>

                          {/* 3-Dot Floating Action Menu */}
                          {activeMenuMessageId === message.id && (
                            <div
                              className={`absolute z-30 top-7 ${
                                isAdmin ? "right-0" : "left-0"
                              } bg-white rounded-xl shadow-xl border border-neutral-200 py-1.5 w-36 text-xs text-slate-700 animate-fade-in`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={locked || message.customerId !== uid}
                                onClick={() => {
                                  setReply(message);
                                  setTab("messages");
                                  setActiveMenuMessageId(null);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-primary-50 hover:text-primary-700 flex items-center gap-2 font-medium transition-colors"
                              >
                                <span>↩️</span>
                                <span>Reply</span>
                              </button>

                              {/* Edit only within 1 min */}
                              {canEdit && (
                                <button
                                  type="button"
                                  disabled={locked}
                                  onClick={() => {
                                    setActiveMenuMessageId(null);
                                    act("edit", message);
                                  }}
                                  className="w-full text-left px-3.5 py-2 hover:bg-primary-50 hover:text-primary-700 flex items-center gap-2 font-medium transition-colors"
                                >
                                  <span>✏️</span>
                                  <span>Edit (1m)</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={locked}
                                onClick={() => {
                                  setActiveMenuMessageId(null);
                                  act("delete", message);
                                }}
                                className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium transition-colors"
                              >
                                <span>🗑️</span>
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Message Bubble Body */}
                        <article
                          id={`support-message-${message.id}`}
                          className={`order-2 px-3.5 pt-2.5 pb-2 rounded-2xl border max-w-[88%] md:max-w-[78%] shadow-2xs ${
                            isAdmin
                              ? "bg-gradient-to-br from-primary-50 to-primary-100/70 border-primary-200/90 text-slate-800 rounded-tr-xs"
                              : "bg-white border-neutral-200/90 text-slate-800 rounded-tl-xs"
                          }`}
                        >
                          {/* Reply quote */}
                          {message.replyTo && (
                            <div className="text-xs text-neutral-500 border-l-2 border-primary-400 pl-2 py-0.5 mb-2 bg-neutral-50/70 rounded-r">
                              Replying to #{message.replyTo.slice(0, 8)}
                            </div>
                          )}

                          {/* Booking Card Preview in Message Bubble */}
                          {message.booking && (
                            <button
                              type="button"
                              className="w-full text-left p-3 rounded-2xl bg-white border border-primary-200/90 hover:border-primary-400 hover:shadow-md transition-all mb-2 block group cursor-pointer"
                              onClick={() => showBooking(message)}
                            >
                              {/* Top Header Row: Category Badge, Short Ref, Status */}
                              <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 font-bold text-[11px] px-2 py-0.5 rounded-md border border-primary-200 shadow-2xs">
                                    <span>{serviceIcon(message.booking.service)}</span>
                                    <span className="capitalize">{serviceLabels[message.booking.service] || "Booking"}</span>
                                  </span>
                                  <span
                                    title={`Full Reference: ${message.booking.reference || message.booking.id}`}
                                    className="font-mono font-bold text-slate-700 bg-neutral-100 text-[11px] px-1.5 py-0.5 rounded border border-neutral-200/90"
                                  >
                                    #{formatShortRef(message.booking.reference || message.booking.id)}
                                  </span>
                                </div>

                                {message.booking.status && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                      message.booking.status.toLowerCase().includes("confirm") ||
                                      message.booking.status.toLowerCase().includes("accept")
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : message.booking.status.toLowerCase().includes("pend")
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : "bg-slate-100 text-slate-700 border border-neutral-200"
                                    }`}
                                  >
                                    {message.booking.status}
                                  </span>
                                )}
                              </div>

                              {/* Title */}
                              <p className="text-xs font-bold text-slate-900 group-hover:text-primary-700 transition-colors leading-snug">
                                {message.booking.title}
                              </p>

                              {/* Bottom Metadata: Formatted Date & View Details */}
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-100 text-[11px]">
                                <span className="inline-flex items-center gap-1 text-neutral-500 font-medium">
                                  <CalendarMonthIcon sx={{ fontSize: 13 }} className="text-neutral-400" />
                                  <span>{formatBookingDate(message.booking.date)}</span>
                                </span>
                                <span className="font-semibold text-primary-600 group-hover:underline flex items-center gap-0.5">
                                  <span>View details</span>
                                  <span>→</span>
                                </span>
                              </div>
                            </button>
                          )}

                          {/* Message Body & Inline Timing */}
                          {message.text && !message.attachment && !message.booking && !(message.links && message.links.length) ? (
                            <div className="flex items-end justify-between gap-3 text-sm leading-snug text-slate-800">
                              <span className="whitespace-pre-wrap break-words min-w-0">
                                {message.text}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400 select-none shrink-0 self-end -mb-0.5 ml-auto">
                                {message.editedAt ? (
                                  <span className="italic text-neutral-400">edited</span>
                                ) : null}
                                <span>
                                  {new Date(message.createdAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {isAdmin && (
                                  <span
                                    title={activeConversation?.customerReadAt >= message.createdAt ? "Read by customer" : "Sent"}
                                    className={`font-semibold ${
                                      activeConversation?.customerReadAt >= message.createdAt
                                        ? "text-primary-600"
                                        : "text-neutral-400"
                                    }`}
                                  >
                                    {activeConversation?.customerReadAt >= message.createdAt ? "✓✓" : "✓"}
                                  </span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <>
                              {/* Message Text */}
                              {message.text && (
                                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800 mb-2">
                                  {message.text}
                                </p>
                              )}

                              {/* Attachment (Previewed by default) */}
                              {message.attachment && (
                                <SupportAttachment
                                  customerId={message.customerId}
                                  attachment={message.attachment}
                                  onError={report}
                                />
                              )}

                              {/* Shared Links */}
                              {(message.links || []).map((link) => (
                                <a
                                  key={link}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-xs font-semibold text-primary-700 underline break-all mt-1 hover:text-primary-800"
                                >
                                  🔗 {link}
                                </a>
                              ))}

                              {/* Bubble Footer for media/links/cards */}
                              <div className="flex items-center justify-end gap-1.5 text-[10px] text-neutral-400 mt-1 select-none">
                                {message.editedAt ? (
                                  <span className="italic text-neutral-400">edited</span>
                                ) : null}
                                <span>
                                  {new Date(message.createdAt).toLocaleTimeString(undefined, {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {isAdmin && (
                                  <span
                                    title={activeConversation?.customerReadAt >= message.createdAt ? "Read by customer" : "Sent"}
                                    className={`font-semibold ${
                                      activeConversation?.customerReadAt >= message.createdAt
                                        ? "text-primary-600"
                                        : "text-neutral-400"
                                    }`}
                                  >
                                    {activeConversation?.customerReadAt >= message.createdAt ? "✓✓" : "✓"}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </article>
                      </div>
                    </div>
                  );
                })}
                <div ref={tail} />
              </div>

              {/* Booking Details Modal */}
              <SupportBookingDialog
                open={bookingDialog}
                booking={bookingDetails}
                loading={bookingLoading}
                error={bookingError}
                onClose={closeBooking}
                onRetry={() => showBooking(bookingSelection.current)}
              />

              {/* Message Composer */}
              <form onSubmit={send} className="support-composer p-3.5 border-t border-neutral-200 bg-white flex-shrink-0 space-y-2 relative">
                {/* Modern Floating Slash Command / Booking Popover */}
                {picker && (
                  <div
                    ref={pickerRef}
                    className="absolute bottom-full left-3 right-3 mb-2 max-h-[400px] bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col z-40 overflow-hidden animate-fade-in"
                  >
                    {/* Popover Header */}
                    <div className="px-3.5 py-2.5 border-b border-neutral-100 flex items-center justify-between gap-3 bg-gradient-to-r from-primary-50/80 via-white to-primary-50/30">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-primary-100 text-primary-700 text-xs font-black flex items-center justify-center">
                          /
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 leading-tight">Attach Booking</h4>
                          <p className="text-[10px] text-neutral-400">Search customer reservations or switch service</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-neutral-400 hidden sm:inline-block bg-neutral-100 px-1.5 py-0.5 rounded font-mono">
                          Esc to close
                        </span>
                        <button
                          type="button"
                          onClick={() => setPicker(false)}
                          className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                          title="Close (Esc)"
                          aria-label="Close booking picker"
                        >
                          <CloseIcon sx={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </div>

                    {/* Search Input Bar */}
                    <div className="px-3 py-2 border-b border-neutral-100 bg-white">
                      <div className="relative">
                        <Search sx={{ fontSize: 16 }} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          autoFocus
                          className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-neutral-200 bg-neutral-50/70 text-xs focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white focus:outline-none text-slate-800 placeholder:text-neutral-400 transition-all"
                          aria-label="Filter bookings"
                          placeholder={`Search ${serviceLabels[service]} by ref # or title…`}
                          value={bookingFilter}
                          onChange={(e) => setBookingFilter(e.target.value)}
                        />
                        {bookingFilter && (
                          <button
                            type="button"
                            onClick={() => setBookingFilter("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Service Pill Tabs */}
                    <div className="px-3 py-1.5 bg-neutral-50/70 border-b border-neutral-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {services.map((value) => {
                        const isActive = service === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setService(value);
                              setBookingFilter("");
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                              isActive
                                ? "bg-primary-600 text-white shadow-xs font-semibold"
                                : "bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200/80"
                            }`}
                          >
                            <span>{serviceIcon(value)}</span>
                            <span>{serviceLabels[value]}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Bookings List Area */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 max-h-[220px]">
                      {loadingBookings && !bookings.length ? (
                        <div className="py-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-2">
                          <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                          <span>Loading {serviceLabels[service]} bookings…</span>
                        </div>
                      ) : (
                        <>
                          {bookings
                            .filter((item) =>
                              `${item.reference || ""} ${item.title || ""} ${item.date || ""}`
                                .toLowerCase()
                                .includes(bookingFilter.toLowerCase()),
                            )
                            .map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="w-full text-left p-2.5 rounded-xl bg-white hover:bg-primary-50/70 border border-neutral-200/90 hover:border-primary-400 hover:shadow-xs text-xs transition-all flex items-center justify-between gap-3 group cursor-pointer"
                                onClick={() => {
                                  setBooking(item);
                                  setPicker(false);
                                }}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="p-2 rounded-xl bg-primary-50 text-primary-700 font-bold group-hover:bg-primary-600 group-hover:text-white transition-colors shrink-0 shadow-2xs">
                                    {serviceIcon(item.service || service)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                      <span
                                        title={`Full Ref: ${item.reference || item.id}`}
                                        className="font-mono font-bold text-primary-700 text-[11px] bg-primary-50/80 px-1.5 py-0.2 rounded border border-primary-200"
                                      >
                                        #{formatShortRef(item.reference || item.id)}
                                      </span>
                                      {item.status && (
                                        <span
                                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                            item.status.toLowerCase().includes("confirm") ||
                                            item.status.toLowerCase().includes("accept")
                                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                              : "bg-amber-50 text-amber-700 border border-amber-200"
                                          }`}
                                        >
                                          {item.status}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-primary-950 transition-colors">
                                      {item.title}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                                      <span className="inline-flex items-center gap-1">
                                        <CalendarMonthIcon sx={{ fontSize: 12 }} />
                                        <span>{formatBookingDate(item.date)}</span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-600 bg-primary-50 group-hover:bg-primary-600 group-hover:text-white px-2 py-1 rounded-lg transition-colors">
                                    <span>Attach</span>
                                    <span>+</span>
                                  </span>
                                </div>
                              </button>
                            ))}

                          {!bookings.filter((item) =>
                            `${item.reference || ""} ${item.title || ""} ${item.date || ""}`
                              .toLowerCase()
                              .includes(bookingFilter.toLowerCase()),
                          ).length && (
                            <div className="py-8 text-center text-xs text-neutral-400 flex flex-col items-center justify-center gap-1.5">
                              <span className="text-2xl opacity-60">📋</span>
                              <p className="font-semibold text-neutral-600">No {serviceLabels[service]} found</p>
                              <p className="text-[11px] text-neutral-400">
                                {bookingFilter
                                  ? `No results matching "${bookingFilter}"`
                                  : `This customer has no active ${serviceLabels[service]?.toLowerCase()} records.`}
                              </p>
                            </div>
                          )}

                          {bookingCursor && (
                            <button
                              type="button"
                              disabled={loadingBookings}
                              className="w-full py-2 mt-1 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold text-primary-700 hover:text-primary-800 transition-colors shadow-2xs flex items-center justify-center gap-1.5"
                              onClick={async () => {
                                try {
                                  setLoadingBookings(true);
                                  const result = await api("bookings", {
                                    customerId: uid,
                                    service,
                                    cursor: bookingCursor,
                                  });
                                  setBookings((previous) => unique([...previous, ...result.items]));
                                  setBookingCursor(result.nextCursor);
                                } catch (e) {
                                  report(e);
                                } finally {
                                  setLoadingBookings(false);
                                }
                              }}
                            >
                              {loadingBookings ? (
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
                              ) : null}
                              <span>{loadingBookings ? "Loading…" : "Load more bookings"}</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {/* Popover Footer Hint */}
                    <div className="px-3 py-1.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400 select-none">
                      <span>Click to attach to your message</span>
                      <span>Press <kbd className="px-1 py-0.5 bg-white border border-neutral-200 rounded text-[10px] font-mono">Esc</kbd> to close</span>
                    </div>
                  </div>
                )}

                {(booking || file || reply) && (
                  <div className="text-xs flex gap-2 flex-wrap animate-fade-in">
                    {booking && (
                      <span className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 border border-primary-200 px-3 py-1 rounded-xl font-medium shadow-2xs text-xs">
                        <span>{serviceIcon(booking.service || service)}</span>
                        <span className="font-mono font-bold">#{formatShortRef(booking.reference || booking.id)}</span>
                        <span className="text-neutral-400">·</span>
                        <span className="font-semibold truncate max-w-[150px] md:max-w-[220px]">{booking.title}</span>
                        <span className="text-neutral-400">·</span>
                        <span className="text-neutral-500 text-[11px] inline-flex items-center gap-0.5">
                          <CalendarMonthIcon sx={{ fontSize: 11 }} />
                          <span>{formatBookingDate(booking.date)}</span>
                        </span>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => setBooking(null)}
                          className="hover:text-primary-900 font-bold ml-1 text-sm leading-none bg-primary-100 hover:bg-primary-200 w-4 h-4 rounded-full flex items-center justify-center transition-colors"
                          title="Remove booking"
                        >
                          ×
                        </button>
                      </span>
                    )}

                    {file && (
                      <span className="inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-700 border border-neutral-200 px-2.5 py-1 rounded-lg font-medium">
                        <span>📎 {file.name}</span>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => setFile(null)}
                          className="hover:text-neutral-900 font-bold ml-1"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {reply && (
                      <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-medium">
                        <span>↩️ Reply: {reply.text?.slice(0, 40) || "Attachment/booking"}</span>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => setReply(null)}
                          className="hover:text-amber-900 font-bold ml-1"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <label
                    className={`p-2.5 rounded-xl border transition-all shadow-2xs h-[46px] w-[46px] flex items-center justify-center shrink-0 cursor-pointer ${
                      locked
                        ? "opacity-50 cursor-not-allowed bg-neutral-100 border-neutral-200 text-neutral-400"
                        : file
                        ? "bg-primary-50 border-primary-400 text-primary-600"
                        : "border-neutral-300 hover:border-primary-400 hover:bg-primary-50 text-neutral-500 hover:text-primary-600 active:scale-95 bg-white"
                    }`}
                    title="Attach file (image, PDF, document, audio, video)"
                    aria-label="Attach file"
                  >
                    <svg
                      className="w-5 h-5 -rotate-45"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    <input
                      className="sr-only"
                      type="file"
                      disabled={locked}
                      accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,audio/webm,audio/ogg,audio/mpeg,audio/mp4,video/mp4,video/webm"
                      onChange={(e) => {
                        const picked = e.target.files?.[0];
                        if (picked?.size > 8 * 1024 * 1024)
                          report(new Error("Maximum attachment size is 8 MiB."));
                        else setFile(picked || null);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <textarea
                    className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50/50 p-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all min-h-[46px] max-h-32 text-slate-800"
                    rows={2}
                    aria-label="Message"
                    maxLength={4000}
                    placeholder="Write a message · type / to choose a booking"
                    disabled={locked}
                    value={draft}
                    onChange={(e) => {
                      if (e.target.value === "/") {
                        setPicker(true);
                        setDraft("");
                      } else setDraft(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(e);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 h-[46px] flex items-center justify-center gap-1.5 shrink-0"
                    disabled={busy || (!draft.trim() && !file && !booking)}
                  >
                    {busy ? (
                      <span className="animate-spin text-sm">⌛</span>
                    ) : retry.current ? (
                      <span>Retry</span>
                    ) : (
                      <>
                        <span>Send</span>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-400 px-1 pt-0.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => setPicker((prev) => !prev)}
                      className="text-neutral-500 hover:text-primary-600 font-medium flex items-center gap-1 transition-colors hover:underline"
                    >
                      <HotelIcon sx={{ fontSize: 13 }} />
                      <span>{picker ? "Hide bookings" : "Link booking (/)"}</span>
                    </button>
                    <span>·</span>
                    <span>Max 8 MiB file</span>
                  </div>
                  <span>{draft.length}/4000</span>
                </div>

                {notice && (
                  <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg flex items-center justify-between">
                    <span>{notice}</span>
                    <button
                      type="button"
                      className="underline font-bold"
                      disabled={busy}
                      onClick={() => {
                        retry.current = null;
                        setNotice("");
                      }}
                    >
                      Cancel retry
                    </button>
                  </div>
                )}
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
