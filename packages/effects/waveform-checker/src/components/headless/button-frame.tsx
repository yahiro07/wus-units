import { ComponentChildren } from "preact";

export const ButtonFrame = ({
  children,
  onClick,
}: {
  children: ComponentChildren;
  onClick: () => void;
}) => {
  return (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      {children}
    </div>
  );
};
