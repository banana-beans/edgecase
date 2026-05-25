import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #4f8ef7 0%, #a855f7 100%)",
          color: "white",
          fontSize: 110,
          fontWeight: 900,
          letterSpacing: -4,
        }}
      >
        E
      </div>
    ),
    { ...size }
  );
}
