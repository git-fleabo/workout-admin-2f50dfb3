import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SettingsBackLink() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit">
      <Link to="/manage">
        <ArrowLeft className="mr-1 h-4 w-4" /> Settings
      </Link>
    </Button>
  );
}
