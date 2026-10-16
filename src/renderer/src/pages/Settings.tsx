import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/animate-ui/components/animate/tabs";
import type { Status } from "../api";
import { useI18n } from "../i18n";
import Connection from "./Connection";
import General from "./General";

export default function Settings({ status, refresh, notify }: {
  status: Status;
  refresh: () => void;
  notify: (message: string) => void;
}) {
  const { t } = useI18n();
  const [section, setSection] = useState("connection");

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={section} onValueChange={setSection}>
        <TabsList>
          <TabsTrigger value="connection">{t("settings.connection")}</TabsTrigger>
          <TabsTrigger value="general">{t("settings.general")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {section === "general"
        ? <General refresh={refresh} />
        : <Connection status={status} refresh={refresh} notify={notify} />}
    </div>
  );
}
