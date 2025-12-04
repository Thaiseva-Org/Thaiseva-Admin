import { NotificationsRounded } from "@mui/icons-material";
import { format } from "timeago.js";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import { removeNotification } from "../services/Notification";

const NotificationCard = ({ notification, length, setNotifications }) => {
  const deleteNotification = async () => {
    await removeNotification(notification.id, setNotifications);
  };
  return (
    <div
      className={`text-black shadow-[0_0_5px_rgba(0,0,0,0.1)] ${
        !length ? "w-full xl:w-[48%] " : "w-full"
      } rounded-md py-3 pr-3 flex items-center relative`}
    >
      <button
        className="absolute right-0 top-0 mr-3 mt-3 bg-[var(--delete-button-bg-color)] text-[var(--action-button-text-color)] hover:[var(--delete-button-bg-hover-color)] rounded-full p-1"
        onClick={deleteNotification}
      >
        <DeleteForeverIcon />
      </button>
      <div className="mx-3">
        {notification.imageUrl !== undefined && notification.imageUrl !== "" ? (
          <img
            loading="lazy"
            src={notification.imageUrl}
            alt=""
            className="w-[3.25rem] h-[3.25rem] rounded-full mx-3 select-none"
          />
        ) : (
          <div className="w-[3.25rem] h-[3.25rem] rounded-full mx-3 bg-gray-300 flex items-center justify-center">
            <NotificationsRounded />
          </div>
        )}
      </div>
      <div className="w-[80%]">
        <div className="text-base font-bold w-[95%]">{notification.title}</div>
        <p className="text-sm text-gray-900 w-[95%]">{notification.desc}</p>
        {notification.datetime !== undefined && (
          <div>
            <p className="text-xs text-gray-700 text-right">
              {format(notification.datetime)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationCard;
