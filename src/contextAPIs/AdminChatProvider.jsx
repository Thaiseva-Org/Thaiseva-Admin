import { useContext } from "react";
import { createContext } from "react";
// import { AuthContext } from "./AuthProvider";
import { useReducer } from "react";
import { PartnerContext } from "./PartnerProvider";

export const AdminChatContext = createContext();

const AdminChatProvider = ({ children }) => {
  const { chatRoom } = useContext(PartnerContext);

  const INITIAL_STATE = {
    chatId: "null",
    searchData: "",
    oppositeUser: {},
  };

  const chatReducer = (state, action) => {
    switch (action.type) {
      case "CHANGE_USER":
        return {
          oppositeUser: action.payload,
          searchData: "",
          chatId: action.payload.uid + `_${chatRoom}`,
        };

      case "CHANGE_FILTER":
        return {
          searchData: action.payload,
          oppositeUser: {},
          chatId: "null",
        };

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);
  return (
    <AdminChatContext.Provider value={{ data: state, dispatch }}>
      {children}
    </AdminChatContext.Provider>
  );
};

export default AdminChatProvider;
