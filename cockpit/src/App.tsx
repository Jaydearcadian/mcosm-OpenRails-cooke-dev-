import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Cockpit from "./pages/Cockpit";
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
          </Routes>
        </div>
      </div>
    </Providers>
  );
}
