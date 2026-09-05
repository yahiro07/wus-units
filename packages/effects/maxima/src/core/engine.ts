import { UnitInterface } from "wafer-host/unit-types";
import { defaultEffectParameters, EffectParameters } from "@/core/definitions";
import workletUrl from "./maxima-processor-2?worker&url";
import { mapKnobCurveCenterUnity } from "@/core/volume-curve";

export function createEngine(unitInterface: UnitInterface | undefined) {
  const audioContext = unitInterface?.audioContext ?? new AudioContext();
  const inputNode = unitInterface?.audioInputNode ?? audioContext.createGain();
  const outputNode = unitInterface?.audioOutputNode ?? audioContext.destination;
  let parameters = { ...defaultEffectParameters };
  let workletNode: AudioWorkletNode | undefined;
  let isConnected = false;
  let isPassthroughConnected = false;
  let isWorkletModuleLoaded = false;
  let isDisposed = false;
  const gainNode = audioContext.createGain();

  const createWorklet = () => {
    if (!isConnected || !isWorkletModuleLoaded || isDisposed || workletNode) {
      return;
    }

    workletNode = new AudioWorkletNode(audioContext, "maxima-processor-2");
    if (isPassthroughConnected) {
      inputNode.disconnect(gainNode);
      isPassthroughConnected = false;
    }
    inputNode.connect(workletNode);
    workletNode.connect(gainNode);
    applyParameters();
  };

  void audioContext.audioWorklet
    .addModule(workletUrl)
    .then(() => {
      isWorkletModuleLoaded = true;
      createWorklet();
    })
    .catch((error: unknown) => {
      console.error("Failed to load Maxima AudioWorklet:", error);
    });

  function applyParameters() {
    const now = audioContext.currentTime;
    if (workletNode) {
      setSmoothValue(
        workletNode.parameters.get("drive"),
        parameters.drive,
        now,
      );
      setSmoothValue(
        workletNode.parameters.get("curve"),
        parameters.curve,
        now,
      );
      setSmoothValue(
        workletNode.parameters.get("ceiling"),
        parameters.ceiling,
        now,
      );
      setSmoothValue(
        workletNode.parameters.get("lookahead"),
        parameters.lookahead,
        now,
      );
    }
    setSmoothValue(
      gainNode.gain,
      mapKnobCurveCenterUnity(parameters.outputGain),
      now,
    );
  }

  return {
    connects() {
      if (isConnected || isDisposed) return;
      isConnected = true;
      inputNode.connect(gainNode);
      gainNode.connect(outputNode);
      isPassthroughConnected = true;
      createWorklet();
    },
    setParameters(nextParameters: EffectParameters) {
      parameters = { ...nextParameters };
      applyParameters();
    },
    cleanup() {
      isDisposed = true;
      if (isPassthroughConnected) inputNode.disconnect(gainNode);
      if (workletNode) {
        inputNode.disconnect(workletNode);
        workletNode.disconnect(gainNode);
      }
      gainNode.disconnect(outputNode);
      isPassthroughConnected = false;
      isConnected = false;
    },
  };
}

function setSmoothValue(
  parameter: AudioParam | undefined,
  value: number,
  now: number,
) {
  if (!parameter) return;
  parameter.cancelScheduledValues(now);
  parameter.setTargetAtTime(value, now, 0.015);
}
