import { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { css, styled } from "@/common/css-realm";
import { GeneralSelector } from "@/components/general-selector";
import { GridBackground } from "@/components/grid-background";
import { LayeredLayout } from "@/components/layered-layout";
import { actions, useSetupDrivers, useStoreSnapshot } from "@/root/central";
import { ChannelId } from "@/root/definitions";
import { LevelGauge } from "@/root/level-gauge";
import { cz } from "@/utils/cz";
import { createSelectorOptions } from "@/utils/selector-option";
import { flexC } from "@/utils/utility-styles";

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
  children,
  height = 100,
  labelContent,
}: {
  children?: ComponentChildren;
  height?: number;
  labelContent: ComponentChildren;
}) => {
  return (
    <div class="flex-h gap-1">
      {labelContent}
      <div class={cz("w-800px", height === 200 ? "h-200px" : "h-100px")}>
        {children}
      </div>
    </div>
  );
};

const HostBpmContainer = () => {
  const { hostBpm } = useStoreSnapshot();
  return <div class="flex-h gap-1">hostBpm: {hostBpm || "--"}</div>;
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
  return <canvas ref={canvasRef} class="w-full h-full" />;
};

const GraphBorderFrame = styled.div({
  width: "100%",
  height: "100%",
  border: "solid 1px #aaa",
});

const LaneLabel = ({
  label,
  labelBold,
  onClick,
}: {
  label: string;
  labelBold?: boolean;
  onClick?: () => void;
}) => {
  return (
    <div
      class={cz(
        "flex-c w-100px",
        labelBold && "font-bold",
        onClick && "cursor-pointer",
      )}
      onClick={onClick}
    >
      {label}
    </div>
  );
};

const ChannelLaneContainer = ({
  channelId,
  labelContent,
}: {
  channelId: ChannelId;
  labelContent: ComponentChildren;
}) => {
  return (
    <LaneBox height={200} labelContent={labelContent}>
      <LayeredLayout>
        <GridBackground nx={4} ny={1} />
        <GraphBorderFrame />
        <GraphCanvas
          canvasSetterFn={(canvas) => actions.setWaveCanvas(channelId, canvas)}
        />
      </LayeredLayout>
    </LaneBox>
  );
};

const TimeSpanGauge = () => {
  const { barLength, hostBpm } = useStoreSnapshot();
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
  const { barLength } = useStoreSnapshot();
  return (
    <div class="flex-ha gap-4 justify-between">
      <TimeSpanGauge />
      <div class="flex-ha gap-4">
        <HostBpmContainer />
        <div class="flex-ha gap-1">
          <div>bars</div>
          <GeneralSelector
            className="h-28px"
            options={barLengthOptions}
            value={barLength}
            onChange={actions.setBarLength}
          />
        </div>
      </div>
    </div>
  );
};

const LevelMeterSection = () => {
  const { altMetersLayout } = useStoreSnapshot();
  return (
    <div onClick={actions.toggleMetersLayout} class="flex-c">
      {!altMetersLayout && (
        <div class="flex-vc gap-2">
          <LevelGauge />
          <LevelGauge />
        </div>
      )}
      {altMetersLayout && (
        <div class="flex-c gap-2">
          <div>
            <div class="flex-c">A</div>
            <LevelGauge />
          </div>
          <div>
            <div class="flex-c">B</div>
            <LevelGauge />
          </div>
        </div>
      )}
    </div>
  );
};

const PageRoot = () => {
  const { activeChannelId } = useStoreSnapshot();
  return (
    <div class="flex-v gap-2">
      <TopControlBar />
      <div class="flex-h gap-2">
        <div class="flex-v gap-2">
          <ChannelLaneContainer
            channelId="ch1"
            labelContent={
              <LaneLabel
                label="A"
                onClick={() => actions.setActiveChannelId("ch1")}
                labelBold={activeChannelId === "ch1"}
              />
            }
          />
          <ChannelLaneContainer
            channelId="ch2"
            labelContent={
              <LaneLabel
                label="B"
                onClick={() => actions.setActiveChannelId("ch2")}
                labelBold={activeChannelId === "ch2"}
              />
            }
          />
        </div>
        <LevelMeterSection />
      </div>
    </div>
  );
};

export const App = () => {
  useSetupDrivers();
  return <PageRoot />;
};
