import { useMemo } from "preact/hooks";
import { SelectorOption } from "@/utils/selector-option";
import { cz } from "@/utils/cz";

type Props<T extends string | number> = {
  options: SelectorOption<T>[];
  value: T;
  onChange: (value: T) => void;
  reverseOptionsOrder?: boolean;
  className?: string;
};

export function GeneralSelector<T extends string | number>({
  options,
  value,
  onChange,
  reverseOptionsOrder = false,
  className,
}: Props<T>) {
  const orderedOptions = useMemo(() => {
    if (reverseOptionsOrder) {
      return [...options].reverse();
    }
    return options;
  }, [options, reverseOptionsOrder]);

  const wrapOnChange = (e: Event) => {
    const isNumber = typeof options[0].value === "number";
    const rawValue = (e.target as HTMLSelectElement).value;
    const newValue = isNumber ? parseFloat(rawValue) : rawValue;
    onChange(newValue as T);
  };
  return (
    <select
      class={cz("bd-#aaa bg-#eee", className)}
      value={value}
      onChange={wrapOnChange}
    >
      {orderedOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
