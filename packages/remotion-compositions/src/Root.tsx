import '@fontsource-variable/chivo';
import { Composition, Still } from 'remotion';
import { durationOf, newDocument, type MotionDocument } from '@dentweb/motion-schema';
import { MotionComp, CoverComp } from './MotionComp';

const fallback = newDocument('9:16', 'DENTSWEB STUDIO');
type Props = { doc: MotionDocument; coverTitle?: string };

export const Root = () => (
  <>
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
