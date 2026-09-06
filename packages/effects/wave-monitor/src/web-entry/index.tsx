import { render } from "preact";
import "./page.css";
import { onIframeUnitUnloading } from "wafer-host/unit-types";
import { css, cssRealm } from "@/common/css-realm";
import { App } from "@/root/app";
import { flexC } from "@/utils/utility-styles";

const root = document.getElementById("app")!;

document.adoptedStyleSheets = [cssRealm.sheet];

render(
  <div class={css(flexC(), { height: "100dvh", background: "#fff" })}>
    <App />
  </div>,
  root,
);

onIframeUnitUnloading(() => {
  render(null, root);
});
