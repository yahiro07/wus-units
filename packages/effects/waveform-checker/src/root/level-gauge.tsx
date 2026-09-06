import { engine } from "@/root/central";
import { ChannelId } from "@/root/definitions";
import { meterDbFloor, MeterState } from "@/root/engine";
import { linearInterpolate } from "@/utils/helpers";
import { useEffect, useState } from "preact/hooks";

const silentMeterState: MeterState = {
  rmsDb: meterDbFloor,
  peakDb: meterDbFloor,
  holdDb: meterDbFloor,
};

function dbToPercent(db: number) {
  return linearInterpolate(db, meterDbFloor, 0, 0, 100, true);
}

function formatDb(db: number) {
  if (db <= meterDbFloor + 0.05) return "-∞";
  const sign = db > 0 ? "+" : "";
  return `${sign}${db.toFixed(1)}`;
}

export const LevelGauge = ({ channelId }: { channelId: ChannelId }) => {
  const [meterState, setMeterState] = useState<MeterState>(silentMeterState);

  useEffect(() => {
    return engine.subscribeMeter(channelId, setMeterState);
  }, [channelId]);

  const rmsPct = dbToPercent(meterState.rmsDb);
  const peakPct = dbToPercent(meterState.peakDb);
  const holdPct = dbToPercent(meterState.holdDb);

  return (
    <div class="flex-ha gap-1 h-200px">
      <div class="relative w-30px h-full bd-#888 bg-#eee overflow-hidden">
        <div
          class="absolute bottom-0 w-full bg-#7bf"
          style={{ height: `${rmsPct * 0.995}%` }}
        />
        <div
          class="absolute left-0 w-full h-2px bg-#8ef"
          style={{ bottom: `${peakPct * 0.995}%` }}
        />
        <div
          class="absolute left-0 w-full h-1px bg-#f08"
          style={{ bottom: `${holdPct * 0.995}%` }}
        />
      </div>
      <div class="flex-vl justify-between h-full w-25px py-0.5 font-monospace text-10px leading-none text-#222">
        <div>
          <div class="text-#888">PK</div>
          <div>{formatDb(meterState.holdDb)}</div>
        </div>
        <div>
          <div class="text-#888">RMS</div>
          <div>{formatDb(meterState.rmsDb)}</div>
        </div>
      </div>
    </div>
  );
};
