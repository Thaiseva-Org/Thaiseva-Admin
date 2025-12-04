import { useState, useEffect } from "react";

const TimeAgo = ({ firestoreTimestamp }) => {
  const [time, setTime] = useState("Loading..");
  const [callTime, setCallTime] = useState(15000);
  useEffect(() => {
    const intervalId = setInterval(() => {
      const updatedTime = calculateTimeAgo(firestoreTimestamp);
      setTime(updatedTime);
    }, callTime); // Update every minute

    return () => {
      clearInterval(intervalId); // Clear the interval when the component unmounts
    };
  }, [firestoreTimestamp, callTime]);

  function calculateTimeAgo(timestamp) {
    setCallTime(60000);
    const currentTimestamp = new Date();
    const firestoreTimestamp = new Date(
      timestamp?.seconds * 1000 + timestamp?.nanoseconds / 1000000
    );
    const timeDifference = currentTimestamp - firestoreTimestamp;

    const minutes = Math.floor(timeDifference / 60000); // 1 minute = 60,000 milliseconds
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) {
      return "Just now";
    } else if (minutes === 1) {
      return "1 min ago";
    } else if (minutes < 60) {
      return minutes + " mins ago";
    } else if (hours === 1) {
      return "1 hour ago";
    } else if (hours < 24) {
      return hours + " hours ago";
    } else if (days === 1) {
      return "1 day ago";
    } else {
      return days + " days ago";
    }
  }

  return <span>{time}</span>;
};

export default TimeAgo;
