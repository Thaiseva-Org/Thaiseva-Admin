import { useState } from "react";
import Chat from "../Chat";
import Sidebar from "../Sidebar";

const DriverChat = () => {
  const [openSidebar, setOpenSidebar] = useState(false);

  return (
    <div className="overflow-hidden  h-[calc(100vh-8.0rem)] max-md:h-[calc(100vh-5.5rem)] shadow rounded-lg flex relative">
      <div
        className={`lg:w-4/12 w-full h-full duration-300 z-10 lg:static absolute ${
          openSidebar ? "top-0 left-0" : "-left-full"
        }`}
      >
        <Sidebar setOpenSidebar={setOpenSidebar} />
      </div>
      <div className="lg:w-8/12 w-full h-full">
        <Chat setOpenSidebar={setOpenSidebar} />
      </div>
    </div>
  );
};

export default DriverChat;
