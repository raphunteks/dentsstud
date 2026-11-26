import '@fontsource-variable/chivo';
import { Composition, Still } from 'remotion';
import { durationOf, newDocument, type MotionDocument } from '@dentweb/motion-schema';
import { MotionComp, CoverComp } from './MotionComp';
import { ViralStyleComp, type ViralStyleProps } from './ViralStyleComp';

const fallback = newDocument('9:16', 'DENTSWEB STUDIO');
type Props = { doc: MotionDocument; coverTitle?: string };

const fallbackViral: ViralStyleProps = {
  slug: 'sejarah-3d',
  title: 'Sejarah 3D Sinematik',
  topic: 'Misteri Kota Bawah Tanah 85 Meter',
  archetype: 'gold_sepia',
  words: [
    { text: 'Kota', start: 0, end: 0.4 },
    { text: 'kuno', start: 0.4, end: 0.8 },
    { text: 'sedalam', start: 0.8, end: 1.3 },
    { text: '85', start: 1.3, end: 1.7 },
    { text: 'meter.', start: 1.7, end: 2.3 },
  ],
  audioUrl: '',
  durationInFrames: 300,
};

export const Root = () => (
  <>
    <Composition
      id="ViralStyleComp"
      component={ViralStyleComp as unknown as React.ComponentType<Record<string, unknown>>}
      durationInFrames={fallbackViral.durationInFrames}
      fps={30}
      width={720}
      height={1280}
      defaultProps={fallbackViral as unknown as Record<string, unknown>}
      calculateMetadata={({ props }: { props: Record<string, unknown> }) => {
        const p = props as unknown as ViralStyleProps;
        return {
          durationInFrames: Math.max(90, Math.round(p.durationInFrames || 300)),
          fps: 30,
          width: 720,
          height: 1280,
        };
      }}
    />
    <Composition
      id="DentswebMotion"
      component={MotionComp}
      durationInFrames={durationOf(fallback)}
      fps={fallback.fps}
      width={fallback.width}
      height={fallback.height}
      defaultProps={{ doc: fallback }}
      calculateMetadata={({ props }: { props: Props }) => ({ durationInFrames: durationOf(props.doc), fps: props.doc.fps, width: props.doc.width, height: props.doc.height })}
    />
    <Composition
      id="DentwebMotion"
      component={MotionComp}
      durationInFrames={durationOf(fallback)}
      fps={fallback.fps}
      width={fallback.width}
      height={fallback.height}
      defaultProps={{ doc: fallback }}
      calculateMetadata={({ props }: { props: Props }) => ({ durationInFrames: durationOf(props.doc), fps: props.doc.fps, width: props.doc.width, height: props.doc.height })}
    />
    <Still
      id="DentswebCover"
      component={CoverComp}
      width={fallback.width}
      height={fallback.height}
      defaultProps={{ doc: fallback }}
      calculateMetadata={({ props }: { props: Props }) => ({ width: props.doc.width, height: props.doc.height })}
    />
    <Still
      id="DentwebCover"
      component={CoverComp}
      width={fallback.width}
      height={fallback.height}
      defaultProps={{ doc: fallback }}
      calculateMetadata={({ props }: { props: Props }) => ({ width: props.doc.width, height: props.doc.height })}
    />
  </>
);
