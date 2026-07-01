import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "./pages/Landing";
import Cockpit from "./pages/Cockpit";
import LinkLanding from "./pages/LinkLanding";
import { AmbientBackdrop } from "./components/AmbientBackdrop";
import { Providers } from "./components/Providers";

export default function App() {
  return (
    <Providers>
      <div className="relative min-h-screen overflow-x-hidden">
        <AmbientBackdrop />
        <div className="relative z-10">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/cockpit" element={<Cockpit />} />
            <Route path="/openrails/flow" element={<LinkLanding />} />
            <Route path="/openrails/card" element={<LinkLanding />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </Providers>
  );
}
