import { ComponentChildren, toChildArray } from "preact";
import { css } from "@/common/css-realm";

export const LayeredLayout = ({
  children,
}: {
  children: ComponentChildren;
}) => {
  return (
    <div class={className}>
      {toChildArray(children).map((child, i) => (
        <div key={i}>{child}</div>
      ))}
    </div>
  );
};
const className = css({
  position: "relative",
  width: "100%",
  height: "100%",
  ">div": {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
});
