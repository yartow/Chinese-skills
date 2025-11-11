import { useState } from "react";
import ScriptToggle from "../ScriptToggle";

export default function ScriptToggleExample() {
  const [isTraditional, setIsTraditional] = useState(false);

  return (
    <div className="p-8 flex items-center justify-center">
      <ScriptToggle isTraditional={isTraditional} onToggle={setIsTraditional} />
    </div>
  );
}
