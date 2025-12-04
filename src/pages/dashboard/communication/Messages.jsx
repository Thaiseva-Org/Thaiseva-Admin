import { useContext, useRef } from "react";
import Message from "./Message";
import { useState } from "react";
import { useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { AdminChatContext } from "../../../contextAPIs/AdminChatProvider";
import { db } from "../../../firebase/firebase.config";
const Messages = ({ setLastMessage, oppositeUser }) => {
  const [messages, setMessages] = useState([]);
  const { data } = useContext(AdminChatContext);
  const ref = useRef();

  useEffect(() => {
    const unSub = onSnapshot(doc(db, "chats", data.chatId), (doc) => {
      if (doc.exists()) {
        const { messages } = doc.data();

        const matched = messages?.filter((message) => {
          if (message.senderId !== "_CustomerSupport") {
            return message;
          }
        });
        setLastMessage(matched[matched.length - 1]);
        setMessages(messages);
      } else {
        setMessages([]);
        setLastMessage({});
      }
    });

    return () => {
      unSub();
    };
  }, [data, setLastMessage, oppositeUser]);

  useEffect(() => {
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={ref}
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
          {messages?.map((m) => <Message message={m} key={m.id} />)}
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

export default Messages;
