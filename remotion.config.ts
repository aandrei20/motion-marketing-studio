// Configurația Remotion Studio (`npm run remotion`). Randările din CLI folosesc API-ul Node
// (src/renderer/node/render.ts) și setează aceleași valori explicit.
import { Config } from "@remotion/cli/config";

Config.setEntryPoint("src/renderer/remotion/index.ts");
Config.setPublicDir(".cache/public");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setPixelFormat("yuv420p");
Config.setColorSpace("bt709");
Config.setOverwriteOutput(false);
