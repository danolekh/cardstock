import { createRoot } from "react-dom/client";

import { Stage } from "./stage";

// oxlint-disable-next-line no-unassigned-import -- the stage's styles
import "./stage.css";

createRoot(document.getElementById("root")!).render(<Stage />);
