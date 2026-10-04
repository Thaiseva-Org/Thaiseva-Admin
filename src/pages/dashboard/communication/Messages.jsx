/**
 * @file Messages.jsx
 * @description Real-time conversation message feed with automatic scroll anchoring and empty state handling.
 *
 * Architecture & Features:
 * - Subscribes to the active chat conversation in Firestore `chats/{chatId}` via `onSnapshot`
 * - Automatically computes latest external incoming message for parent preview tracking
 * - Smooth scroll-to-bottom anchoring on message feed updates
 * - Handles three discrete UI states (no selected conversation, active message stream, fresh thread)
 *
 * @module Communication/Messages
 */

import { useContext, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
import { db } from "../../../firebase/firebase.config";
import Message from "./Message";

/**
 * Messages Component.
 *
 * Scrollable viewport displaying the real-time message stream for the active chat session.
 */
const Messages = ({ setLastMessage, oppositeUser }) => {
  const [messages, setMessages] = useState([]);
  const { data } = useContext(AdminChatContext);
  const containerRef = useRef(null);

  // Subscribe to the active conversation document
  useEffect(() => {
    if (!data?.chatId) {
      setMessages([]);
      setLastMessage({});
      return;
    }

    const unSub = onSnapshot(doc(db, "chats", data.chatId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const { messages: chatMessages = [] } = docSnapshot.data() || {};

        const incoming = chatMessages.filter(
          (message) => message?.senderId !== "_CustomerSupport"
        );
        setLastMessage(incoming[incoming.length - 1] || {});
        setMessages(chatMessages);
      } else {
        setMessages([]);
        setLastMessage({});
      }
    });

    return () => unSub();
  }, [data?.chatId, setLastMessage]);

  // Keep message scroll anchored to the bottom on new incoming messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-gradient-to-br from-neutral-50 to-white md:p-6 p-4 overflow-y-auto scroll-smooth"
    >
      {!oppositeUser?.uid ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mb-4">
            <span className="text-5xl">💬</span>
          </div>
          <h3 className="text-xl font-bold text-neutral-800 mb-2">Welcome to Messages</h3>
          <p className="text-neutral-500">Select a conversation from the left to start chatting</p>
        </div>
      ) : messages.length > 0 ? (
        <div className="space-y-4">
          {messages.map((m) => (
            <Message message={m} key={m.id} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-20 h-20 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">✉️</span>
          </div>
          <h3 className="text-lg font-bold text-neutral-800 mb-2">No messages yet</h3>
          <p className="text-sm text-neutral-500">Start the conversation by sending a message below</p>
        </div>
      )}
    </div>
  );
};

Messages.propTypes = {
  setLastMessage: PropTypes.func.isRequired,
  oppositeUser: PropTypes.object,
};

export default Messages;

