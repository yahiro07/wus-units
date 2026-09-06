import { css } from "@/common/css-realm";
import { npx } from "@/utils/utility-styles";

export const LevelGauge = () => {
  return <div class={style.base}></div>;
};
const style = {
  base: css({
    width: npx(40),
    height: npx(200),
    border: "solid 1px #aaa",
  }),
};
