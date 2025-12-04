import Chats from "./Chats";
import Search from "./Search";

const Sidebar = ({ setOpenSidebar, filterType }) => {
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Modern Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 border-b border-primary-700">
        <h2 className="text-white font-bold text-lg flex items-center gap-2">
          <span className="text-2xl">💬</span>
          Messages
        </h2>
      </div>
      
      {/* Search */}
      <Search setOpenSidebar={setOpenSidebar} />
      
      {/* Chat List */}
      <div className="flex-1 overflow-hidden">
        <Chats setOpenSidebar={setOpenSidebar} filterType={filterType} />
      </div>
    </div>
  );
};

export default Sidebar;
