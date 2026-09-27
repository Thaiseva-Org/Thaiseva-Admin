/**
 * @fileoverview GlobalError component serves as a boundary error page.
 * It is used to catch and display unexpected routing errors in the application.
 */

import React from "react";
import { useRouteError } from "react-router-dom";

/**
 * GlobalError is a React component that displays an error message when an unexpected
 * error occurs during routing. It utilizes the `useRouteError` hook from react-router-dom
 * to capture and display the error details.
 *
 * @returns {React.JSX.Element} The rendered error page component with an option to reload.
 */
const GlobalError = () => {
    const error = useRouteError();
    console.error(error);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-800 p-4">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
                <div className="mb-6">
                    <svg
                        className="w-16 h-16 text-red-500 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        ></path>
                    </svg>
                </div>
                <h1 className="text-2xl font-bold mb-2 text-gray-900">
                    Oops! Something went wrong.
                </h1>
                <p className="text-gray-600 mb-6">
                    We encountered an unexpected error. Please try reloading the page.
                </p>

                {error?.statusText || error?.message ? (
                    <div className="bg-red-50 p-3 rounded text-sm text-red-600 mb-6 overflow-auto max-h-32">
                        <p className="font-mono">{error.statusText || error.message}</p>
                    </div>
                ) : null}

                <button
                    onClick={() => window.location.reload()}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-full transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                >
                    Reload Page
                </button>
            </div>
        </div>
    );
};

export default GlobalError;
