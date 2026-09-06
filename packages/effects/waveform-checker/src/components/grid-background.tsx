import { css } from "@/common/css-realm";

export const GridBackground = ({
  className,
  nx,
  ny,
  bgAlterStrideX,
}: {
  className?: string;
  nx: number;
  ny: number;
  bgAlterStrideX?: number;
}) => {
  const bgAlterStride = bgAlterStrideX ?? 0;

  return (
    <div
      className={css(
        {
          // position: "absolute",
          // left: 0,
          // top: 0,
          position: "relative",
          width: "100%",
          height: "100%",
          border: "solid 0.5px #d4d4d4",
          "& > div": {
            position: "absolute",
            width: `${100 / nx}%`,
            height: `${100 / ny}%`,
            border: "solid 0.5px #d4d4d4",
          },
        },
        className,
      )}
    >
      {Array.from({ length: nx * ny }).map((_, i) => {
        const xi = i % nx;
        const yi = Math.floor(i / nx);
        const bgAlter = xi % (bgAlterStride * 2) < bgAlterStride;
        return (
          <div
            key={`${xi}-${yi}`}
            style={{
              left: `${(xi * 100) / nx}%`,
              top: `${(yi * 100) / ny}%`,
              backgroundColor: bgAlter ? "#f0f0f0" : "#fff",
            }}
          />
        );
      })}
    </div>
  );
};
