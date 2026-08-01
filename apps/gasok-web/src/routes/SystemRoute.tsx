import { LiveVerticalSlice } from '../components/LiveVerticalSlice';
import { SystemMap } from '../components/SystemMap';
import { SystemNarrativeIntro } from '../components/SystemNarrativeIntro';

export default function SystemRoute() {
  return (
    <main>
      <SystemNarrativeIntro />

      <div id="live-system-run">
        <LiveVerticalSlice />
      </div>

      <SystemMap direct />
    </main>
  );
}
