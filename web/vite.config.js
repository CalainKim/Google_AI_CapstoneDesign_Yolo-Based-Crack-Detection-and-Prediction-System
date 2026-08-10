import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 같은 네트워크의 휴대폰에서도 접속 가능
    port: 5173,
    // API를 같은 출처(/api)로 중계한다.
    // 포트를 하나만 열면 되므로 IP가 바뀌거나 터널을 거쳐도 그대로 동작한다.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
    allowedHosts: true, // 외부 터널 도메인으로 접속 허용
  },
});
