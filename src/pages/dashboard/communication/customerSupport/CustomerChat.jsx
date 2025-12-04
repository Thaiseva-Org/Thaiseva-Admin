import Sidebar from "../Sidebar";
import Chat from "../Chat";
import { useState } from "react";

const CustomerChat = () => {
  const [openSidebar, setOpenSidebar] = useState(false);

  return (
    <div className="h-[calc(100vh-8.0rem)] max-md:h-[calc(100vh-5.5rem)] flex relative animate-fade-in">
      {/* Modern Chat Container */}
      <div className="w-full h-full bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden flex">
        {/* Sidebar */}
        <div
          className={`lg:w-[380px] w-full h-full duration-300 ease-in-out z-20 lg:static absolute bg-white border-r border-neutral-200 ${
            openSidebar ? "left-0" : "-left-full lg:left-0"
          }`}
        >
          <Sidebar setOpenSidebar={setOpenSidebar} filterType="customer" />
        </div>
        
        {/* Chat Area */}
        <div className="flex-1 w-full h-full bg-gradient-to-br from-neutral-50 to-white">
          <Chat setOpenSidebar={setOpenSidebar} />
        </div>
      </div>
    </div>
  );
};

export default CustomerChat;
