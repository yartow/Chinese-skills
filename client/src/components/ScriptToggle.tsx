import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ScriptToggleProps {
  isTraditional: boolean;
  onToggle: (isTraditional: boolean) => void;
}

export default function ScriptToggle({ isTraditional, onToggle }: ScriptToggleProps) {
  return (
    <div className="flex items-center gap-2" data-testid="script-toggle">
      <Label htmlFor="script-toggle" className="text-sm font-medium cursor-pointer">
        <span className="hidden sm:inline">{isTraditional ? "Traditional" : "Simplified"}</span>
        <span className="sm:hidden font-chinese">{isTraditional ? "繁" : "简"}</span>
      </Label>
      <Switch
        id="script-toggle"
        checked={isTraditional}
        onCheckedChange={onToggle}
        data-testid="switch-script"
      />
    </div>
  );
}
