import { lazy } from "react";

const Main = lazy(() => import("./Main"));
const Dashboard = lazy(() => import("./Dashboard"));

export { Main, Dashboard };
