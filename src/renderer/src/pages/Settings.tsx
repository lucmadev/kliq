import type { Status } from "../api";
import Connection from "./Connection";
import General, { type GeneralSection } from "./General";

export type SettingsSection = GeneralSection | "connection";

export default function Settings({ section, status, refresh, notify }: {
  section: SettingsSection;
  status: Status;
  refresh: () => void;
  notify: (message: string) => void;
}) {
  if (section === "connection") {
    return <Connection status={status} refresh={refresh} notify={notify} />;
  }
  return <General section={section} refresh={refresh} />;
}
