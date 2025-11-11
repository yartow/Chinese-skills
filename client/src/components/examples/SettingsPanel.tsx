import { useState } from "react";
import SettingsPanel from "../SettingsPanel";
import { Card } from "@/components/ui/card";

export default function SettingsPanelExample() {
  const [level, setLevel] = useState(120);
  const [dailyCount, setDailyCount] = useState(5);

  return (
    <div className="p-8 flex items-center justify-center">
      <Card className="p-6 w-96">
        <SettingsPanel
          currentLevel={level}
          dailyCharCount={dailyCount}
          onLevelChange={setLevel}
          onDailyCharCountChange={setDailyCount}
        />
      </Card>
    </div>
  );
}
