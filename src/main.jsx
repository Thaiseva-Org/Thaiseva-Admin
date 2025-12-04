import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { router } from "./routes/Route";
import AuthProvider from "./contextAPIs/AuthProvider";
import AdminChatProvider from "./contextAPIs/AdminChatProvider";
import { RouterProvider } from "react-router-dom";
import PartnerProvider from "./contextAPIs/PartnerProvider";
import RequirementsProvider from "./contextAPIs/RequirementsProvider";
import { SnackbarProvider } from "notistack";
import { LoadScript } from "@react-google-maps/api";
import PartnerChatProvider from "./contextAPIs/PartnerChatProvider";
import { NotificationsProvider } from "./contextAPIs/NotificationsProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <PartnerProvider>
        <RequirementsProvider>
          <AdminChatProvider>
            <NotificationsProvider>
              <PartnerChatProvider>
                <SnackbarProvider maxSnack={3}>
                  <LoadScript
                    googleMapsApiKey={import.meta.env.VITE_Google_Api_Key}
                    libraries={["places"]}
                  >
                    <RouterProvider router={router} />
                  </LoadScript>
                </SnackbarProvider>
              </PartnerChatProvider>
            </NotificationsProvider>
          </AdminChatProvider>
        </RequirementsProvider>
      </PartnerProvider>
    </AuthProvider>
  </React.StrictMode>
);
