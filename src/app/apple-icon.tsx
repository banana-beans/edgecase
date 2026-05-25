import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 104,
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
