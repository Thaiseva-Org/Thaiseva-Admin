import { Alert } from "@mui/material";
import React from "react";

const MessageToAgent = () => {
  return (
    <div className="w-full h-screen flex items-center justify-center">
      <div className="banner-layout !shadow !shadow-black/30 w-1/3">
        <Alert severity="info" sx={{ mt: 1 }}>
          Please log in to the Agent app using these credentials. Calls will be
          assigned to you once your profile is approved by the admin.
        </Alert>
      </div>
    </div>
  );
};

export default MessageToAgent;
