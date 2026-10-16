import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { safeStorage } from "electron";
import { AppError } from "./errors";
import { useSecretStore } from "./secrets";
import { translate, type Locale } from "../shared/i18n";

export function installKeychain(file: string, locale: () => Locale): void {
  let data: Record<string, string> = {};
  try {
    data = JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    data = {};
  }

  const persist = () => {
    writeFileSync(file, JSON.stringify(data), { mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      /* some filesystems refuse the mode change */
    }
  };

  useSecretStore({
    available: () => safeStorage.isEncryptionAvailable(),
    get(key) {
      const stored = data[key];
      if (!stored || !safeStorage.isEncryptionAvailable()) return null;
      try {
        return safeStorage.decryptString(Buffer.from(stored, "base64"));
      } catch {
        return null;
      }
    },
    set(key, value) {
      if (!safeStorage.isEncryptionAvailable()) throw new AppError(translate(locale(), "error.keychain"));
      if (value == null) delete data[key];
      else data[key] = safeStorage.encryptString(value).toString("base64");
      persist();
    },
  });
}
