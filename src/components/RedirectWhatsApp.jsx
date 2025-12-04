import { handleRedirectWhatsApp } from "../utils/utils";

const RedirectWhatsApp = ({ number }) => {
  return (
    <div
      onClick={() => handleRedirectWhatsApp(number)}
      className="cursor-pointer flex items-center justify-center"
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
        alt=""
        className="w-8 h-8"
      />
    </div>
  );
};

export default RedirectWhatsApp;
