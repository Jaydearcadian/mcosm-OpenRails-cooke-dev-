import { Composition } from 'remotion';
import { MainVideo } from './src/MainVideo';
import './src/style.css';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OpenRailsDemo"
        component={MainVideo}
        durationInFrames={2700} // 90 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
