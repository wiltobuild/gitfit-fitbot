import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <svg fill="none" height="64" viewBox="0 0 64 64" width="64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" fill="#141B3C" r="32" />
      <circle cx="32" cy="32" r="19" stroke="#1FC2AE" strokeDasharray="90 30" strokeLinecap="round" strokeWidth="7" transform="rotate(-72 32 32)" />
    </svg>,
    size
  );
}
