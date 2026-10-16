import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("kliq", {
  version: "0.1.0",
});
