import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 같은 와이파이의 휴대폰에서도 접속 가능 (모바일 촬영 테스트용)
    port: 5173,
  },
});
