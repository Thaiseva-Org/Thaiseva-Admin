import { useState } from "react";
import Sidebar from "../Sidebar";
import Chat from "../Chat";
import CustomerSupportInbox from "./CustomerSupportInbox";
import PageHeading from "../../../../components/PageHeading";

const CustomerChat = () => {
  const [openSidebar, setOpenSidebar] = useState(false);
  const [legacy, setLegacy] = useState(false);

  if (!legacy) {
    return (
      <div className="animate-fade-in flex flex-col h-[calc(100vh-6.2rem)] max-sm:h-[calc(100vh-5.2rem)]">
        {/* Full-height fitted customer support inbox */}
        <div className="flex-1 min-h-0 relative">
          <CustomerSupportInbox />
        </div>
        <div className="text-right pt-1 flex-shrink-0">
          <button
            type="button"
            className="text-[11px] text-neutral-400 hover:text-neutral-600 underline transition-colors"
            onClick={() => setLegacy(true)}
          >
            Open previous chat system (migration period)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <PageHeading
          text="Legacy Customer Chat"
          subtitle="Previous customer chat system during transition period"
          icon="💬"
          className="!mb-0"
        />
        <button
          className="text-xs font-semibold text-primary-600 hover:text-primary-800 underline"
          onClick={() => setLegacy(false)}
        >
          ← Return to new support inbox
        </button>
      </div>

      <div className="h-[calc(100vh-12rem)] max-md:h-[calc(100vh-9rem)] flex relative">
        {/* Legacy Chat Container */}
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
    </div>
  );
};

export default CustomerChat;
