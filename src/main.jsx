/**
 * @fileoverview Main entry point for the React application.
 * This file is responsible for initializing the React application and rendering it into the DOM.
 * It wraps the application's router with all the necessary global context providers such as
 * authentication, partners, requirements, chat, notifications, maps, and snackbar notifications.
 * It also applies React.StrictMode for highlighting potential problems in the application.
 */
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
import PartnerChatProvider from "./contextAPIs/PartnerChatProvider";
import { NotificationsProvider } from "./contextAPIs/NotificationsProvider";
import GoogleMapsProvider from "./components/GoogleMapsProvider";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <PartnerProvider>
        <RequirementsProvider>
          <AdminChatProvider>
            <NotificationsProvider>
              <PartnerChatProvider>
                <SnackbarProvider maxSnack={3}>
                  <GoogleMapsProvider>
                    <RouterProvider router={router} />
                  </GoogleMapsProvider>
                </SnackbarProvider>
              </PartnerChatProvider>
            </NotificationsProvider>
          </AdminChatProvider>
        </RequirementsProvider>
      </PartnerProvider>
    </AuthProvider>
  </React.StrictMode>
);
