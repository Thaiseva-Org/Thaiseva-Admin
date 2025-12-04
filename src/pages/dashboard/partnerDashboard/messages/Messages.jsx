import { doc, onSnapshot } from "firebase/firestore";
import { useContext, useEffect, useState } from "react";
import { chatsCollection } from "../../../../firebase/firebase.config";
import Message from "./Message";
import { PartnerChatContext } from "../../../../contextAPIs/PartnerChatProvider";
import { useRef } from "react";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const { data } = useContext(PartnerChatContext);
  const ref = useRef();

  useEffect(() => {
    const unSub = onSnapshot(doc(chatsCollection, data.chatId), (doc) => {
      doc.exists() && setMessages(doc.data().messages);
    });

    return () => {
      unSub();
    };
  }, [data]);

  useEffect(() => {
    ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={ref}
      className="bg-[var(--msg-bg-color)] h-[calc(100%-112px)] md:p-3 p-2 overflow-y-scroll scroll-smooth no-scrollbar flex flex-col gap-1"
    >
      {messages && messages?.map((m) => <Message message={m} key={m.id} />)}
    </div>
  );
};

export default Messages;
