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
  const [section, setSection] = useState("general");

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={section} onValueChange={setSection} className="items-center">
        <TabsList>
          <TabsTrigger value="general">{t("settings.general")}</TabsTrigger>
          <TabsTrigger value="connection">{t("settings.connection")}</TabsTrigger>
        </TabsList>
      </Tabs>
      {section === "general"
        ? <General refresh={refresh} />
        : <Connection status={status} refresh={refresh} notify={notify} />}
    </div>
  );
}
