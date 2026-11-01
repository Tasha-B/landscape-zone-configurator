import { useParams } from "react-router";
import PlanEditor from "../components/PlanEditor/PlanEditor";

// The editor of one plan. Its heading is the plan's name, so the editor
// draws the page frame itself.
export default function PlanEditorPage() {
  const { id = "" } = useParams();
  // A new id starts a fresh editor: no selection or drag carried over
  return <PlanEditor key={id} planId={id} />;
}
