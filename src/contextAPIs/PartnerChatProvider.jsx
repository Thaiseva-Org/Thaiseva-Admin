import { useContext } from "react";
import { createContext } from "react";
import { AuthContext } from "./AuthProvider";
import { useReducer } from "react";

export const PartnerChatContext = createContext();
const PartnerChatProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const INITIAL_STATE = {
    chatId: "null",
    oppositeUser: {},
  };

  const chatReducer = (state, action) => {
    switch (action.type) {
      case "CHANGE_USER":
        return {
          oppositeUser: action.payload,
          chatId: user?.uid + action?.payload?.uid,
        };

      default:
        return state;
    }
  };

  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE);
  return (
    <PartnerChatContext.Provider value={{ data: state, dispatch }}>
      {children}
    </PartnerChatContext.Provider>
  );
};

export default PartnerChatProvider;
