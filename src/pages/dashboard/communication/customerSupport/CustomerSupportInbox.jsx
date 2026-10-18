import {useCallback, useEffect, useRef, useState} from "react";
import {getAuth} from "firebase/auth";
import {customerChatApi as api, uploadCustomerChatFile} from "../../../../utils/customerChatApi";
import SupportAttachment from "./SupportAttachment";
import SupportBookingDialog from "./SupportBookingDialog";
import "./customerSupport.css";

const button =
  "rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50";
const field = "rounded-lg border border-neutral-300 px-3 py-2 text-sm w-full";
const services = ["hotel", "sightseeing", "car", "selfDrive"];
const unique = (items) => [...new Map(items.map((item) => [item.id, item])).values()];

export default function CustomerSupportInbox() {
  const [inbox, setInbox] = useState([]);
  const [inboxCursor, setInboxCursor] = useState(null);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState(null);
  const [booking, setBooking] = useState(null);
  const [reply, setReply] = useState(null);
  const [picker, setPicker] = useState(false);
  const [service, setService] = useState("hotel");
  const [bookings, setBookings] = useState([]);
  const [bookingCursor, setBookingCursor] = useState(null);
  const [bookingFilter, setBookingFilter] = useState("");
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
  const bookingRequest = useRef(0);
  const bookingSelection = useRef(null);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const scope = useRef(0);
  const retry = useRef(null);
  const tail = useRef(null);
  const historyLoaded = useRef(false);
  const uid = selected?.customerId;
  const report = (e) => setError(e.message || "Chat request failed. Please retry.");

  useEffect(() => {
    if (inbox.length) setSelected((current) => current || inbox[0]);
  }, [inbox]);

  const loadInbox = useCallback(
    async (next = null) => {
      const result = await api("inbox", {...(next ? {cursor: next} : {})});
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

  const loadMessages = useCallback(
    async (next = null) => {
      if (!uid) return;
      const generation = scope.current;
      if (next && tab === "messages") historyLoaded.current = true;
      const action = tab === "search" ? "search" : tab === "messages" ? "messages" : "shared";
      if (action === "search" && !searchRun) return;
      const result = await api(action, {
        customerId: uid,
        ...(next ? {cursor: next} : {}),
        ...(action === "shared" ? {category: tab} : {}),
        ...(action === "search" ? {query: searchRun, allCustomers: globalSearch} : {}),
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
    api("bookings", {customerId: uid, service})
      .then((result) => {
        if (alive) {
          setBookings(result.items);
          setBookingCursor(result.nextCursor);
        }
      })
      .catch((e) => {
        if (alive) report(e);
      });
    return () => {
      alive = false;
    };
  }, [picker, uid, service]);

  async function chooseConversation(item) {
    scope.current += 1;
    setSelected(item);
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
      // Freeze the payload and request ID across network retries.
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
      const {file: ignored, ...payload} = pending;
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
        tail.current?.scrollIntoView({behavior: "smooth"});
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
      const status =
        (inbox.find((item) => item.customerId === uid) || selected).status === "resolved"
          ? "open"
          : "resolved";
      await api("status", {customerId: uid, status});
      setSelected((previous) => ({...previous, status}));
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
        ...(action === "edit" ? {text: value} : {}),
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
      `${item.customerName} ${item.customerId}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="support-inbox bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
      <div className="support-titlebar border-b p-4">
        <div>
          <p className="support-eyebrow">THAISEVA • CUSTOMER CARE</p>
          <h1 className="text-xl font-bold">Conversations</h1>
          <p className="text-sm text-neutral-500">A little help. A better journey.</p>
        </div>
        <span className="support-private">Private support inbox</span>
      </div>
      {error && (
        <div role="alert" className="bg-red-50 text-red-700 p-3 flex justify-between">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <div className="flex flex-col md:flex-row flex-1 min-h-0">
        <aside className="support-sidebar md:w-80 border-r p-3 space-y-3 overflow-auto">
          <input
            className={field}
            aria-label="Filter loaded conversations"
            placeholder="Search loaded conversations…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            className={field}
            aria-label="Conversation status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All conversations</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          {inboxLoading && (
            <p role="status" className="support-empty">
              Loading conversations…
            </p>
          )}
          {!inboxLoading && !inbox.length && (
            <p className="text-sm text-neutral-500">
              No conversations yet. Customers appear after opening support in the app.
            </p>
          )}
          {!inboxLoading && inbox.length > 0 && !visibleInbox.length && (
            <p className="support-empty">No matching conversations. Try another name or status.</p>
          )}
          {visibleInbox.map((item) => (
            <button
              key={item.id}
              disabled={busy}
              onClick={() => chooseConversation(item)}
              aria-pressed={uid === item.customerId}
              className={`support-conversation w-full text-left p-3 rounded-xl border ${uid === item.customerId ? "bg-blue-50 border-blue-300" : "border-neutral-100"}`}
            >
              <span className="support-avatar" aria-hidden="true">
                {(item.customerName || "Customer").slice(0, 1).toUpperCase()}
              </span>
              <div className="support-conversation-copy">
                <div className="flex justify-between">
                  <strong>{item.customerName || "Customer"}</strong>
                  {item.adminUnread > 0 && (
                    <span className="bg-blue-600 text-white rounded-full px-2 text-xs">
                      {item.adminUnread}
                    </span>
                  )}
                </div>
                <p className="text-sm truncate">{item.lastMessage || "New conversation"}</p>
                <span
                  className={`support-status ${item.status === "resolved" ? "is-resolved" : ""}`}
                >
                  {item.status === "resolved" ? "Resolved" : "Open"}
                </span>
              </div>
            </button>
          ))}
          {inboxCursor && (
            <button className={button} onClick={() => loadInbox(inboxCursor).catch(report)}>
              Load more conversations
            </button>
          )}
        </aside>
        <main className="flex-1 min-w-0 flex flex-col">
          {!uid ? (
            <div className="support-welcome p-12 text-center text-neutral-500">
              <span className="support-welcome-icon" aria-hidden="true">
                ↗
              </span>
              <h2>Your next conversation starts here</h2>
              <p>Select a customer to view their messages, share a booking, or lend a hand.</p>
              <span className="support-welcome-note">
                Messages, bookings, and shared files — together in one place.
              </span>
            </div>
          ) : (
            <>
              <header className="support-chat-header p-4 border-b flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="support-avatar" aria-hidden="true">
                    {(selected.customerName || "Customer").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <h2 className="font-bold">{selected.customerName || "Customer"}</h2>
                    <p className="text-xs text-neutral-500">
                      Customer support ·{" "}
                      {activeConversation.status === "resolved" ? "Resolved" : "Open conversation"}
                    </p>
                  </div>
                </div>
                <button className={button} onClick={changeStatus}>
                  {activeConversation.status === "resolved"
                    ? "Reopen conversation"
                    : "Mark resolved"}
                </button>
              </header>
              <nav
                className="support-tabs flex gap-1 p-2 border-b overflow-x-auto"
                aria-label="Conversation content"
              >
                {["messages", "media", "documents", "links", "search"].map((value) => (
                  <button
                    key={value}
                    disabled={busy}
                    aria-current={tab === value ? "page" : undefined}
                    className={`${button} capitalize ${tab === value ? "bg-blue-50 text-blue-700" : ""}`}
                    onClick={() => {
                      setTab(value);
                      setSearchRun("");
                    }}
                  >
                    {value}
                  </button>
                ))}
              </nav>
              {tab === "search" && (
                <form
                  className="p-3 flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSearchRun(query);
                  }}
                >
                  <input
                    className={`${field} flex-1`}
                    aria-label="Search messages"
                    placeholder="Message, filename, link or booking reference"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <label className="text-sm flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={globalSearch}
                      onChange={(e) => {
                        setGlobalSearch(e.target.checked);
                        setSearchRun("");
                      }}
                    />
                    All customers
                  </label>
                  <button className={button}>Search</button>
                  <p className="text-xs text-neutral-500 w-full">
                    Word-prefix search, 2–48 characters per word. Load more to continue results.
                  </p>
                </form>
              )}
              <div
                className="support-timeline p-4 space-y-3 overflow-auto bg-neutral-50"
                aria-live="polite"
              >
                {historyLoaded.current && tab === "messages" && (
                  <button
                    className={button}
                    onClick={() => {
                      historyLoaded.current = false;
                      loadMessages().catch(report);
                    }}
                  >
                    Return to latest messages and resume updates
                  </button>
                )}
                {cursor && (
                  <button className={button} onClick={() => loadMessages(cursor).catch(report)}>
                    Load {tab === "messages" ? "older messages" : "more results"}
                  </button>
                )}
                {messagesLoading && (
                  <p role="status" className="support-empty">
                    Loading conversation…
                  </p>
                )}
                {!messagesLoading && !ordered.length && (
                  <p className="support-empty text-sm text-neutral-500">
                    {tab === "search" && !searchRun
                      ? "Enter a search to begin."
                      : "No items to show."}
                  </p>
                )}
                {ordered.map((message, index) => (
                  <div key={message.id}>
                    {tab === "messages" &&
                      (index === 0 ||
                        new Date(ordered[index - 1].createdAt).toDateString() !==
                          new Date(message.createdAt).toDateString()) && (
                        <div className="support-day">
                          <span>
                            {new Date(message.createdAt).toLocaleDateString(undefined, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      )}
                    <article
                      key={message.id}
                      id={`support-message-${message.id}`}
                      className={`support-bubble p-3 rounded-xl border max-w-[92%] md:max-w-[80%] ${message.senderRole === "admin" ? "support-bubble-admin ml-auto bg-blue-50 border-blue-100" : "bg-white border-neutral-200"}`}
                    >
                      <div className="text-xs text-neutral-500 mb-1">
                        {message.senderRole === "admin" ? "Thaiseva Admin" : "Customer"} ·{" "}
                        {new Date(message.createdAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {message.editedAt ? " · edited" : ""}
                        {globalSearch && tab === "search" ? ` · ${message.customerId}` : ""}
                      </div>
                      {message.replyTo && (
                        <p className="text-xs text-neutral-500 border-l-2 pl-2 mb-2">
                          Reply to message {message.replyTo.slice(0, 8)}
                        </p>
                      )}
                      {message.booking && (
                        <button
                          className="block w-full text-left p-2 rounded-lg bg-white border mb-2"
                          onClick={() => showBooking(message)}
                        >
                          <strong>Booking #{message.booking.reference}</strong>
                          <p className="text-sm">
                            {message.booking.title} · {message.booking.date}
                          </p>
                          <span className="text-xs text-blue-700">View booking reference</span>
                        </button>
                      )}
                      {message.text && (
                        <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                      )}
                      {message.attachment && (
                        <SupportAttachment
                          customerId={message.customerId}
                          attachment={message.attachment}
                          onError={report}
                        />
                      )}
                      {(message.links || []).map((link) => (
                        <a
                          key={link}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm text-blue-700 underline break-all mt-1"
                        >
                          {link}
                        </a>
                      ))}
                      <div className="flex flex-wrap gap-3 text-xs mt-2 text-neutral-500">
                        <button
                          disabled={locked || message.customerId !== uid}
                          onClick={() => {
                            setReply(message);
                            setTab("messages");
                          }}
                        >
                          Reply
                        </button>
                        {message.senderId === getAuth().currentUser?.uid && (
                          <button onClick={() => act("edit", message)}>Edit</button>
                        )}
                        <button onClick={() => act("delete", message)}>Delete</button>
                        {message.senderRole === "admin" && (
                          <span>
                            {activeConversation?.customerReadAt >= message.createdAt
                              ? "Read"
                              : "Sent"}
                          </span>
                        )}
                      </div>
                    </article>
                  </div>
                ))}
                <div ref={tail} />
              </div>
              <SupportBookingDialog
                open={bookingDialog}
                booking={bookingDetails}
                loading={bookingLoading}
                error={bookingError}
                onClose={closeBooking}
                onRetry={() => showBooking(bookingSelection.current)}
              />
              {picker && (
                <section className="border-t p-3 space-y-2">
                  <div className="flex gap-2">
                    <select
                      className={field}
                      aria-label="Booking service"
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                    >
                      {services.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <input
                      className={field}
                      aria-label="Filter loaded bookings"
                      placeholder="Find in loaded bookings"
                      value={bookingFilter}
                      onChange={(e) => setBookingFilter(e.target.value)}
                    />
                    <button className={button} onClick={() => setPicker(false)}>
                      Close
                    </button>
                  </div>
                  <div className="max-h-40 overflow-auto">
                    {bookings
                      .filter((item) =>
                        `${item.reference} ${item.title}`
                          .toLowerCase()
                          .includes(bookingFilter.toLowerCase()),
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          className="block w-full text-left border-b p-2 text-sm"
                          onClick={() => {
                            setBooking(item);
                            setPicker(false);
                          }}
                        >
                          {item.reference} · {item.title} · {item.date}
                        </button>
                      ))}
                    {!bookings.length && (
                      <p className="text-sm text-neutral-500">No bookings in this service.</p>
                    )}
                  </div>
                  {bookingCursor && (
                    <button
                      className={button}
                      onClick={async () => {
                        try {
                          const result = await api("bookings", {
                            customerId: uid,
                            service,
                            cursor: bookingCursor,
                          });
                          setBookings((previous) => unique([...previous, ...result.items]));
                          setBookingCursor(result.nextCursor);
                        } catch (e) {
                          report(e);
                        }
                      }}
                    >
                      Load more bookings
                    </button>
                  )}
                </section>
              )}
              <form onSubmit={send} className="support-composer p-3 border-t space-y-2">
                {(booking || file || reply) && (
                  <div className="text-sm flex gap-2 flex-wrap">
                    {booking && (
                      <span className="bg-blue-50 p-2 rounded">
                        Booking #{booking.reference}{" "}
                        <button type="button" disabled={locked} onClick={() => setBooking(null)}>
                          ×
                        </button>
                      </span>
                    )}
                    {file && (
                      <span className="bg-neutral-100 p-2 rounded">
                        {file.name}{" "}
                        <button type="button" disabled={locked} onClick={() => setFile(null)}>
                          ×
                        </button>
                      </span>
                    )}
                    {reply && (
                      <span className="bg-neutral-100 p-2 rounded">
                        Reply: {reply.text?.slice(0, 60) || "Attachment / booking"}{" "}
                        <button type="button" disabled={locked} onClick={() => setReply(null)}>
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    className={button}
                    title="Choose this customer's booking"
                    aria-label="Choose a booking"
                    aria-expanded={picker}
                    disabled={locked}
                    onClick={() => setPicker((previous) => !previous)}
                  >
                    /
                  </button>
                  <textarea
                    className={`${field} resize-none`}
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
                  />
                  <button
                    className={`${button} support-send bg-blue-600 text-white hover:bg-blue-700`}
                    disabled={busy || (!draft.trim() && !file && !booking)}
                  >
                    {busy ? "Sending…" : retry.current ? "Retry" : "Send"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  <label className="cursor-pointer underline">
                    Attach file
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
                  <span>Files up to 8 MiB</span>
                  <span className="ml-auto">{draft.length}/4000</span>
                </div>
                {notice && (
                  <div className="text-sm text-amber-700">
                    {notice}{" "}
                    <button
                      type="button"
                      className="underline"
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
