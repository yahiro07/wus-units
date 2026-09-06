import { cz } from "@/utils/cz";
import { HTMLAttributes, JSX } from "preact";

export const twStyled = new Proxy(
  {},
  {
    get(_, _tagName) {
      const TagName = _tagName as any;
      return (...classes: string[]) => {
        return (props: HTMLAttributes) => {
          return (
            <TagName {...props} class={cz(...classes, props.class as string)} />
          );
        };
      };
    },
  },
) as Record<
  string,
  (...classes: string[]) => (props: HTMLAttributes) => JSX.Element
>;
