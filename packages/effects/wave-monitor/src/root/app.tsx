import { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { css, styled } from "@/common/css-realm";
import { GeneralSelector } from "@/components/general-selector";
import { GridBackground } from "@/components/grid-background";
import { LayeredLayout } from "@/components/layered-layout";
import { useSetupDrivers } from "@/root/drivers";
import { store } from "@/root/store";
import { createSelectorOptions } from "@/utils/selector-option";
import { flexC, flexH, flexHA, flexV, npx } from "@/utils/utility-styles";

const barLengthOptions = createSelectorOptions([
  [0.0625, "1/16"],
  [0.125, "1/8"],
  [0.25, "1/4"],
  [0.5, "1/2"],
  [1, "1"],
  [2, "2"],
  [4, "4"],
  [8, "8"],
  [16, "16"],
]);

const LaneBox = ({
  label,
  children,
  height = 100,
}: {
  label: string;
  children?: ComponentChildren;
  height?: number;
}) => {
  return (
    <div class={css(flexH(1))}>
      <div class={css(flexC(1), { width: npx(100) })}>{label}</div>
      <div
        class={css({
          width: npx(800),
          height: npx(height),
        })}
      >
        {children}
      </div>
    </div>
  );
};

const HostBpmContainer = () => {
  const { hostBpm } = store.useSnapshot();
  return <div class={css(flexH(1))}>hostBpm: {hostBpm || "--"}</div>;
};

const GraphCanvas = ({
  canvasSetterFn,
}: {
  canvasSetterFn: (canvas: HTMLCanvasElement | null) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const bounds = canvas.getBoundingClientRect();
      canvas.width = Math.round(bounds.width);
      canvas.height = Math.round(bounds.height);
      canvasSetterFn(canvas);
      return () => canvasSetterFn(null);
    }
  }, []);
  return (
    <canvas ref={canvasRef} class={css({ width: "100%", height: "100%" })} />
  );
};

const GraphBorderFrame = styled.div({
  width: "100%",
  height: "100%",
  border: "solid 1px #aaa",
});

const ChannelLaneContainer = ({
  channelId,
  label,
}: {
  channelId: "ch1" | "ch2";
  label: string;
}) => {
  const canvasSetterFn = {
    ch1: store.setWavePlotterCanvasCh1,
    ch2: store.setWavePlotterCanvasCh2,
  }[channelId];
  return (
    <LaneBox label={label} height={200}>
      <LayeredLayout>
        <GridBackground nx={4} ny={1} />
        <GraphBorderFrame />
        <GraphCanvas canvasSetterFn={canvasSetterFn} />
      </LayeredLayout>
    </LaneBox>
  );
};

const TimeSpanGauge = () => {
  const { barLength, hostBpm } = store.useSnapshot();
  const unitLength = barLength / 4;
  const unitLengthText = unitLength >= 1 ? unitLength : `1/${1 / unitLength}`;
  const unitMs = unitLength * (240 / hostBpm) * 1000;
  const unitMsText = Number(unitMs.toFixed(3));

  return (
    <div class={cssTimeSpanGauge}>
      <div>
        <span>←</span>
        <span>
          {unitLengthText}bar, {unitMsText}ms
        </span>
        <span>→</span>
      </div>
    </div>
  );
};
const cssTimeSpanGauge = css({
  paddingLeft: "104px",
  "> div": {
    width: "201px",
    height: "28px",
    border: "solid 1px #aaa",
    ...flexC(),
    justifyContent: "space-between",
  },
});

const TopControlBar = () => {
  return (
    <div class={css(flexHA(4), { justifyContent: "space-between" })}>
      <TimeSpanGauge />
      <div class={css(flexHA(4))}>
        <HostBpmContainer />
        <div class={css(flexHA(1))}>
          <div>bars</div>
          <GeneralSelector
            className={css({ height: "28px" })}
            options={barLengthOptions}
            value={1}
            onChange={store.setBarLength}
          />
        </div>
      </div>
    </div>
  );
};

const PageRoot = () => {
  return (
    <div class={css(flexV(2))}>
      <TopControlBar />
      <ChannelLaneContainer channelId="ch1" label="PORT1" />
      <ChannelLaneContainer channelId="ch2" label="PORT2" />
    </div>
  );
};

export const App = () => {
  useSetupDrivers();
  return <PageRoot />;
};
